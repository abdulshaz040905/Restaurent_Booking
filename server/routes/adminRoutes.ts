import { Router } from "express";
import { protect, adminOnly } from "../middlewares/auth.js";
import { getAllRestaurants, approveRestaurant, getAdminStats } from "../controllers/adminController.js";

const adminRouter = Router();

adminRouter.use(protect);
adminRouter.use(adminOnly);

adminRouter.get("/restaurants", getAllRestaurants);
adminRouter.put("/restaurants/:id/approve", approveRestaurant);
adminRouter.get("/stats", getAdminStats);

export default adminRouter;
