import { Router } from "express";
import { registerUser, loginUser, getMe } from "../controllers/authController.js";
import { protect } from "../middlewares/auth.js";
import { rateLimit } from "../middlewares/security.js";

const authRouter = Router();

// Credential endpoints are the ones worth throttling.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: "Too many authentication attempts. Please try again in a few minutes.",
});

authRouter.post("/register", authLimiter, registerUser);
authRouter.post("/login", authLimiter, loginUser);
authRouter.get("/me", protect, getMe);

export default authRouter;
