import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { User } from "./models/User.js";
import { Restaurant } from "./models/Restaurant.js";
import { Booking } from "./models/Booking.js";
import { Review } from "./models/Review.js";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/QuickDine";

// Demo passwords satisfy the 8-character minimum enforced at registration.
const DEMO_PASSWORDS = {
    admin: "admin1234",
    user: "user1234",
    owner: "owner1234",
};

const seedData = async () => {
    try {
        console.log("Connecting to database for seeding...");
        await mongoose.connect(MONGO_URI);

        console.log("Database connected. Clearing existing collections...");
        await User.deleteMany({});
        await Restaurant.deleteMany({});
        await Booking.deleteMany({});
        await Review.deleteMany({});

        console.log("Creating default users...");
        const salt = await bcrypt.genSalt(10);
        const hash = (plain: string) => bcrypt.hash(plain, salt);

        // Admin
        await User.create({
            name: "Alex Mercer",
            email: "admin@example.com",
            password: await hash(DEMO_PASSWORDS.admin),
            phone: "+01234567788",
            role: "admin",
        });

        // Diner
        await User.create({
            name: "Sarah Jenkins",
            email: "user@example.com",
            password: await hash(DEMO_PASSWORDS.user),
            phone: "+01234567788",
            role: "user",
        });

        console.log("Creating restaurants...");

        // Each restaurant needs its own owner account: the app enforces one
        // restaurant per owner, so sharing a single owner would leave five of the
        // six listings unreachable from the owner dashboard.
        const restaurantsData = [
            {
                name: "L'Artiste",
                slug: "l-artiste",
                description:
                    "An avant-garde journey through modern French gastronomy. L'Artiste blends classic French culinary foundations with contemporary visual artistry, resulting in a sensory dining experience that is both theatrical and deeply satisfying. Set in a gorgeous high-ceilinged room with minimal charcoal and gold design language.",
                cuisine: "French",
                priceRange: "$$$$",
                location: "Manhattan, NY",
                address: "420 Mercer St, New York, NY 10003",
                image: "/restaurant_4.png",
                chef: "Jean-Pierre Dubois",
                tags: ["Michelin Star", "Fine Dining", "Tasting Menu", "Romantic"],
                availableSlots: ["17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30"],
                featured: true,
                exclusive: true,
                ownerName: "Jean-Pierre Dubois",
                ownerEmail: "owner@example.com",
            },
            {
                name: "Kuro Omakase",
                slug: "kuro-omakase",
                description:
                    "An atmospheric, moody sanctuary of premium Japanese gastronomy. Seated at a dark, polished basalt-stone counter, guests experience a deeply focused sushi omakase. Chef Kenji Sato translates the freshest seasonal ingredients directly from Tokyo's fish markets into elegant, edible poetry.",
                cuisine: "Japanese",
                priceRange: "$$$$",
                location: "Manhattan, NY",
                address: "18 Orchard St, New York, NY 10002",
                image: "/restaurant_2.jpg",
                chef: "Kenji Sato",
                tags: ["Omakase", "Basalt Counter", "Japanese", "Zen Atmosphere"],
                availableSlots: ["18:00", "20:30"],
                featured: true,
                exclusive: true,
                ownerName: "Kenji Sato",
                ownerEmail: "owner.kuro@example.com",
            },
            {
                name: "Terraza Cielo",
                slug: "terraza-cielo",
                description:
                    "A sun-drenched rooftop oasis celebrating Italian and Mediterranean lifestyles. Featuring floor-to-ceiling foliage, white marble bistro tables, and panoramic skyline views, Terraza Cielo serves hand-crafted pastas and coastal seafood paired with bright botanical cocktails.",
                cuisine: "Italian",
                priceRange: "$$$",
                location: "Manhattan, NY",
                address: "244 Fifth Ave Rooftop, New York, NY 10001",
                image: "/restaurant_3.jpg",
                chef: "Elena Rossi",
                tags: ["Rooftop", "Skyline Views", "Handmade Pasta", "Craft Cocktails"],
                availableSlots: ["12:00", "13:00", "17:00", "18:00", "19:00", "20:00", "21:00"],
                featured: true,
                exclusive: false,
                ownerName: "Elena Rossi",
                ownerEmail: "owner.terraza@example.com",
            },
            {
                name: "Ember Grille",
                slug: "ember-grille",
                description:
                    "An upscale modern steakhouse with exposed brick walls, leather booths, and warm, industrial-chic pendant lighting. Offering Prime dry-aged cuts grilled over live hickory and cherrywood embers. Gourmet dining elevated into a sophisticated nocturnal experience.",
                cuisine: "Steakhouse",
                priceRange: "$$$$",
                location: "Manhattan, NY",
                address: "320 Bowery, New York, NY 10012",
                image: "/restaurant_1.png",
                chef: "Marcus Vance",
                tags: ["Dry-Aged Beef", "Wood Fire", "Moody Lighting", "Wine Room"],
                availableSlots: ["17:00", "18:00", "19:00", "20:00", "21:00", "22:00"],
                featured: false,
                exclusive: false,
                ownerName: "Marcus Vance",
                ownerEmail: "owner.ember@example.com",
            },
            {
                name: "Flora Garden",
                slug: "flora-garden",
                description:
                    "A bright, airy conservatory celebrating organic, plant-forward gastronomy. Nestled under glass ceilings with floor-to-ceiling botanicals, Flora Garden transforms fresh seasonal crops into delicate, high-end editorial culinary works of art.",
                cuisine: "Vegetarian",
                priceRange: "$$$",
                location: "Manhattan, NY",
                address: "90 Grand St, New York, NY 10013",
                image: "/restaurant_6.png",
                chef: "Chloe Mercer",
                tags: ["Plant-Based", "Glasshouse", "Organic", "Bright & Airy"],
                availableSlots: ["11:30", "13:00", "14:30", "17:30", "19:00", "20:30"],
                featured: false,
                exclusive: false,
                ownerName: "Chloe Mercer",
                ownerEmail: "owner.flora@example.com",
            },
            {
                name: "L'Essence",
                slug: "l-essence",
                description:
                    "An intimate, Parisian-inspired fine dining chamber wrapped in dark velvet and soft golden candle glow. L'Essence specializes in meticulous plating of haute gastronomy, creating a rich sensory dialogue between modern culinary innovation and classic romance.",
                cuisine: "French",
                priceRange: "$$$$",
                location: "Manhattan, NY",
                address: "115 Greenwich St, New York, NY 10006",
                image: "/restaurant_5.png",
                chef: "Jean-Luc Picard",
                tags: ["Romantic", "Velvet Booths", "Candlelit", "Haute Cuisine"],
                availableSlots: ["18:00", "19:00", "20:00", "21:00", "22:00"],
                featured: true,
                exclusive: false,
                ownerName: "Jean-Luc Picard",
                ownerEmail: "owner.essence@example.com",
            },
        ];

        console.log("Creating one owner account per restaurant...");
        const ownerPasswordHash = await hash(DEMO_PASSWORDS.owner);

        const documents = [];
        for (const [idx, rest] of restaurantsData.entries()) {
            const { ownerName, ownerEmail, ...restInfo } = rest;

            const owner = await User.create({
                name: ownerName,
                email: ownerEmail,
                password: ownerPasswordHash,
                phone: "+01234567788",
                role: "owner",
            });

            documents.push({
                ...restInfo,
                owner: owner._id,
                status: "approved",
                totalSeats: 20 + idx * 5,
                // No reviews are seeded, so these start at zero and the UI shows "New"
                // until real guests review. They are recalculated on every review.
                rating: 0,
                reviewCount: 0,
            });
        }

        console.log("Inserting restaurants...");
        await Restaurant.insertMany(documents);

        console.log("\nSeeding complete. Demo accounts:");
        console.log(`  admin@example.com       / ${DEMO_PASSWORDS.admin}`);
        console.log(`  user@example.com        / ${DEMO_PASSWORDS.user}`);
        console.log(`  owner@example.com       / ${DEMO_PASSWORDS.owner}   (L'Artiste)`);
        console.log(`  owner.kuro@example.com  / ${DEMO_PASSWORDS.owner}   (Kuro Omakase)`);
        console.log(`  ...and one owner per remaining restaurant (see seed.ts)\n`);

        await mongoose.disconnect();
        console.log("Disconnected from database.");
    } catch (error: any) {
        console.error("Seeding failed:", error);
        process.exit(1);
    }
};

seedData();
