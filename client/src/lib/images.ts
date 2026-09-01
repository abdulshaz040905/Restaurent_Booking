import { assets } from "../assets/assets";

/**
 * Restaurants created before an image upload (or seeded without one) have
 * `image: ""`, which renders as a broken image. Fall back to the bundled
 * placeholder that was already shipped but never referenced.
 */
export const restaurantImage = (image?: string | null): string => image?.trim() || assets.default_restaurant_img;
