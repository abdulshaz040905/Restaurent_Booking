import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { AuthRequest } from "../middlewares/auth.js";

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Roles a client is allowed to ask for at sign-up.
// "admin" is deliberately NOT here: it can only be granted directly in the database.
const SELF_SERVICE_ROLES = ["user", "owner"] as const;
type SelfServiceRole = (typeof SELF_SERVICE_ROLES)[number];

const resolveSignupRole = (requested: unknown): SelfServiceRole =>
    SELF_SERVICE_ROLES.includes(requested as SelfServiceRole) ? (requested as SelfServiceRole) : "user";

// Helper to generate JWT token
const generateToken = (id: string): string => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET is not configured");
    }
    return jwt.sign({ id }, secret, { expiresIn: "30d" });
};

// Register a new user
// POST /api/auth/register
// @access  Public
export const registerUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, email, password, phone, role } = req.body;

        if (!name || !email || !password) {
            res.status(400).json({ message: "Please enter all required fields" });
            return;
        }

        if (typeof email !== "string" || !EMAIL_PATTERN.test(email.trim())) {
            res.status(400).json({ message: "Please provide a valid email address" });
            return;
        }

        // Enforced here rather than on the schema: the schema only ever sees the bcrypt hash.
        if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
            res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
            return;
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Check if user exists
        const userExists = await User.findOne({ email: normalizedEmail });
        if (userExists) {
            res.status(400).json({ message: "User already exists" });
            return;
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user. The role is never taken verbatim from the request body.
        const user = await User.create({
            name: String(name).trim(),
            email: normalizedEmail,
            password: hashedPassword,
            phone: phone ? String(phone).trim() : undefined,
            role: resolveSignupRole(role),
        });

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            token: generateToken(user._id.toString()),
        });
    } catch (error: any) {
        console.error("Register Error:", error);
        res.status(400).json({ message: error.message });
    }
};

// Authenticate a user & get token
// POST /api/auth/login
// @access  Public
export const loginUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        if (!email || !password || typeof email !== "string" || typeof password !== "string") {
            res.status(400).json({ message: "Please provide email and password" });
            return;
        }

        // Check for user
        const user = await User.findOne({ email: email.trim().toLowerCase() });
        if (!user) {
            res.status(401).json({ message: "Invalid email or password" });
            return;
        }

        // Check if password matches (user.password is not undefined because we queried it)
        const isMatch = await bcrypt.compare(password, user.password || "");
        if (!isMatch) {
            res.status(401).json({ message: "Invalid email or password" });
            return;
        }

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            token: generateToken(user._id.toString()),
        });
    } catch (error: any) {
        console.error("Login Error:", error);
        res.status(400).json({ message: error.message });
    }
};

// Get user profile
// GET /api/auth/me
// @access  Private
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Not authorized" });
            return;
        }

        res.json(req.user);
    } catch (error: any) {
        console.error("Get Me Error:", error);
        res.status(400).json({ message: error.message });
    }
};
