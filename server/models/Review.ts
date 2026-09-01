import { Schema, model, Document, Types } from "mongoose";

export interface IReview extends Document {
    user: Types.ObjectId;
    restaurant: Types.ObjectId;
    rating: number;
    comment: string;
    visitedDate: Date;
    createdAt: Date;
    updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
    {
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        restaurant: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true },
        rating: { type: Number, required: true, min: 1, max: 5 },
        comment: { type: String, required: true, trim: true, maxlength: 1000 },
        visitedDate: { type: Date, required: true },
    },
    { timestamps: true },
);

// One review per diner per restaurant.
ReviewSchema.index({ restaurant: 1, user: 1 }, { unique: true });

export const Review = model<IReview>("Review", ReviewSchema);
