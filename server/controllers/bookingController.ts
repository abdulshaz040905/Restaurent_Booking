import { Response } from "express";
import { Booking } from "../models/Booking.js";
import { Restaurant } from "../models/Restaurant.js";
import { AuthRequest } from "../middlewares/auth.js";
import { parseBookingDate, isPastSlot } from "../utils/datetime.js";

const MAX_GUESTS_PER_BOOKING = 20;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Create a new booking
// POST /api/bookings
// @access  Private
export const createBooking = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { restaurantId, date, time, guests, occasion, specialRequests, contactName, contactEmail, contactPhone } = req.body;

        if (!restaurantId || !date || !time || !guests) {
            res.status(400).json({ message: "Please provide all required reservation details" });
            return;
        }

        if (!contactName || !contactEmail || !contactPhone) {
            res.status(400).json({ message: "Please provide contact name, email and phone for the reservation" });
            return;
        }

        if (typeof contactEmail !== "string" || !EMAIL_PATTERN.test(contactEmail.trim())) {
            res.status(400).json({ message: "Please provide a valid contact email address" });
            return;
        }

        const requestedGuests = Number(guests);
        if (!Number.isInteger(requestedGuests) || requestedGuests < 1 || requestedGuests > MAX_GUESTS_PER_BOOKING) {
            res.status(400).json({ message: `Party size must be a whole number between 1 and ${MAX_GUESTS_PER_BOOKING}` });
            return;
        }

        // Normalise the calendar day to UTC midnight so every booking for the same
        // day lands on the exact same value, whatever the caller sent.
        const bookingDate = parseBookingDate(date);
        if (!bookingDate) {
            res.status(400).json({ message: "Please provide a valid reservation date (YYYY-MM-DD)" });
            return;
        }

        // Check if restaurant exists
        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant) {
            res.status(404).json({ message: "Restaurant not found" });
            return;
        }

        // Verify restaurant is approved
        if (restaurant.status !== "approved") {
            res.status(400).json({ message: "Reservations are not open for this restaurant yet" });
            return;
        }

        // The slot has to be one this restaurant actually offers.
        if (!restaurant.availableSlots.includes(time)) {
            res.status(400).json({ message: "That dining time is not offered by this restaurant" });
            return;
        }

        // ...and it has to still be in the future.
        if (isPastSlot(bookingDate, time)) {
            res.status(400).json({ message: "That dining time has already passed. Please choose a later slot." });
            return;
        }

        const totalSeats = restaurant.totalSeats || 20;

        if (requestedGuests > totalSeats) {
            res.status(400).json({ message: `This restaurant seats a maximum of ${totalSeats} guests per slot.` });
            return;
        }

        // One active reservation per diner per slot.
        const duplicate = await Booking.findOne({
            user: req.user?._id,
            restaurant: restaurantId,
            date: bookingDate,
            time,
            status: "confirmed",
        });
        if (duplicate) {
            res.status(400).json({ message: "You already hold a reservation for this restaurant at this time" });
            return;
        }

        // Pre-check so the common "clearly full" case fails without writing anything.
        const seatsAlreadyBooked = await sumConfirmedSeats(restaurantId, bookingDate, time);
        if (requestedGuests > totalSeats - seatsAlreadyBooked) {
            res.status(400).json({
                message: `Unable to reserve. Only ${Math.max(0, totalSeats - seatsAlreadyBooked)} seats are available for this time slot.`,
            });
            return;
        }

        const booking = await Booking.create({
            user: req.user?._id,
            restaurant: restaurantId,
            date: bookingDate,
            time,
            guests: requestedGuests,
            occasion,
            specialRequests,
            contactName: String(contactName).trim(),
            contactEmail: String(contactEmail).trim().toLowerCase(),
            contactPhone: String(contactPhone).trim(),
            status: "confirmed",
        });

        // The pre-check above is not atomic: two requests can both pass it and both
        // insert. So re-read the slot and decide, deterministically, which bookings
        // fit. Every concurrent request sorts by _id and reaches the same verdict,
        // so exactly the losers roll themselves back — never all of them.
        const fits = await bookingFitsCapacity(restaurantId, bookingDate, time, totalSeats, String(booking._id));
        if (!fits) {
            await Booking.deleteOne({ _id: booking._id });
            res.status(409).json({ message: "That time slot filled up while you were booking. Please pick another time." });
            return;
        }

        // Populate restaurant info before returning
        const populatedBooking = await booking.populate("restaurant", "name location image address slug cuisine");

        res.status(201).json(populatedBooking);
    } catch (error: any) {
        console.error("Create Booking Error:", error);
        res.status(400).json({ message: error.message });
    }
};

// Total seats held by confirmed bookings in one slot.
const sumConfirmedSeats = async (restaurantId: string, date: Date, time: string): Promise<number> => {
    const existing = await Booking.find({ restaurant: restaurantId, date, time, status: "confirmed" }).select("guests");
    return existing.reduce((sum, b) => sum + b.guests, 0);
};

// Walk the slot's confirmed bookings in creation order and report whether the
// given booking is still within capacity.
const bookingFitsCapacity = async (
    restaurantId: string,
    date: Date,
    time: string,
    totalSeats: number,
    bookingId: string,
): Promise<boolean> => {
    const confirmed = await Booking.find({ restaurant: restaurantId, date, time, status: "confirmed" })
        .select("guests")
        .sort({ _id: 1 });

    let running = 0;
    for (const b of confirmed) {
        running += b.guests;
        if (String(b._id) === bookingId) {
            return running <= totalSeats;
        }
    }
    // Not found (already removed elsewhere) — treat as not fitting.
    return false;
};

// Get logged in user bookings
// GET /api/bookings/my
// @access  Private
export const getMyBookings = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const bookings = await Booking.find({ user: req.user?._id })
            .populate("restaurant", "name location image address slug cuisine")
            .sort({ date: -1, time: -1 });

        res.json(bookings);
    } catch (error: any) {
        console.error("Get My Bookings Error:", error);
        res.status(400).json({ message: error.message });
    }
};

// Cancel a booking
// PUT /api/bookings/:id/cancel
// @access  Private
export const cancelBooking = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            res.status(404).json({ message: "Booking not found" });
            return;
        }

        // Verify user owns the booking
        if (booking.user.toString() !== req.user?._id.toString()) {
            res.status(403).json({ message: "Not authorized to cancel this booking" });
            return;
        }

        if (booking.status === "cancelled") {
            res.status(400).json({ message: "This reservation is already cancelled" });
            return;
        }

        if (booking.status === "completed") {
            res.status(400).json({ message: "A completed reservation can no longer be cancelled" });
            return;
        }

        booking.status = "cancelled";
        await booking.save();

        const populatedBooking = await booking.populate("restaurant", "name location image address slug cuisine");
        res.json(populatedBooking);
    } catch (error: any) {
        console.error("Cancel Booking Error:", error);
        res.status(400).json({ message: error.message });
    }
};
