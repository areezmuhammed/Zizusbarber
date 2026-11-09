"use server";
// Owner check FIRST (layouts do not guard actions), then trust-boundary parsing; failures are returned, not thrown.
// Writes use the owner's cookie client so RLS (owner_write) stays the enforcer. Each write expires the public
// cache tag with updateTag (read-your-own-writes): home, JSON-LD and /book show the change on the next request.
// Existing bookings keep their stored start/end: nothing here touches the bookings table.

import { refresh, updateTag } from "next/cache";
import { NotOwnerError, requireOwner } from "@/lib/auth";
import { parseClosure, parseHours, parseId, parseService } from "@/lib/settings-form";
import { TAGS } from "@/lib/shop-data";
import { createClient } from "@/lib/supabase/server";
import { utcToLondon } from "@/lib/time";

export type SettingsResult = { ok: true } | { error: "forbidden" | "invalid" | "in_use" | "exists" | "failed" };

async function isOwner() {
  try {
    await requireOwner();
    return true;
  } catch (e) {
    if (e instanceof NotOwnerError) return false;
    throw e; // signed out: requireOwner's redirect
  }
}

function done(error: { code?: string } | null, tag: string): SettingsResult {
  if (error) return { error: error.code === "23503" ? "in_use" : error.code === "23505" ? "exists" : "failed" };
  updateTag(tag);
  refresh();
  return { ok: true };
}

export async function saveService(input: unknown): Promise<SettingsResult> {
  if (!(await isOwner())) return { error: "forbidden" };
  const s = parseService(input);
  if (!s) return { error: "invalid" };
  const db = await createClient();
  const { id, ...row } = s;
  if (id) {
    const { data, error } = await db.from("services").update(row).eq("id", id).select("id");
    if (!error && !data.length) return { error: "failed" };
    return done(error, TAGS.services);
  }
  const { data: last } = await db.from("services").select("sort").order("sort", { ascending: false }).limit(1);
  const { error } = await db.from("services").insert({ ...row, sort: (last?.[0]?.sort ?? 0) + 1 });
  return done(error, TAGS.services);
}

// Hard delete only when no booking references it (FK -> "in_use"); otherwise the owner hides it instead.
export async function deleteService(input: unknown): Promise<SettingsResult> {
  if (!(await isOwner())) return { error: "forbidden" };
  const id = parseId(input);
  if (!id) return { error: "invalid" };
  const db = await createClient();
  const { error } = await db.from("services").delete().eq("id", id);
  return done(error, TAGS.services);
}

// Swaps the service with its neighbour and renumbers sort 1..n.
export async function moveService(input: unknown): Promise<SettingsResult> {
  if (!(await isOwner())) return { error: "forbidden" };
  const o = input as { id?: unknown; dir?: unknown } | null;
  const id = parseId(o?.id);
  if (!id || (o?.dir !== -1 && o?.dir !== 1)) return { error: "invalid" };
  const db = await createClient();
  const { data, error } = await db.from("services").select("id,sort").order("sort").order("name");
  if (error) return { error: "failed" };
  const i = data.findIndex((s) => s.id === id);
  const j = i + o.dir;
  if (i < 0 || j < 0 || j >= data.length) return { error: "invalid" };
  [data[i], data[j]] = [data[j], data[i]];
  for (const [k, s] of data.entries()) {
    if (s.sort === k + 1) continue;
    const { error: e } = await db.from("services").update({ sort: k + 1 }).eq("id", s.id);
    if (e) return done(e, TAGS.services);
  }
  return done(null, TAGS.services);
}

// Shop-wide hours for one weekday; closed = no row.
export async function saveHours(input: unknown): Promise<SettingsResult> {
  if (!(await isOwner())) return { error: "forbidden" };
  const h = parseHours(input);
  if (!h) return { error: "invalid" };
  const db = await createClient();
  const { error } = h.open
    ? await db
        .from("opening_hours")
        .upsert({ barber_id: null, weekday: h.weekday, open_local: h.open, close_local: h.close }, { onConflict: "barber_id,weekday" })
    : await db.from("opening_hours").delete().eq("weekday", h.weekday).is("barber_id", null);
  return done(error, TAGS.hours);
}

export async function addClosure(input: unknown): Promise<SettingsResult> {
  if (!(await isOwner())) return { error: "forbidden" };
  const c = parseClosure(input, utcToLondon(new Date()).toISODate()!);
  if (!c) return { error: "invalid" };
  const db = await createClient();
  const { error } = await db.from("closures").insert(c);
  return done(error, TAGS.closures);
}

export async function deleteClosure(input: unknown): Promise<SettingsResult> {
  if (!(await isOwner())) return { error: "forbidden" };
  const id = parseId(input);
  if (!id) return { error: "invalid" };
  const db = await createClient();
  const { error } = await db.from("closures").delete().eq("id", id);
  return done(error, TAGS.closures);
}
