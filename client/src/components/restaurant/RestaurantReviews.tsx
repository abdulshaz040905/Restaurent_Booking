/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import api from "../../lib/api.ts";
import toast from "react-hot-toast";
import { useAppContext } from "../../context/AppContext.tsx";
import { formatBookingDate, formatRating } from "../../lib/format.ts";

interface RestaurantReviewsProps {
    restaurant: any;
    /** Lets the parent refresh the header rating after a review lands. */
    onReviewAdded?: (restaurant: any) => void;
}

export default function RestaurantReviews({ restaurant, onReviewAdded }: RestaurantReviewsProps) {
    const { isAuthenticated } = useAppContext();

    const [reviews, setReviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState("");

    const restaurantId = restaurant?._id;

    useEffect(() => {
        const fetchReviews = async () => {
            if (!restaurantId) return;
            try {
                setLoading(true);
                const res = await api.get(`/restaurants/${restaurantId}/reviews`);
                setReviews(res.data);
            } catch {
                // A failed review fetch should not take the whole page down.
                setReviews([]);
            } finally {
                setLoading(false);
            }
        };
        fetchReviews();
    }, [restaurantId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (comment.trim().length < 10) {
            toast.error("Please write at least 10 characters.");
            return;
        }

        try {
            setSubmitting(true);
            const res = await api.post(`/restaurants/${restaurantId}/reviews`, { rating, comment });
            setReviews((prev) => [res.data, ...prev]);
            setComment("");
            setShowForm(false);
            toast.success("Thank you for sharing your experience!");

            // Pull the recalculated rating back so the hero updates immediately.
            if (onReviewAdded && restaurant?.slug) {
                try {
                    const refreshed = await api.get(`/restaurants/${restaurant.slug}`);
                    onReviewAdded(refreshed.data);
                } catch {
                    /* non-fatal */
                }
            }
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Could not submit your review");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <section className="space-y-8 pt-6 border-t border-outline-variant/10 text-left">
            <div className="flex items-center justify-between gap-4">
                <h3 className="font-display text-xl font-semibold text-primary">Guest Experiences</h3>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-black/55">
                        {formatRating(restaurant?.rating, restaurant?.reviewCount)}
                        {restaurant?.reviewCount ? ` · ${restaurant.reviewCount} ${restaurant.reviewCount === 1 ? "review" : "reviews"}` : ""}
                    </span>
                    {isAuthenticated && (
                        <button
                            onClick={() => setShowForm((v) => !v)}
                            className="text-[10px] font-medium tracking-wider uppercase border border-outline-variant/40 hover:border-primary hover:text-primary px-3 py-1.5 rounded-sm cursor-pointer transition-colors"
                        >
                            {showForm ? "Cancel" : "Write a review"}
                        </button>
                    )}
                </div>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-surface-container-low/40 border border-outline-variant/20 rounded-md p-5 space-y-4">
                    <div className="space-y-1.5">
                        <span className="block text-[10px] font-medium text-black/55 tracking-wider uppercase">Your rating</span>
                        <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setRating(value)}
                                    aria-label={`${value} star${value === 1 ? "" : "s"}`}
                                    className="text-secondary cursor-pointer p-0.5"
                                >
                                    <Star size={18} fill={value <= rating ? "currentColor" : "none"} className={value <= rating ? "" : "text-outline-variant"} />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-medium text-black/55 tracking-wider uppercase">Your experience</label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            rows={3}
                            required
                            minLength={10}
                            maxLength={1000}
                            placeholder="What stood out about the meal, the room, the service?"
                            className="w-full bg-white border border-outline-variant/40 rounded-md p-3 text-xs focus:border-secondary focus:outline-none"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="bg-primary hover:bg-secondary text-white text-[10px] font-medium tracking-widest uppercase px-6 py-2.5 rounded-sm cursor-pointer transition-colors disabled:opacity-60"
                    >
                        {submitting ? "Publishing..." : "Publish review"}
                    </button>

                    <p className="text-[10px] text-black/45 italic">Only guests who have held a reservation here can leave a review.</p>
                </form>
            )}

            {/* Reviews list */}
            <div className="space-y-6">
                {loading ? (
                    <div className="py-8 flex justify-center">
                        <div className="w-6 h-6 border-2 border-outline-variant/30 border-t-secondary rounded-full animate-spin"></div>
                    </div>
                ) : reviews.length === 0 ? (
                    <p className="text-xs text-black/55 italic">No reviews yet. Be the first to share your experience!</p>
                ) : (
                    reviews.map((r: any) => (
                        <div key={r._id} className="pb-6 border-b border-outline-variant/10 last:border-b-0 space-y-2">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-medium text-primary">{r.user?.name || "Guest"}</h4>
                                    <span className="text-xs text-black/55">Visited {formatBookingDate(r.visitedDate)}</span>
                                </div>
                                <div className="flex items-center gap-0.5 text-secondary">
                                    {[...Array(5)].map((_, i) => (
                                        <Star
                                            key={i}
                                            size={12}
                                            fill={i < r.rating ? "currentColor" : "none"}
                                            className={i < r.rating ? "" : "text-outline-variant"}
                                        />
                                    ))}
                                </div>
                            </div>
                            <p className="text-xs text-black/55 max-w-lg leading-relaxed">{r.comment}</p>
                        </div>
                    ))
                )}
            </div>
        </section>
    );
}
