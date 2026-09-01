import { Request, Response } from "express";
import { Types } from "mongoose";
import { Review } from "../models/Review.js";
import { Restaurant } from "../models/Restaurant.js";
import { Booking } from "../models/Booking.js";
import { AuthRequest } from "../middlewares/auth.js";

const MAX_REVIEWS_RETURNED = 50;

// Recalculate the denormalised rating/reviewCount on the restaurant document.
const refreshRestaurantRating = async (restaurantId: Types.ObjectId | string): Promise<void> => {
    const [summary] = await Review.aggregate<{ average: number; count: number }>([
        { $match: { restaurant: new Types.ObjectId(String(restaurantId)) } },
        { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);

    await Restaurant.findByIdAndUpdate(restaurantId, {
        rating: summary ? Math.round(summary.average * 10) / 10 : 0,
        reviewCount: summary ? summary.count : 0,
    });
};

// List reviews for a restaurant
// GET /api/restaurants/:id/reviews
// @access  Public
export const getRestaurantReviews = async (req: Request, res: Response): Promise<void> => {
    try {
        const restaurantId = String(req.params.id);
        if (!Types.ObjectId.isValid(restaurantId)) {
            res.status(400).json({ message: "Invalid restaurant id" });
            return;
        }

        const reviews = await Review.find({ restaurant: restaurantId })
            .populate("user", "name")
            .sort({ createdAt: -1 })
            .limit(MAX_REVIEWS_RETURNED);

        res.json(reviews);
    } catch (error: any) {
        console.error("Get Reviews Error:", error);
        res.status(400).json({ message: error.message });
    }
};

// Leave a review for a restaurant you have dined at
// POST /api/restaurants/:id/reviews
// @access  Private
export const createRestaurantReview = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const restaurantId = String(req.params.id);
        if (!Types.ObjectId.isValid(restaurantId)) {
            res.status(400).json({ message: "Invalid restaurant id" });
            return;
        }

        const { rating, comment } = req.body;

        const ratingValue = Number(rating);
        if (!Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 5) {
            res.status(400).json({ message: "Please give a whole-number rating between 1 and 5" });
            return;
        }

        if (typeof comment !== "string" || comment.trim().length < 10) {
            res.status(400).json({ message: "Please write at least a short comment (10 characters or more)" });
            return;
        }

        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant || restaurant.status !== "approved") {
            res.status(404).json({ message: "Restaurant not found" });
            return;
        }

        // Only diners who actually held a reservation here may review.
        const priorBooking = await Booking.findOne({
            user: req.user?._id,
            restaurant: restaurant._id,
            status: { $ne: "cancelled" },
        }).sort({ date: -1 });

        if (!priorBooking) {
            res.status(403).json({ message: "Only guests with a reservation at this restaurant can leave a review" });
            return;
        }

        const alreadyReviewed = await Review.findOne({ restaurant: restaurant._id, user: req.user?._id });
        if (alreadyReviewed) {
            res.status(400).json({ message: "You have already reviewed this restaurant" });
            return;
        }

        const review = await Review.create({
            user: req.user?._id,
            restaurant: restaurant._id,
            rating: ratingValue,
            comment: comment.trim(),
            visitedDate: priorBooking.date,
        });

        await refreshRestaurantRating(restaurant._id as Types.ObjectId);

        const populated = await review.populate("user", "name");
        res.status(201).json(populated);
    } catch (error: any) {
        // Unique index on { restaurant, user } — belt and braces alongside the check above.
        if (error?.code === 11000) {
            res.status(400).json({ message: "You have already reviewed this restaurant" });
            return;
        }
        console.error("Create Review Error:", error);
        res.status(400).json({ message: error.message });
    }
};
