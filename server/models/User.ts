import { Schema, model, Document } from "mongoose";

export interface IUser extends Document {
    name: string;
    email: string;
    password?: string;
    phone?: string;
    role: "user" | "admin" | "owner";
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, trim: true, lowercase: true },
        // NOTE: this stores a bcrypt hash, so no length rule belongs here.
        // The plaintext password policy is enforced in authController.registerUser.
        password: { type: String, required: true },
        phone: { type: String, trim: true },
        role: { type: String, enum: ["user", "admin", "owner"], default: "user" },
    },
    { timestamps: true },
);

// Remove password when converting to JSON
UserSchema.set("toJSON", {
    transform: (_doc, ret) => {
        delete ret.password;
        return ret;
    },
});

export const User = model<IUser>("User", UserSchema);
