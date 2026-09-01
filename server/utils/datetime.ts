/**
 * Booking dates are stored as UTC midnight of the calendar day, so that every
 * booking for "2026-09-15" compares equal regardless of what the caller sent.
 * Slot times ("HH:MM") are interpreted in the server's local timezone, which is
 * assumed to be the restaurants' timezone. If you ever host restaurants across
 * multiple timezones, add a `timezone` field to the Restaurant model and pass it
 * through `isPastSlot`.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
export const SLOT_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Normalise any accepted date input to UTC midnight. Returns null if unusable. */
export const parseBookingDate = (input: unknown): Date | null => {
    if (input instanceof Date) {
        return Number.isNaN(input.getTime()) ? null : toUtcMidnight(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate());
    }

    if (typeof input !== "string" || input.trim() === "") return null;

    const value = input.trim();

    if (DATE_ONLY.test(value)) {
        const [year, month, day] = value.split("-").map(Number);
        const parsed = toUtcMidnight(year, month - 1, day);
        // Rejects impossible days such as 2026-02-31, which Date would roll over.
        if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
            return null;
        }
        return parsed;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return toUtcMidnight(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
};

const toUtcMidnight = (year: number, monthIndex: number, day: number): Date =>
    new Date(Date.UTC(year, monthIndex, day, 0, 0, 0, 0));

/** True when the given calendar day + slot time is already in the past. */
export const isPastSlot = (date: Date, time: string, now: Date = new Date()): boolean => {
    const match = SLOT_PATTERN.exec(time);
    if (!match) return true; // unparseable slot: refuse rather than let it through

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    // Build the instant in the server's local timezone from the stored UTC day.
    const slotInstant = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hours, minutes, 0, 0);

    return slotInstant.getTime() < now.getTime();
};

/** Escape a user-supplied string so it is safe to embed in a RegExp. */
export const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
