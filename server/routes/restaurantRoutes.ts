import { Router } from "express";
import {
    getRestaurants,
    getFeaturedRestaurants,
    getRestaurantBySlug,
    getRestaurantAvailability,
} from "../controllers/restaurantController.js";
import { getRestaurantReviews, createRestaurantReview } from "../controllers/reviewController.js";
import { protect } from "../middlewares/auth.js";

const restaurantRouter = Router();

restaurantRouter.get("/", getRestaurants);
restaurantRouter.get("/featured", getFeaturedRestaurants);

// Multi-segment routes are declared before "/:slug" so the single-segment slug
// route can never swallow them.
restaurantRouter.get("/:id/availability", getRestaurantAvailability);
restaurantRouter.get("/:id/reviews", getRestaurantReviews);
restaurantRouter.post("/:id/reviews", protect, createRestaurantReview);

restaurantRouter.get("/:slug", getRestaurantBySlug);

export default restaurantRouter;
