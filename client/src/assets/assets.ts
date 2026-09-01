import hero_bg_img from "./hero_bg_img.png";
import default_restaurant_img from "./default_restaurant_Img.jpeg";
import membership_section_img from "./membership_section_img.png";
import type { LucideIcon } from "lucide-react";
import {
    BeefIcon,
    Building2Icon,
    CroissantIcon,
    FishIcon,
    GlobeIcon,
    LeafIcon,
    MailIcon,
    Share2Icon,
    UtensilsCrossedIcon,
} from "lucide-react";

export const assets = {
    hero_bg_img,
    default_restaurant_img,
    membership_section_img,
};

export const footerSections = [
    {
        title: "COMPANY",
        links: [
            { label: "About Us", path: "#" },
            { label: "Partner with Us", path: "#" },
            { label: "Careers", path: "#" },
        ],
    },
    {
        title: "LEGAL",
        links: [
            { label: "Terms of Service", path: "#" },
            { label: "Privacy Policy", path: "#" },
            { label: "Cookies", path: "#" },
        ],
    },
];

export const socialLinks = [
    { icon: GlobeIcon, href: "#" },
    { icon: Share2Icon, href: "#" },
    { icon: MailIcon, href: "#" },
];

export const bottomLinks = [
    { label: "Terms", path: "#" },
    { label: "Privacy", path: "#" },
];

export const cuisines: { name: string; icon: LucideIcon; label: string; queryKey: "cuisine" | "search" }[] = [
    { name: "Italian", icon: UtensilsCrossedIcon, label: "ITALIAN", queryKey: "cuisine" },
    { name: "Japanese", icon: FishIcon, label: "SUSHI", queryKey: "cuisine" },
    { name: "French", icon: CroissantIcon, label: "FRENCH", queryKey: "cuisine" },
    // Rooftop is a tag rather than a cuisine, so it searches instead of filtering.
    { name: "Rooftop", icon: Building2Icon, label: "ROOFTOP", queryKey: "search" },
    { name: "Steakhouse", icon: BeefIcon, label: "STEAKHOUSE", queryKey: "cuisine" },
    { name: "Vegetarian", icon: LeafIcon, label: "VEGETARIAN", queryKey: "cuisine" },
];
