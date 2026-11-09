"use server";

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createBooking } from "@/lib/booking";
import { dayHours, validateDetails, type Details } from "@/lib/booking-form";
import { getClosures, getHours, getServices } from "@/lib/shop-data";
import { generateSlots } from "@/lib/slots";
import { addLondonDays, londonToUtc } from "@/lib/time";

const STEP_MIN = 15;

// Free start times (UTC ISO) for a service on a London date. Display only: create_booking re-checks everything.
export async function getTimes(serviceId: string, date: string): Promise<string[]> {
  const dayStart = /^\d{4}-\d{2}-\d{2}$/.test(date) ? londonToUtc(date, "00:00") : null;
  const service = (await getServices()).find((s) => s.id === serviceId);
  if (!dayStart || !service) return [];
  const [allHours, closures] = await Promise.all([getHours(), getClosures(date)]);
  const hours = dayHours(date, allHours, closures);
  if (!hours) return [];
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data, error } = await db.rpc("get_busy", {
    p_from: dayStart.toISOString(),
    p_to: addLondonDays(dayStart, 1).toISOString(),
  });
  if (error) throw new Error(error.message);
  const busy = (data as { start_at: string; end_at: string }[]).map((b) => ({ start: new Date(b.start_at), end: new Date(b.end_at) }));
  return generateSlots({
    date,
    openLocal: hours.open,
    closeLocal: hours.close,
    durationMin: service.duration_min,
    stepMin: STEP_MIN,
    busy,
    closed: false,
    now: new Date(),
  }).map((d) => d.toISOString());
}

export type BookResult = { error: "taken" | "invalid" | "details" };

export async function book(input: { serviceId: string; start: string } & Details): Promise<BookResult> {
  const startAt = new Date(input.start);
  if (Object.keys(validateDetails(input)).length || Number.isNaN(startAt.getTime())) return { error: "details" };
  const result = await createBooking({
    serviceId: input.serviceId,
    startAt,
    name: input.name.trim(),
    phone: input.phone.trim(),
    email: input.email.trim() || undefined,
  });
  if (!result.ok) return { error: result.reason };
  redirect(`/booking/${result.token}`);
}
