import { createClient } from "@supabase/supabase-js";
import { shopConfig } from "../../shop.config";
import { calendarEvent } from "./ics";

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

// Customer's copy of their own appointment; the token is the stable event id.
export function buildIcs(token: string, b: Pick<CustomerBooking, "service_name" | "start_at" | "end_at">): string {
  return calendarEvent({
    uid: `${token}@zizusbarbers.com`,
    start: b.start_at,
    end: b.end_at,
    summary: `${b.service_name} at ${shopConfig.name}`,
    description: `Booking at ${shopConfig.name}. Call ${shopConfig.phone} to change it.`,
  });
}
