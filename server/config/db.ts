import mongoose from "mongoose";

/**
 * On a serverless host (Vercel), every cold start re-runs this module. Without a
 * cache each invocation would open a brand-new connection and MongoDB Atlas
 * would run out of them — the M0 free tier allows 500. Caching the *promise* on
 * globalThis means concurrent invocations in the same warm instance share one
 * connection, and the pool is reused across requests.
 *
 * On a normal long-lived server this simply connects once, as before.
 */
declare global {
    // eslint-disable-next-line no-var
    var __mongooseConnection: Promise<typeof mongoose> | undefined;
}

let listenersAttached = false;

const attachListeners = () => {
    if (listenersAttached) return;
    listenersAttached = true;
    mongoose.connection.on("connected", () => console.log("MongoDB Connected"));
    mongoose.connection.on("disconnected", () => console.warn("MongoDB disconnected"));
    mongoose.connection.on("error", (err) => console.error("MongoDB error:", err?.message ?? err));
};

const describeConnectionError = (error: unknown): string => {
    const err = error as { code?: string; syscall?: string; message?: string };

    // The single most common local failure: the ISP/router resolver refuses to
    // return the SRV record that a mongodb+srv:// URI depends on.
    if (err?.syscall === "querySrv" || err?.code === "ENOTFOUND") {
        return [
            "Could not resolve the MongoDB Atlas address.",
            "This is almost always DNS, not credentials. Try, in order:",
            "  1. Set your DNS to 8.8.8.8 / 1.1.1.1, then run: ipconfig /flushdns",
            "  2. Check the cluster is not paused in the Atlas dashboard",
            "  3. Use the non-SRV connection string (Atlas > Connect > Drivers >",
            '     "Node.js 2.2.12 or later"), which lists the shard hosts directly',
            "     and skips the SRV lookup entirely.",
        ].join("\n");
    }

    if (err?.code === "ETIMEDOUT" || err?.message?.includes("IP that isn't whitelisted")) {
        return "MongoDB refused the connection. Add your IP (or 0.0.0.0/0 for serverless) under Atlas > Network Access.";
    }

    return err?.message ?? String(error);
};

const connectDB = async (): Promise<typeof mongoose> => {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error("MONGODB_URI is not set. Copy server/.env.example to server/.env and fill it in.");
    }

    // Already connected in this warm instance — nothing to do.
    if (mongoose.connection.readyState === 1) return mongoose;

    if (!globalThis.__mongooseConnection) {
        attachListeners();
        globalThis.__mongooseConnection = mongoose.connect(uri, {
            // Fail with a readable message instead of hanging for 30s.
            serverSelectionTimeoutMS: 10000,
            maxPoolSize: 10,
        });
    }

    try {
        return await globalThis.__mongooseConnection;
    } catch (error) {
        // Clear the cache so the next request gets a fresh attempt rather than
        // replaying this rejected promise forever.
        globalThis.__mongooseConnection = undefined;
        throw new Error(`MongoDB connection failed.\n\n${describeConnectionError(error)}\n`);
    }
};

export default connectDB;
