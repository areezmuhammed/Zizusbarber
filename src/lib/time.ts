import { DateTime } from "luxon";

const ZONE = "Europe/London";

// Repeated hour (autumn clock change) resolves deterministically to the second (GMT) occurrence, which is what Luxon returns.
export function londonToUtc(date: string, time: string): Date | null {
  const dt = DateTime.fromISO(`${date}T${time}`, { zone: ZONE });
  // Luxon shifts nonexistent times forward, so a failed round-trip means the time doesn't exist.
  if (!dt.isValid || dt.toISODate() !== date || dt.toFormat("HH:mm") !== time.slice(0, 5)) return null;
  return dt.toUTC().toJSDate();
}

export function utcToLondon(d: Date): DateTime {
  return DateTime.fromJSDate(d, { zone: ZONE });
}

// Adds calendar days in London time, so the local wall-clock time is preserved across DST.
export function addLondonDays(d: Date, n: number): Date {
  return utcToLondon(d).plus({ days: n }).toUTC().toJSDate();
}
