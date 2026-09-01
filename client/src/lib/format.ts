/**
 * Shared display + date helpers.
 *
 * Slots are stored as 24-hour "HH:MM" strings. They were previously rendered as
 * `{slot} PM` in six places, which turned "17:00" into "17:00 PM" and a lunch
 * slot of "11:30" into "11:30 PM". Use formatSlot everywhere instead.
 */

/** "17:00" -> "5:00 PM", "11:30" -> "11:30 AM". Falls back to the raw value. */
export const formatSlot = (time?: string | null): string => {
    if (!time) return "";

    const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (!match) return time;

    const hours = Number(match[1]);
    const minutes = match[2];
    if (hours < 0 || hours > 23) return time;

    const period = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;

    return `${hour12}:${minutes} ${period}`;
};

/**
 * Today's date as "YYYY-MM-DD" in the *browser's* timezone.
 *
 * `new Date().toISOString().split("T")[0]` returns the UTC day, which is the
 * wrong day for part of every 24 hours (before 05:30 in IST, after 19:00 in
 * New York). That mismatch made the date picker's `min` and the "is this today"
 * slot filter disagree with each other.
 */
export const todayLocalISO = (now: Date = new Date()): string => toLocalISO(now);

/** Format any Date as "YYYY-MM-DD" using local calendar fields. */
export const toLocalISO = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

/**
 * Parse a "YYYY-MM-DD" string into a local-midnight Date.
 * `new Date("2026-09-15")` parses as UTC midnight and can render as the previous
 * day west of Greenwich, so build the date from its parts instead.
 */
export const parseLocalDate = (value?: string | null): Date | null => {
    if (!value) return null;

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (match) {
        return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Turn an API booking date (UTC-midnight ISO string) into local midnight of the
 * same calendar day, so it can be compared against a local "today" without the
 * booking silently landing on the wrong side of the boundary.
 */
export const bookingDayAsLocalDate = (value: string | Date | null | undefined): Date | null => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

/** Render a booking date (ISO string or Date) in the viewer's locale. */
export const formatBookingDate = (
    value: string | Date | null | undefined,
    options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" },
): string => {
    if (!value) return "";

    // Booking dates come back from the API as UTC-midnight ISO strings. Read the
    // UTC calendar fields so the displayed day matches the day that was booked.
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const asLocal = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    return asLocal.toLocaleDateString(undefined, options);
};

/** Restaurants with no reviews yet show "New" rather than a fabricated score. */
export const formatRating = (rating?: number, reviewCount?: number): string => {
    if (!reviewCount || !rating) return "New";
    return rating.toFixed(1);
};

/** True when the slot on the given local date has already passed. */
export const isSlotInPast = (dateISO: string, time: string, now: Date = new Date()): boolean => {
    const day = parseLocalDate(dateISO);
    if (!day) return false;

    const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (!match) return false;

    const slotInstant = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(match[1]), Number(match[2]), 0, 0);

    return slotInstant.getTime() < now.getTime();
};
