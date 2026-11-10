import { createClient as createSupabase, type SupabaseClient } from "@supabase/supabase-js";

export type BookingArgs = { serviceId: string; startAt: Date; name: string; phone: string; email?: string };
export type BookingResult = { ok: true; token: string } | { ok: false; reason: "taken" | "too_many" | "busy" | "invalid" };

const REASONS: Record<string, "taken" | "too_many" | "busy"> = { slot_taken: "taken", too_many_bookings: "too_many", busy: "busy" };

export async function createBooking(args: BookingArgs, client?: SupabaseClient): Promise<BookingResult> {
  const db = client ?? createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await db.rpc("create_booking", {
    p_service: args.serviceId,
    p_start: args.startAt.toISOString(),
    p_name: args.name,
    p_phone: args.phone,
    p_email: args.email ?? "",
  });
  if (error) return { ok: false, reason: REASONS[error.message] ?? "invalid" };
  const row = Array.isArray(data) ? data[0] : data;
  return row?.cancel_token ? { ok: true, token: row.cancel_token } : { ok: false, reason: "invalid" };
}
