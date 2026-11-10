import { createClient } from "@supabase/supabase-js";
import { shopConfig } from "../../shop.config";

export type BookingChange = { old_start: string; old_end: string; new_start: string; new_end: string; reason: string | null; at: string };
export type CustomerBooking = {
  service_name: string; price_pence: number; duration_min: number;
  start_at: string; end_at: string; status: string; first_name: string; changes: BookingChange[]; reminders_off: boolean;
};
export type EraseResult = { ok: true; anonymised: number } | { ok: false; reason: "not_found" | "failed" };
export type CancelResult = { ok: true } | { ok: false; reason: "too_late" | "not_found" | "not_cancellable" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string) => UUID.test(s);

const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });

// A non-uuid token is "not found" without touching the database, so no cast error can leak.
export async function getBookingByToken(token: string): Promise<CustomerBooking | null> {
  if (!isUuid(token)) return null;
  const { data, error } = await db().rpc("get_booking_by_token", { p_token: token });
  if (error) throw new Error(error.message);
  return (data as CustomerBooking[])[0] ?? null;
}

export async function cancelBookingByToken(token: string): Promise<CancelResult> {
  if (!isUuid(token)) return { ok: false, reason: "not_found" };
  const { data, error } = await db().rpc("cancel_booking_by_token", { p_token: token });
  if (error) throw new Error(error.message);
  return data as CancelResult;
}

// Right to erasure: anonymises ONLY this token's booking and rotates its token (016_hardening.sql).
export async function eraseCustomerByToken(token: string): Promise<EraseResult> {
  if (!isUuid(token)) return { ok: false, reason: "not_found" };
  const { data, error } = await db().rpc("anonymise_customer_by_token", { p_token: token });
  if (error) throw new Error(error.message);
  return data as EraseResult;
}

export async function stopRemindersByToken(token: string): Promise<{ ok: boolean }> {
  if (!isUuid(token)) return { ok: false };
  const { data, error } = await db().rpc("set_reminders_off_by_token", { p_token: token });
  if (error) throw new Error(error.message);
  return data as { ok: boolean };
}

const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/[;,]/g, "\\$&").replace(/\r?\n/g, "\\n");

// RFC 5545 3.1: lines over 75 octets are folded as CRLF + one space; split on code points, never inside a UTF-8 sequence.
const fold = (line: string) => {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  let len = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (len + n > (out.length ? 74 : 75)) { out.push(cur); cur = ""; len = 0; } // continuation lines spend 1 octet on the space
    cur += ch;
    len += n;
  }
  out.push(cur);
  return out.join("\r\n ");
};

// UTC "Z" times are unambiguous, so no VTIMEZONE block is needed.
export function buildIcs(token: string, b: Pick<CustomerBooking, "service_name" | "start_at" | "end_at">): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Zizus Barbers//Booking//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${token}@zizusbarbers.com`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(b.start_at)}`,
    `DTEND:${icsDate(b.end_at)}`,
    `SUMMARY:${esc(`${b.service_name} at ${shopConfig.name}`)}`,
    `LOCATION:${esc(`${shopConfig.name}, ${shopConfig.address}`)}`,
    `DESCRIPTION:${esc(`Booking at ${shopConfig.name}. Call ${shopConfig.phone} to change it.`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
