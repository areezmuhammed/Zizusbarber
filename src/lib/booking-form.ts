import { utcToLondon } from "./time";

type HoursRow = { weekday: number; open_local: string; close_local: string };
export type Closure = { date: string; open_local: string | null; close_local: string | null };

// Mirrors create_booking: a closure row replaces the day's hours (null = shut); otherwise earliest open to latest close.
export function dayHours(date: string, hours: HoursRow[], closures: Closure[]) {
  const c = closures.find((x) => x.date === date);
  if (c) return c.open_local && c.close_local ? { open: c.open_local.slice(0, 5), close: c.close_local.slice(0, 5) } : null;
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 = Sunday, like opening_hours
  const rows = hours.filter((h) => h.weekday === weekday);
  if (!rows.length) return null;
  return {
    open: rows.map((h) => h.open_local.slice(0, 5)).sort()[0],
    close: rows.map((h) => h.close_local.slice(0, 5)).sort().at(-1)!,
  };
}

// create_booking's public limits (017): too_many = 3 upcoming or 5 made in 24h for one phone; busy = shop-wide hourly cap.
export function limitNotice(reason: "too_many" | "busy", phone: string) {
  return reason === "busy"
    ? `We are getting a lot of requests right now. Please try again in a few minutes or call us on ${phone}.`
    : `You have made several bookings recently, please call us on ${phone} to add more.`;
}

// How far ahead the public may book. create_booking enforces the same 90 days (supabase/migrations/016_hardening.sql).
export const BOOKING_HORIZON_DAYS = 90;

// London calendar dates (YYYY-MM-DD) of the next `count` open days, starting today. Steps calendar days, never 24h.
export function openDays(now: Date, count: number, hours: HoursRow[], closures: Closure[]): string[] {
  const out: string[] = [];
  const today = utcToLondon(now).startOf("day");
  for (let i = 0; out.length < count && i < BOOKING_HORIZON_DAYS; i++) {
    const date = today.plus({ days: i }).toISODate()!;
    if (dayHours(date, hours, closures)) out.push(date);
  }
  return out;
}

export type Details = { name: string; phone: string; email: string };

// UK number as +44 plus 9-10 digits, or null. Accepts 07…, 447…, +44 7…, 0044 7… and "+44 (0)7…",
// with spaces, brackets, hyphens and dots. UK national numbers start 1, 2, 3, 5, 7, 8 or 9 after the 0/44
// prefix, so "+44 0…" (doubled trunk zero) and "+44 44…" (doubled country code) are rejected.
export function normalisePhone(raw: string): string | null {
  const s = raw
    .trim()
    .replace(/^(\+?44|0044)\s*\(0\)/, "$1")
    .replace(/[\s().-]/g, "")
    .replace(/^(?:\+44|0044)/, "44");
  if (!/^(?:0|44)[1235789]\d{8,9}$/.test(s)) return null;
  return `+44${s.replace(/^(?:0|44)/, "")}`;
}

const LIMITS = { name: 100, phone: 30, email: 254 };

export function validateDetails(d: Details): Partial<Record<keyof Details, string>> {
  const e: Partial<Record<keyof Details, string>> = {};
  if (typeof d.name !== "string" || !d.name.trim()) e.name = "Enter your name";
  else if (d.name.length > LIMITS.name) e.name = `Keep your name under ${LIMITS.name} characters`;
  if (typeof d.phone !== "string" || d.phone.length > LIMITS.phone || !normalisePhone(d.phone))
    e.phone = "Enter a UK phone number, like 07700 900123";
  if (typeof d.email !== "string") e.email = "Enter a valid email or leave it blank";
  else if (d.email.trim() && (d.email.length > LIMITS.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())))
    e.email = "Enter a valid email or leave it blank";
  return e;
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

// Trust boundary for the book action: anything malformed becomes null, never an exception.
export function parseBooking(input: unknown) {
  if (!input || typeof input !== "object") return null;
  const { serviceId, start, name, phone, email } = input as Record<string, unknown>;
  if (typeof serviceId !== "string" || !UUID.test(serviceId)) return null;
  if (typeof start !== "string" || !ISO.test(start) || Number.isNaN(Date.parse(start))) return null;
  if (typeof name !== "string" || typeof phone !== "string" || typeof email !== "string") return null;
  if (Object.keys(validateDetails({ name, phone, email })).length) return null;
  return {
    serviceId,
    startAt: new Date(start),
    name: name.trim(),
    phone: normalisePhone(phone)!,
    email: email.trim() || undefined,
  };
}
