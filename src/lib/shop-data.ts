import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import type { Closure } from "./booking-form";

// Settings actions call updateTag(TAGS.x) after a write so the public pages show it on the next request.
export const TAGS = { services: "services", hours: "hours", closures: "closures", gallery: "gallery", status: "status" } as const;

export type Service = { id: string; name: string; price_pence: number; duration_min: number };
export type Hours = { weekday: number; open_local: string; close_local: string };
export type Photo = { id: string; url: string; alt: string };
export type Status = { state: "open" | "busy" | "closed"; in_shop: number; waiting: number; note: string | null; manual_date: string | null };

// Public data is read with the anon key and no cookies, so it can live in a shared cache.
const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

export async function getServices(): Promise<Service[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.services);
  return must(
    await db().from("services").select("id,name,price_pence,duration_min").eq("active", true).order("sort").order("name"),
  );
}

// Shop-wide hours only (barber_id null); weekday 0 = Sunday.
export async function getHours(): Promise<Hours[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.hours);
  return must(
    await db()
      .from("opening_hours")
      .select("weekday,open_local,close_local")
      .is("barber_id", null)
      .order("weekday")
      .order("open_local"),
  );
}

export async function getGallery(): Promise<Photo[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.gallery);
  const client = db();
  const rows: { id: string; storage_path: string; alt: string }[] = must(
    await client.from("gallery").select("id,storage_path,alt").order("sort").order("created_at"),
  );
  return rows.map((r) => ({
    id: r.id,
    alt: r.alt,
    url: client.storage.from("gallery").getPublicUrl(r.storage_path).data.publicUrl,
  }));
}

export async function getStatus(): Promise<Status | null> {
  "use cache";
  cacheLife("seconds");
  cacheTag(TAGS.status);
  return must(await db().from("shop_status").select("state,in_shop,waiting,note,manual_date").maybeSingle());
}

// Closures on or after a London date; `from` is the cache key, so the list rolls over daily.
export async function getClosures(from: string): Promise<(Closure & { reason: string | null })[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.closures);
  return must(await db().from("closures").select("date,reason,open_local,close_local").gte("date", from).order("date"));
}
