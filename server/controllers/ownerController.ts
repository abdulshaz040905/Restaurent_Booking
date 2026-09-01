import { Response } from "express";
import { Restaurant, IRestaurant } from "../models/Restaurant.js";
import { Booking } from "../models/Booking.js";
import { AuthRequest } from "../middlewares/auth.js";
import { v2 as cloudinary } from "cloudinary";
import { SLOT_PATTERN } from "../utils/datetime.js";

const PRICE_RANGES = ["$", "$$", "$$$", "$$$$"] as const;

// Editing any of these re-opens the listing for admin review; capacity and slot
// changes are day-to-day operations and do not.
const MODERATED_FIELDS = ["name", "description", "cuisine", "location", "address", "chef", "image"] as const;

// Helper function to upload buffer to Cloudinary
const uploadToCloudinary = (fileBuffer: Buffer): Promise<{ secure_url: string }> => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ folder: "QuickDine" }, (error, result) => {
            if (error) return reject(error);
            if (!result) return reject(new Error("Upload failed"));
            resolve({ secure_url: result.secure_url });
        });
        stream.end(fileBuffer);
    });
};

const slugify = (name: string): string =>
    name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");

// Find a slug that is free, appending -2, -3, ... when the base is taken.
const findAvailableSlug = async (base: string, excludeId?: string): Promise<string | null> => {
    if (!base) return null;

    for (let suffix = 0; suffix < 50; suffix++) {
        const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
        const clash = await Restaurant.findOne({ slug: candidate });
        if (!clash || (excludeId && clash._id.toString() === excludeId)) {
            return candidate;
        }
    }
    return null;
};

type ModeratedSnapshot = Record<(typeof MODERATED_FIELDS)[number], string>;

const snapshotModeratedFields = (r: IRestaurant): ModeratedSnapshot => ({
    name: r.name,
    description: r.description,
    cuisine: r.cuisine,
    location: r.location,
    address: r.address,
    chef: r.chef,
    image: r.image,
});

const parseList = (value: unknown): string[] | undefined => {
    if (typeof value === "string") {
        return value
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean);
    }
    if (Array.isArray(value)) {
        return value.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean);
    }
    return undefined;
};

// Get owner's restaurant
// GET /api/owner/restaurant
// @access  Private/Owner
export const getOwnerRestaurant = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const restaurant = await Restaurant.findOne({ owner: req.user?._id });
        if (!restaurant) {
            res.status(200).json(null); // Return null instead of 404 so frontend can show setup wizard
            return;
        }
        res.json(restaurant);
    } catch (error: any) {
        console.error("Get Owner Restaurant Error:", error);
        res.status(400).json({ message: error.message });
    }
};

// Create owner's restaurant (submitted to pending)
// POST /api/owner/restaurant
// @access  Private/Owner
export const createOwnerRestaurant = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const existing = await Restaurant.findOne({ owner: req.user?._id });
        if (existing) {
            res.status(400).json({ message: "You already have a restaurant registered" });
            return;
        }

        const { name, description, cuisine, priceRange, location, address, chef, tags, availableSlots, totalSeats } = req.body;

        if (!name || !description || !cuisine || !priceRange || !location || !address || !chef) {
            res.status(400).json({ message: "Please provide all required fields" });
            return;
        }

        if (!PRICE_RANGES.includes(priceRange)) {
            res.status(400).json({ message: "Please choose a valid price range" });
            return;
        }

        const seats = totalSeats === undefined || totalSeats === "" ? 20 : Number(totalSeats);
        if (!Number.isInteger(seats) || seats < 1) {
            res.status(400).json({ message: "Total capacity must be a whole number of at least 1" });
            return;
        }

        const parsedSlots = parseList(availableSlots) ?? ["17:00", "18:00", "19:00", "20:00", "21:00"];
        const invalidSlot = parsedSlots.find((slot) => !SLOT_PATTERN.test(slot));
        if (invalidSlot) {
            res.status(400).json({ message: `"${invalidSlot}" is not a valid 24-hour time (expected HH:MM)` });
            return;
        }
        if (parsedSlots.length === 0) {
            res.status(400).json({ message: "Please offer at least one dining slot" });
            return;
        }

        // Generate slug from name
        const slug = await findAvailableSlug(slugify(String(name)));
        if (!slug) {
            res.status(400).json({ message: "Could not derive a web address from that restaurant name" });
            return;
        }

        // Handle image
        let imageUrl = "";
        if (req.file) {
            const result = await uploadToCloudinary(req.file.buffer);
            imageUrl = result.secure_url;
        }

        const restaurant = await Restaurant.create({
            name,
            slug,
            description,
            cuisine,
            priceRange,
            location,
            address,
            chef,
            image: imageUrl,
            tags: parseList(tags) ?? [],
            availableSlots: [...parsedSlots].sort(),
            totalSeats: seats,
            owner: req.user?._id,
            status: "pending", // Start in pending approval
        });

        res.status(201).json(restaurant);
    } catch (error: any) {
        console.error("Create Owner Restaurant Error:", error);
        res.status(400).json({ message: error.message });
    }
};

