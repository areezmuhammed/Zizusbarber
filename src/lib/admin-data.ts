import { requireOwner } from "./auth";
import { createClient } from "./supabase/server";
import { addLondonDays, londonToUtc } from "./time";

export type DayBooking = {
  id: string; name: string; phone: string; service: string; start: string; end: string;
  status: "pending" | "confirmed" | "arrived" | "done" | "no_show";
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
      .select("id,customer_name,phone,start_at,end_at,status,services(name)")
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
      id: r.id, name: r.customer_name, phone: r.phone, start: r.start_at, end: r.end_at, status: r.status,
      service: (r.services as unknown as { name: string } | null)?.name ?? "",
    })),
    services: s.data,
  };
}
