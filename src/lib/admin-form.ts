import { DateTime } from "luxon";
import { normalisePhone, UUID, validateDetails } from "./booking-form";
import { londonToUtc } from "./time";

// Trust boundary for the admin actions: anything malformed becomes null, never an exception.

const STATUSES = ["arrived", "done", "no_show", "cancelled"] as const;
export type OwnerStatus = (typeof STATUSES)[number];

const obj = (input: unknown) => (input && typeof input === "object" ? (input as Record<string, unknown>) : null);
const isId = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

export function parseStatus(input: unknown) {
  const o = obj(input);
  if (!o || !isId(o.id) || !STATUSES.includes(o.status as OwnerStatus)) return null;
  return { id: o.id, status: o.status as OwnerStatus };
}

export function parseReminders(input: unknown) {
  const o = obj(input);
  if (!o || !isId(o.id) || typeof o.off !== "boolean") return null;
  return { id: o.id, off: o.off };
}

// add = lengthen by minutes; set = make the booking this many minutes long
export function parseLength(input: unknown) {
  const o = obj(input);
  if (!o || !isId(o.id) || (o.mode !== "add" && o.mode !== "set")) return null;
  const m = o.minutes;
  if (typeof m !== "number" || !Number.isInteger(m) || m < 1 || m > 240) return null;
  return { id: o.id, mode: o.mode, minutes: m };
}

export function parseDay(v: unknown): string | null {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && DateTime.fromISO(v).isValid ? v : null;
}

export function parseWalkIn(input: unknown) {
  const o = obj(input);
  if (!o || !isId(o.serviceId) || !parseDay(o.date) || typeof o.time !== "string" || !/^\d{2}:\d{2}$/.test(o.time)) return null;
  if (typeof o.name !== "string" || typeof o.phone !== "string") return null;
  if (Object.keys(validateDetails({ name: o.name, phone: o.phone, email: "" })).length) return null;
  const startAt = londonToUtc(o.date as string, o.time);
  if (!startAt) return null;
  return { serviceId: o.serviceId, startAt, name: o.name.trim(), phone: normalisePhone(o.phone)! };
}
