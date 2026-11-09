import { requireOwner } from "./auth";
import { createClient } from "./supabase/server";
import { addLondonDays, londonToUtc } from "./time";

export type DayBooking = {
  id: string; name: string; phone: string; service: string; start: string; end: string;
  status: "pending" | "confirmed" | "arrived" | "done" | "no_show"; remindersOff: boolean;
};
export type AdminService = { id: string; name: string; duration_min: number };

// A London day's bookings (cancelled hidden) and the active services. Owner only.
export async function getDay(date: string): Promise<{ bookings: DayBooking[]; services: AdminService[] }> {
  await requireOwner();
  const from = londonToUtc(date, "00:00")!;
  const db = await createClient();
  const [b, s] = await Promise.all([
    db
      .from("bookings")
      .select("id,customer_name,phone,start_at,end_at,status,reminders_off,services(name)")
      .gte("start_at", from.toISOString())
      .lt("start_at", addLondonDays(from, 1).toISOString())
      .neq("status", "cancelled")
      .order("start_at"),
    db.from("services").select("id,name,duration_min").eq("active", true).order("sort"),
  ]);
  if (b.error) throw new Error(b.error.message);
  if (s.error) throw new Error(s.error.message);
  return {
    bookings: b.data.map((r) => ({
      id: r.id, name: r.customer_name, phone: r.phone, start: r.start_at, end: r.end_at, status: r.status, remindersOff: r.reminders_off,
      service: (r.services as unknown as { name: string } | null)?.name ?? "",
    })),
    services: s.data,
  };
}

export type SettingsService = { id: string; name: string; price_pence: number; duration_min: number; active: boolean };
export type SettingsHours = { weekday: number; open_local: string; close_local: string };
export type SettingsClosure = { id: string; date: string; reason: string | null; open_local: string | null; close_local: string | null };

// Everything the settings page edits: all services (hidden ones too), shop-wide hours, closures from `today`. Owner only.
export async function getSettings(today: string) {
  await requireOwner();
  const db = await createClient();
  const [s, h, c] = await Promise.all([
    db.from("services").select("id,name,price_pence,duration_min,active").order("sort").order("name"),
    db.from("opening_hours").select("weekday,open_local,close_local").is("barber_id", null),
    db.from("closures").select("id,date,reason,open_local,close_local").gte("date", today).order("date"),
  ]);
  for (const r of [s, h, c]) if (r.error) throw new Error(r.error.message);
  return {
    services: s.data as SettingsService[],
    hours: h.data as SettingsHours[],
    closures: c.data as SettingsClosure[],
  };
}
