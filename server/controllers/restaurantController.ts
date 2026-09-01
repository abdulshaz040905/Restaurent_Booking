import { Request, Response } from "express";
import { Restaurant } from "../models/Restaurant.js";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { Booking } from "../models/Booking.js";
import { parseBookingDate, isPastSlot, escapeRegex } from "../utils/datetime.js";

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;

// Query params arrive as string | string[] | ParsedQs. Keep only real strings.
const asStringArray = (value: unknown): string[] => {
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
    return [];
};

const asString = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

// Get all restaurants with search and filters
// GET /api/restaurants
// @access  Public
export const getRestaurants = async (req: Request, res: Response): Promise<void> => {
    try {
        const { search, priceRange, rating, location, cuisine, sort, page, limit } = req.query;

        // Build query object
        const queryObj: Record<string, unknown> = { status: "approved" };

        const searchTerm = asString(search)?.trim();
        if (searchTerm) {
            // Escaped: this is user input going straight into a RegExp.
            const pattern = new RegExp(escapeRegex(searchTerm), "i");
            queryObj.$or = [{ name: pattern }, { tags: pattern }, { location: pattern }, { cuisine: pattern }];
        }

        const prices = asStringArray(priceRange);
        if (prices.length > 0) {
            queryObj.priceRange = { $in: prices };
        }

        // This filter was previously missing entirely, so the cuisine chips on the
        // search page and the "browse by cuisine" tiles had no effect.
        const cuisines = asStringArray(cuisine);
        if (cuisines.length > 0) {
            queryObj.cuisine = { $in: cuisines.map((c) => new RegExp(`^${escapeRegex(c)}$`, "i")) };
        }

        const ratingValue = Number.parseFloat(asString(rating) ?? "");
        if (Number.isFinite(ratingValue)) {
            queryObj.rating = { $gte: ratingValue };
        }

        const locationTerm = asString(location)?.trim();
        if (locationTerm) {
            queryObj.location = new RegExp(escapeRegex(locationTerm), "i");
        }

        // Sorting
        let sortOption: Record<string, 1 | -1> = { createdAt: -1 }; // Default
        if (sort === "rating") {
            sortOption = { rating: -1 };
        } else if (sort === "price_low") {
            sortOption = { priceRange: 1 };
        } else if (sort === "price_high") {
            sortOption = { priceRange: -1 };
        }

        // Always bounded, so a growing collection can never return everything at once.
        const pageSize = Math.min(Math.max(Number.parseInt(asString(limit) ?? "", 10) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
        const pageNumber = Math.max(Number.parseInt(asString(page) ?? "", 10) || 1, 1);

        const restaurants = await Restaurant.find(queryObj)
            .sort(sortOption)
            .skip((pageNumber - 1) * pageSize)
            .limit(pageSize);

        res.json(restaurants);
    } catch (error: any) {
        console.error("Get Restaurants Error:", error);
        res.status(400).json({ message: error.message });
    }
};

// Get featured and exclusive restaurants
// GET /api/restaurants/featured
// @access  Public
export const getFeaturedRestaurants = async (req: Request, res: Response): Promise<void> => {
    try {
        const featured = await Restaurant.find({
            status: "approved",
            $or: [{ featured: true }, { exclusive: true }],
        }).limit(6);
        res.json(featured);
    } catch (error) {
        console.error("Get Featured Restaurants Error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Get single restaurant by slug
// GET /api/restaurants/:slug
// @access  Public
export const getRestaurantBySlug = async (req: Request, res: Response): Promise<void> => {
    try {
        const restaurant = await Restaurant.findOne({ slug: req.params.slug });
        if (!restaurant) {
            res.status(404).json({ message: "Restaurant not found" });
            return;
        }

        // If not approved, verify authorization (owner or admin)
        if (restaurant.status !== "approved") {
            const isAuthorized = await isOwnerOrAdmin(req, restaurant.owner.toString());
            if (!isAuthorized) {
                res.status(404).json({ message: "Restaurant not found or pending approval" });
                return;
            }
        }

        res.json(restaurant);
    } catch (error: any) {
        console.error("Get Restaurant Error:", error);
        res.status(400).json({ message: error.message });
    }
};

// Best-effort identity check for endpoints that are public but reveal more to staff.
const isOwnerOrAdmin = async (req: Request, ownerId: string): Promise<boolean> => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer") || !process.env.JWT_SECRET) return false;

    try {
        const token = header.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET) as { id: string };
        const user = await User.findById(decoded.id);
        if (!user) return false;
        return user.role === "admin" || (user.role === "owner" && ownerId === user._id.toString());
    } catch {
        return false;
    }
};

// Get dynamic seat availability for slots
// GET /api/restaurants/:id/availability
// @access  Public
export const getRestaurantAvailability = async (req: Request, res: Response): Promise<void> => {
    try {
        const bookingDate = parseBookingDate(req.query.date);
        if (!bookingDate) {
            res.status(400).json({ message: "Please provide a valid date (YYYY-MM-DD)" });
            return;
        }

        const restaurant = await Restaurant.findById(req.params.id);
        if (!restaurant) {
            res.status(404).json({ message: "Restaurant not found" });
            return;
        }

        // Don't leak scheduling data for restaurants that are not live yet.
        if (restaurant.status !== "approved") {
            const isAuthorized = await isOwnerOrAdmin(req, restaurant.owner.toString());
            if (!isAuthorized) {
                res.status(404).json({ message: "Restaurant not found or pending approval" });
                return;
            }
        }

        // Get all active bookings on this date for the restaurant
        const bookings = await Booking.find({
            restaurant: restaurant._id,
            date: bookingDate,
            status: "confirmed",
        }).select("time guests");

        const totalSeats = restaurant.totalSeats || 20;

        // Map slots to available capacities
        const availability = restaurant.availableSlots.map((slot) => {
            const bookedSeats = bookings.filter((b) => b.time === slot).reduce((sum, b) => sum + b.guests, 0);
            const availableSeats = Math.max(0, totalSeats - bookedSeats);
            const past = isPastSlot(bookingDate, slot);

            return {
                time: slot,
                availableSeats,
                isPast: past,
                isAvailable: availableSeats > 0 && !past,
            };
        });

        res.json(availability);
    } catch (error: any) {
        console.error("Get Availability Error:", error);
        res.status(400).json({ message: error.message });
    }
};
