import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User, IUser } from "../models/User.js";

export interface AuthRequest extends Request {
    user?: IUser;
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
        res.status(401).json({ message: "Not authorized, no token" });
        return;
    }

    const token = header.split(" ")[1];
    if (!token) {
        res.status(401).json({ message: "Not authorized, no token" });
        return;
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string };

        // Get user from the token, exclude password
        const user = await User.findById(decoded.id).select("-password");
        if (!user) {
            res.status(401).json({ message: "Not authorized, user not found" });
            return;
        }

        req.user = user;
        next();
    } catch (error) {
        console.error("Auth Middleware Error:", error);
        res.status(401).json({ message: "Not authorized, token failed" });
    }
};

export const adminOnly = (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (req.user && req.user.role === "admin") {
        next();
    } else {
        res.status(403).json({ message: "Access denied, admin role required" });
    }
};

export const ownerOnly = (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (req.user && (req.user.role === "owner" || req.user.role === "admin")) {
        next();
    } else {
        res.status(403).json({ message: "Access denied, restaurant owner role required" });
    }
};
