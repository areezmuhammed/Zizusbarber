"use server";
// Owner check FIRST (layouts do not guard actions), then trust-boundary parsing; failures are returned, not thrown.
// Counts change through an RPC that applies the delta in SQL, so rapid taps never overwrite each other.

import { NotOwnerError, requireOwner } from "@/lib/auth";
import type { Status } from "@/lib/shop-data";
import { parseBump, parseSetStatus } from "@/lib/status-form";
import { updateTag } from "next/cache";
import { TAGS } from "@/lib/shop-data";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; status: Status } | { error: "forbidden" | "invalid" | "failed" };

async function isOwner() {
  try {
    await requireOwner();
    return true;
  } catch (e) {
    if (e instanceof NotOwnerError) return false;
    throw e; // signed out: requireOwner's redirect
  }
}

// Called only after a successful write, so the next public render shows the new status (read-your-own-writes).
async function current(db: Awaited<ReturnType<typeof createClient>>): Promise<Result> {
  updateTag(TAGS.status);
  const { data, error } = await db.from("shop_status").select("state,in_shop,waiting,note").single();
  return error ? { error: "failed" } : { ok: true, status: data as Status };
}

export async function bumpCount(input: unknown): Promise<Result> {
  if (!(await isOwner())) return { error: "forbidden" };
  const args = parseBump(input);
  if (!args) return { error: "invalid" };
  const db = await createClient();
  const { error } = await db.rpc("bump_shop_status", { p_field: args.field, p_delta: args.delta });
  return error ? { error: "failed" } : current(db);
}

export async function saveStatus(input: unknown): Promise<Result> {
  if (!(await isOwner())) return { error: "forbidden" };
  const args = parseSetStatus(input);
  if (!args) return { error: "invalid" };
  const db = await createClient();
  const { error } = await db.from("shop_status").update({ ...args, updated_at: new Date().toISOString() }).eq("id", true);
  return error ? { error: "failed" } : current(db);
}
