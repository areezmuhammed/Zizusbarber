import { createClient } from "@supabase/supabase-js";
import { shopConfig } from "../../shop.config";

export type BookingChange = { old_start: string; old_end: string; new_start: string; new_end: string; reason: string | null; at: string };
export type CustomerBooking = {
  service_name: string; price_pence: number; duration_min: number;
  start_at: string; end_at: string; status: string; first_name: string; changes: BookingChange[];
};
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

const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, "");
const esc = (s: string) => s.replace(/[\;,]/g, "\$&").replace(/\n/g, "\n");

// UTC "Z" times are unambiguous, so no VTIMEZONE block is needed.
export function buildIcs(token: string, b: Pick<CustomerBooking, "service_name" | "start_at" | "end_at">): string {
  return [
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
    "",
  ].join("\r\n");
}
