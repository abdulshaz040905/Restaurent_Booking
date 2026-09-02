import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import authRouter from "./routes/authRoutes.js";
import restaurantRouter from "./routes/restaurantRoutes.js";
import bookingRouter from "./routes/bookingRoutes.js";
import ownerRouter from "./routes/ownerRoutes.js";
import adminRouter from "./routes/adminRoutes.js";
import { securityHeaders } from "./middlewares/security.js";

// The app cannot work without these. Do NOT throw here: on a serverless host a
// module-scope throw crashes the whole function and the browser gets an opaque
// FUNCTION_INVOCATION_FAILED page with no clue what is wrong. Record the problem
// instead and report it clearly from "/" and from every /api route below.
const REQUIRED_ENV = ["MONGODB_URI", "JWT_SECRET"] as const;
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
    console.error(`[startup] Missing required environment variable(s): ${missingEnv.join(", ")}. See server/.env.example`);
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

// Ensure the app is configured and the database is reachable before any route
// touches a model. Cheap once connected; on a cold serverless start it awaits the
// shared connection promise.
const ensureReady = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (missingEnv.length > 0) {
        res.status(503).json({
            message: `Server is misconfigured: missing ${missingEnv.join(", ")}.`,
            hint: "Set these in your host's environment variables, then redeploy. See server/.env.example",
        });
        return;
    }

    try {
        await connectDB();
        next();
    } catch (err) {
        console.error(err);
        res.status(503).json({
            message: "Database unavailable. Please try again in a moment.",
            hint: (err as Error)?.message,
        });
    }
};

app.use("/api", ensureReady);

// Routes
app.use("/api/auth", authRouter);
app.use("/api/restaurants", restaurantRouter);
app.use("/api/bookings", bookingRouter);
app.use("/api/owner", ownerRouter);
app.use("/api/admin", adminRouter);

// Health check. Deliberately does NOT require the database, so it still answers
// when something is misconfigured — this is the endpoint to hit first when a
// deployment misbehaves.
app.get("/", (_req: Request, res: Response) => {
    const states = ["disconnected", "connected", "connecting", "disconnecting"];
    res.json({
        status: missingEnv.length > 0 ? "misconfigured" : "ok",
        message: missingEnv.length > 0 ? `Missing environment variable(s): ${missingEnv.join(", ")}` : "Server is Live!",
        database: states[mongoose.connection.readyState] ?? "unknown",
        cloudinaryConfigured: Boolean(process.env.CLOUDINARY_URL),
        corsLockedTo: allowedOrigins.length > 0 ? allowedOrigins : "any origin (CLIENT_URL not set)",
    });
});

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
