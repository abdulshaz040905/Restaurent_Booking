import { Link, useNavigate } from "react-router-dom";
import { Star, MapPinIcon } from "lucide-react";
import { formatRating, formatSlot, todayLocalISO, isSlotInPast } from "../lib/format.ts";
import { restaurantImage } from "../lib/images.ts";

interface RestaurantCardProps {
    restaurant: {
        _id: string;
        name: string;
        slug: string;
        cuisine: string;
        priceRange: string;
        rating: number;
        reviewCount: number;
        location: string;
        image: string;
        availableSlots: string[];
        featured?: boolean;
        exclusive?: boolean;
    };
    /** Party size carried over from the search bar, so quick-booking keeps the user's choice. */
    defaultGuests?: string;
    /** Date carried over from the search bar ("YYYY-MM-DD"). Defaults to today. */
    defaultDate?: string;
}

export default function RestaurantCard({ restaurant, defaultGuests = "2", defaultDate }: RestaurantCardProps) {
    const navigate = useNavigate();

    const today = todayLocalISO();
    const bookingDate = defaultDate && defaultDate >= today ? defaultDate : today;

    // Quick-reservation chips are for the chosen day, so hide slots already gone by.
    const upcomingSlots = (restaurant.availableSlots || []).filter((slot) => !isSlotInPast(bookingDate, slot)).slice(0, 3);

    const handleSlotClick = (e: React.MouseEvent, slot: string) => {
        e.preventDefault();
        e.stopPropagation();
        // Redirect to booking details confirmation with the chosen slot, date and party size
        const params = new URLSearchParams({ slot, date: bookingDate, guests: defaultGuests });
        navigate(`/booking/${restaurant.slug}?${params.toString()}`);
    };

    return (
        <div className="group relative bg-white border border-outline-variant/10 card-hover-effect overflow-hidden rounded-md flex flex-col h-full">
            {/* Image & Badges */}
            <Link to={`/restaurant/${restaurant.slug}`} className="relative h-60 overflow-hidden block">
                <img
                    src={restaurantImage(restaurant.image)}
                    alt={restaurant.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/30 via-transparent to-transparent"></div>

                {/* Exclusive & Featured Badges */}
                <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
                    {restaurant.exclusive && (
                        <span className="text-[9px] font-medium tracking-widest text-white bg-secondary py-1 px-2.5 uppercase">
                            EXCLUSIVE
                        </span>
                    )}
                    {restaurant.featured && (
                        <span className="text-[9px] font-medium tracking-widest text-on-primary bg-primary py-1 px-2.5 uppercase">
                            RECOMMENDED
                        </span>
                    )}
                </div>
            </Link>

            {/* Content Body */}
            <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                    {/* Eyebrow metadata */}
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-medium text-secondary tracking-widest uppercase">{restaurant.cuisine}</span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-medium text-black/55">{restaurant.priceRange}</span>
                            <span className="text-black/55/30 text-xs">•</span>
                            <div className="flex items-center gap-0.5 text-secondary">
                                <Star size={12} fill="currentColor" />
                                <span className="text-xs font-medium text-primary">{formatRating(restaurant.rating, restaurant.reviewCount)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Restaurant Title */}
                    <Link to={`/restaurant/${restaurant.slug}`} className="block mb-2">
                        <h3 className="font-display text-lg font-semibold text-primary group-hover:text-secondary transition-colors line-clamp-1">
                            {restaurant.name}
                        </h3>
                    </Link>

                    {/* Location */}
                    <p className="text-xs text-black/55 mb-4 flex items-center gap-1">
                        <MapPinIcon size={14} className="text-black/55/70" />
                        {restaurant.location}
                    </p>
                </div>

                {/* Quick Slots */}
                <div>
                    <div className="border-t border-outline-variant/10 my-3"></div>
                    <span className="block text-[9px] font-medium text-black/55 tracking-wider uppercase mb-2">QUICK RESERVATION</span>
                    <div className="flex flex-wrap gap-1.5">
                        {upcomingSlots.length === 0 && (
                            <span className="text-[10px] text-black/40 italic py-1.5">No more sittings on this date</span>
                        )}
                        {upcomingSlots.map((slot) => (
                                <button
                                    key={slot}
                                    onClick={(e) => handleSlotClick(e, slot)}
                                    className="text-[10px] font-medium border border-outline-variant/60 hover:border-primary px-3 py-1.5 transition-colors cursor-pointer text-black/55 hover:text-primary bg-surface"
                                >
                                    {formatSlot(slot)}
                                </button>
                            ))}
                        <Link
                            to={`/restaurant/${restaurant.slug}`}
                            className="text-[10px] font-medium border border-outline-variant/20 px-3 py-1.5 transition-colors cursor-pointer text-secondary hover:bg-secondary hover:text-white"
                        >
                            ALL SLOTS
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
