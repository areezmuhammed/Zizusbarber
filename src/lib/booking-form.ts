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

// London calendar dates (YYYY-MM-DD) of the next `count` open days, starting today. Steps calendar days, never 24h.
export function openDays(now: Date, count: number, hours: HoursRow[], closures: Closure[]): string[] {
  const out: string[] = [];
  const today = utcToLondon(now).startOf("day");
  for (let i = 0; out.length < count && i < 90; i++) {
    const date = today.plus({ days: i }).toISODate()!;
    if (dayHours(date, hours, closures)) out.push(date);
  }
  return out;
}

export type Details = { name: string; phone: string; email: string };

export function validateDetails(d: Details): Partial<Record<keyof Details, string>> {
  const e: Partial<Record<keyof Details, string>> = {};
  if (!d.name.trim()) e.name = "Enter your name";
  // UK numbers: 0 or +44/0044, then 9-10 digits; spaces, dashes and brackets allowed
  if (!/^(?:0|\+44|0044)\d{9,10}$/.test(d.phone.replace(/[\s()-]/g, ""))) e.phone = "Enter a UK phone number, like 07700 900123";
  if (d.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) e.email = "Enter a valid email or leave it blank";
  return e;
}
