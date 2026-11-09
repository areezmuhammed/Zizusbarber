"use server";
// Server actions are public endpoints: each one checks the owner FIRST, then parses its input (typed unknown).
// Writes use the signed-in owner's client, so RLS (owner_all) and the RPCs' own is_owner() checks still apply.

import { refresh } from "next/cache";
import { parseLength, parseStatus, parseWalkIn } from "@/lib/admin-form";
import { NotOwnerError, requireOwner } from "@/lib/auth";
import { createBooking } from "@/lib/booking";
import { createClient } from "@/lib/supabase/server";

type Fail = { error: "forbidden" | "invalid" | "not_found" | "taken" | "rejected" | "failed" };
export type Affected = { id: string; name: string; start: string; end: string };
export type LengthResult = { ok: true; end: string; moved: Affected[] } | { ok: false; conflicts: Affected[] } | Fail;

const ACTIVE = ["pending", "confirmed", "arrived"];

async function isOwner() {
  try {
    await requireOwner();
    return true;
  } catch (e) {
    if (e instanceof NotOwnerError) return false;
    throw e; // signed out: requireOwner's redirect
  }
}

export async function setStatus(input: unknown): Promise<{ ok: true } | Fail> {
  if (!(await isOwner())) return { error: "forbidden" };
  const args = parseStatus(input);
  if (!args) return { error: "invalid" };
  const db = await createClient();
  // only active bookings change; a cancelled or finished one is never revived (it could overlap a newer booking)
  const { data, error } = await db
    .from("bookings")
    // cancelled_by 'shop' makes the "we had to cancel" notice due (customer self-cancel sets 'customer')
    .update(args.status === "cancelled" ? { status: args.status, cancelled_by: "shop" } : { status: args.status })
    .eq("id", args.id)
    .in("status", ACTIVE)
    .select("id");
  if (error) return { error: "failed" };
  if (!data.length) return { error: "not_found" };
  refresh();
  return { ok: true };
}

export async function changeLength(input: unknown): Promise<LengthResult> {
  if (!(await isOwner())) return { error: "forbidden" };
  const args = parseLength(input);
  if (!args) return { error: "invalid" };
  const db = await createClient();
  const { data: b } = await db.from("bookings").select("start_at,end_at").eq("id", args.id).maybeSingle();
  if (!b) return { error: "not_found" };
  const base = Date.parse(args.mode === "add" ? b.end_at : b.start_at);
  const end = new Date(base + args.minutes * 60_000).toISOString();
  const { data, error } = await db.rpc("extend_booking", {
    p_id: args.id,
    p_new_end: end,
    p_reason: "Appointment before yours ran longer",
  });
  if (error) {
    const m = error.message;
    return { error: m === "slot_taken" ? "taken" : m === "booking_not_found" ? "not_found" : "failed" };
  }
  const res = data as { ok: boolean; moved?: string[]; conflicts?: string[] };
  const ids = (res.ok ? res.moved : res.conflicts) ?? [];
  const { data: rows } = ids.length
    ? await db.from("bookings").select("id,customer_name,start_at,end_at").in("id", ids)
    : { data: [] };
  const list = ids.flatMap((i) => {
    const r = rows?.find((x) => x.id === i);
    return r ? [{ id: r.id, name: r.customer_name, start: r.start_at, end: r.end_at }] : [];
  });
  if (!res.ok) return { ok: false, conflicts: list };
  refresh();
  return { ok: true, end, moved: list };
}

export async function addBooking(input: unknown): Promise<{ ok: true } | Fail> {
  if (!(await isOwner())) return { error: "forbidden" };
  const args = parseWalkIn(input);
  if (!args) return { error: "invalid" };
  const result = await createBooking(args, await createClient());
  if (!result.ok) return { error: result.reason === "taken" ? "taken" : "rejected" };
  refresh();
  return { ok: true };
}