// Update owner's restaurant
// PUT /api/owner/restaurant
// @access  Private/Owner
export const updateOwnerRestaurant = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const restaurant = await Restaurant.findOne({ owner: req.user?._id });
        if (!restaurant) {
            res.status(404).json({ message: "Restaurant profile not found" });
            return;
        }

        const { name, description, cuisine, priceRange, location, address, chef, tags, availableSlots, totalSeats } = req.body;

        const before = snapshotModeratedFields(restaurant);

        if (name) restaurant.name = name;
        if (description) restaurant.description = description;
        if (cuisine) restaurant.cuisine = cuisine;
        if (location) restaurant.location = location;
        if (address) restaurant.address = address;
        if (chef) restaurant.chef = chef;

        if (priceRange) {
            if (!PRICE_RANGES.includes(priceRange)) {
                res.status(400).json({ message: "Please choose a valid price range" });
                return;
            }
            restaurant.priceRange = priceRange;
        }

        if (totalSeats !== undefined && totalSeats !== "") {
            const seats = Number(totalSeats);
            if (!Number.isInteger(seats) || seats < 1) {
                res.status(400).json({ message: "Total capacity must be a whole number of at least 1" });
                return;
            }
            restaurant.totalSeats = seats;
        }

        const parsedTags = parseList(tags);
        if (parsedTags !== undefined) {
            restaurant.tags = parsedTags;
        }

        // Note the `!== undefined`: an empty string is a deliberate "clear all slots",
        // which the previous truthiness check silently ignored.
        if (availableSlots !== undefined) {
            const parsedSlots = parseList(availableSlots) ?? [];
            const invalidSlot = parsedSlots.find((slot) => !SLOT_PATTERN.test(slot));
            if (invalidSlot) {
                res.status(400).json({ message: `"${invalidSlot}" is not a valid 24-hour time (expected HH:MM)` });
                return;
            }
            if (parsedSlots.length === 0) {
                res.status(400).json({ message: "Please keep at least one dining slot available" });
                return;
            }
            restaurant.availableSlots = [...parsedSlots].sort();
        }

        // Handle new image upload if any
        if (req.file) {
            const result = await uploadToCloudinary(req.file.buffer);
            restaurant.image = result.secure_url;
        }

        // Keep the public URL in step with the restaurant's name.
        if (name && slugify(String(name)) !== slugify(before.name)) {
            const nextSlug = await findAvailableSlug(slugify(String(name)), restaurant._id.toString());
            if (!nextSlug) {
                res.status(400).json({ message: "Could not derive a web address from that restaurant name" });
                return;
            }
            restaurant.slug = nextSlug;
        }

        // Material content changed on a live listing → back to the approval queue.
        const after = snapshotModeratedFields(restaurant);
        const contentChanged = MODERATED_FIELDS.some((field) => before[field] !== after[field]);
        const wasReviewed = restaurant.status === "approved" || restaurant.status === "rejected";
        if (contentChanged && wasReviewed) {
            restaurant.status = "pending";
        }

        const updated = await restaurant.save();
        res.json(updated);
    } catch (error: any) {
        console.error("Update Owner Restaurant Error:", error);
        res.status(400).json({ message: error.message });
    }
};

// Get bookings for owner's restaurant
// GET /api/owner/bookings
// @access  Private/Owner
export const getOwnerBookings = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const restaurant = await Restaurant.findOne({ owner: req.user?._id });
        if (!restaurant) {
            res.status(404).json({ message: "Restaurant profile not found" });
            return;
        }

        const bookings = await Booking.find({ restaurant: restaurant._id })
            .populate("user", "name email phone")
            .sort({ date: -1, time: -1 });

        res.json(bookings);
    } catch (error: any) {
        console.error("Get Owner Bookings Error:", error);
        res.status(400).json({ message: error.message });
    }
};

// Update status of a booking
// PUT /api/owner/bookings/:id/status
// @access  Private/Owner
export const updateBookingStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { status } = req.body;
        if (!status || !["confirmed", "cancelled", "completed"].includes(status)) {
            res.status(400).json({ message: "Please enter a valid booking status" });
            return;
        }

        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            res.status(404).json({ message: "Booking not found" });
            return;
        }

        // Verify booking belongs to the owner's restaurant (admins may act on any)
        const restaurant = await Restaurant.findById(booking.restaurant);
        const isAdmin = req.user?.role === "admin";
        if (!restaurant || (!isAdmin && restaurant.owner.toString() !== req.user?._id.toString())) {
            res.status(403).json({ message: "Not authorized to manage this booking" });
            return;
        }

        // Re-confirming a cancelled booking must not push the slot over capacity.
        if (status === "confirmed" && booking.status !== "confirmed") {
            const totalSeats = restaurant.totalSeats || 20;
            const others = await Booking.find({
                restaurant: restaurant._id,
                date: booking.date,
                time: booking.time,
                status: "confirmed",
                _id: { $ne: booking._id },
            }).select("guests");
            const taken = others.reduce((sum, b) => sum + b.guests, 0);
            if (taken + booking.guests > totalSeats) {
                res.status(400).json({ message: `Only ${Math.max(0, totalSeats - taken)} seats remain in that slot.` });
                return;
            }
        }

        booking.status = status;
        await booking.save();

        res.json(booking);
    } catch (error: any) {
        console.error("Update Booking Status Error:", error);
        res.status(400).json({ message: error.message });
    }
};
