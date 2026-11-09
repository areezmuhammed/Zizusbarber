import { parseDay } from "./admin-form";
import { UUID } from "./booking-form";

// Trust boundary for the settings actions: anything malformed becomes null, never an exception.

export const MAX_NAME = 60;
export const MAX_REASON = 100;
export { parseDay as parseDate };

const obj = (input: unknown) => (input && typeof input === "object" ? (input as Record<string, unknown>) : null);
const int = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null);

// Pounds as typed by the owner ("14", "14.5", "£14.50") to integer pence; no commas, signs or exponents.
export function parsePrice(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = /^£?(\d{1,4})(?:\.(\d{1,2}))?$/.exec(v.trim());
  return m ? Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0")) : null;
}

// London wall-clock "HH:MM" on a 5-minute step.
export function parseTime(v: unknown): string | null {
  return typeof v === "string" && /^([01]\d|2[0-3]):[0-5][05]$/.test(v) ? v : null;
}

export function parseService(input: unknown) {
  const o = obj(input);
  if (!o || typeof o.name !== "string" || typeof o.active !== "boolean") return null;
  if (o.id !== undefined && o.id !== null && !(typeof o.id === "string" && UUID.test(o.id))) return null;
  const name = o.name.trim();
  const price_pence = parsePrice(o.price);
  const duration_min = int(o.duration, 5, 240);
  if (!name || name.length > MAX_NAME || price_pence === null || duration_min === null) return null;
  return { id: (o.id as string | undefined) ?? null, name, price_pence, duration_min, active: o.active };
}

// open/close null = closed that weekday
export function parseHours(input: unknown) {
  const o = obj(input);
  const weekday = o && int(o.weekday, 0, 6);
  if (!o || weekday === null || typeof o.closed !== "boolean") return null;
  if (o.closed) return { weekday, open: null, close: null };
  const open = parseTime(o.open);
  const close = parseTime(o.close);
  return open && close && close > open ? { weekday, open, close } : null;
}

// `today` is the London date; closures are for today or later.
export function parseClosure(input: unknown, today: string) {
  const o = obj(input);
  const date = o && parseDay(o.date);
  if (!o || !date || date < today || typeof o.closed !== "boolean") return null;
  if (o.reason !== undefined && typeof o.reason !== "string") return null;
  const reason = (o.reason ?? "").trim();
  if (reason.length > MAX_REASON) return null;
  let open_local: string | null = null;
  let close_local: string | null = null;
  if (!o.closed) {
    open_local = parseTime(o.open);
    close_local = parseTime(o.close);
    if (!open_local || !close_local || close_local <= open_local) return null;
  }
  return { date, reason: reason || null, open_local, close_local };
}

export const parseId = (v: unknown): string | null => (typeof v === "string" && UUID.test(v) ? v : null);
