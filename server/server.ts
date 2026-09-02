import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import connectDB from "./config/db.js";
import authRouter from "./routes/authRoutes.js";
import restaurantRouter from "./routes/restaurantRoutes.js";
import bookingRouter from "./routes/bookingRoutes.js";
import ownerRouter from "./routes/ownerRoutes.js";
import adminRouter from "./routes/adminRoutes.js";
import { securityHeaders } from "./middlewares/security.js";

// Fail fast rather than serving traffic that will 500 on the first login.
const REQUIRED_ENV = ["MONGODB_URI", "JWT_SECRET"] as const;
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missingEnv.join(", ")}. See server/.env.example`);
}

const app = express();

// Trust the platform proxy so req.ip is the real client, not the load balancer.
app.set("trust proxy", 1);

// Start connecting immediately (so a long-lived server logs "MongoDB Connected"
// at boot) but do NOT await at module scope: on serverless a rejected top-level
// await takes the whole function down with an opaque error. Every request ensures
// the connection via ensureDatabase below, which is a no-op once connected.
connectDB().catch((err: Error) => console.error(err.message));

// CORS: lock down to the deployed front end when CLIENT_URL is set. Comma-separate
// for multiple origins (e.g. production domain plus a preview domain).
const allowedOrigins = (process.env.CLIENT_URL ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

app.use(
    cors({
        origin: allowedOrigins.length > 0 ? allowedOrigins : true,
        credentials: true,
    }),
);

// Middleware
app.use(securityHeaders);
app.use(express.json({ limit: "1mb" }));

// Ensure the database is reachable before any route touches a model. Cheap once
// connected; on a cold serverless start it awaits the shared connection promise.
const ensureDatabase = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        await connectDB();
        next();
    } catch (err) {
        console.error(err);
        res.status(503).json({ message: "Database unavailable. Please try again in a moment." });
    }
};

app.use("/api", ensureDatabase);

// Routes
app.use("/api/auth", authRouter);
app.use("/api/restaurants", restaurantRouter);
app.use("/api/bookings", bookingRouter);
app.use("/api/owner", ownerRouter);
app.use("/api/admin", adminRouter);

app.get("/", (req: Request, res: Response) => res.send("Server is Live!"));

// 404 for unknown API routes
app.use((req: Request, res: Response) => {
    res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Global Error Handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    console.error("Unhandled Error:", err);
    res.status(500).json({
        message: err.message || "Internal Server Error",
        stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
    });
});

const port = process.env.PORT || 5000;

// Only bind a port when running as a long-lived process. On Vercel (and any other
// serverless host) the exported app below is invoked directly per request, and
// calling listen() there is both unnecessary and harmful.
if (!process.env.VERCEL) {
    app.listen(port, () => console.log(`Server is running at http://localhost:${port}`));
}

export default app;
