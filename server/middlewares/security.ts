import { Request, Response, NextFunction } from "express";

/**
 * Dependency-free security middleware, so the project does not gain new npm
 * packages just to set a handful of headers and throttle the auth endpoints.
 */

/** A conservative set of hardening headers (the subset of helmet that matters for a JSON API). */
export const securityHeaders = (_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    res.removeHeader("X-Powered-By");
    next();
};

interface Bucket {
    count: number;
    resetAt: number;
}

/**
 * Fixed-window in-memory rate limiter.
 *
 * Caveat: the counters live in this process, so on a multi-instance or
 * serverless deployment each instance keeps its own window. That still blunts
 * credential stuffing considerably; swap in a Redis-backed limiter if you scale
 * horizontally and need a hard guarantee.
 */
export const rateLimit = (options: { windowMs: number; max: number; message?: string }) => {
    const { windowMs, max, message = "Too many requests. Please try again shortly." } = options;
    const buckets = new Map<string, Bucket>();

    return (req: Request, res: Response, next: NextFunction): void => {
        const now = Date.now();
        const key = req.ip ?? req.socket.remoteAddress ?? "unknown";

        // Opportunistic sweep so the map cannot grow without bound.
        if (buckets.size > 5000) {
            for (const [k, v] of buckets) {
                if (v.resetAt <= now) buckets.delete(k);
            }
        }

        const bucket = buckets.get(key);
        if (!bucket || bucket.resetAt <= now) {
            buckets.set(key, { count: 1, resetAt: now + windowMs });
            next();
            return;
        }

        bucket.count += 1;
        if (bucket.count > max) {
            res.setHeader("Retry-After", Math.ceil((bucket.resetAt - now) / 1000));
            res.status(429).json({ message });
            return;
        }

        next();
    };
};
