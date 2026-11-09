"use server";
// Owner check FIRST (layouts do not guard actions), then trust-boundary parsing; failures are returned, not thrown.
// Upload design: the browser never gets a general write path. createUploadTarget mints the object name server-side
// (random uuid, never the client filename) and returns a one-path signed upload token; the browser PUTs the resized
// JPEG there; registerPhoto then checks the stored object really is a small JPEG before the row goes public.
// Storage RLS (005_storage.sql) and the bucket's 5MB / image-mime limits are the backstop if any of this is bypassed.

import { refresh, updateTag } from "next/cache";
import { NotOwnerError, requireOwner } from "@/lib/auth";
import { parseEdit, parseId, parseMove, parseRegister } from "@/lib/gallery-form";
import { TAGS } from "@/lib/shop-data";
import { createClient } from "@/lib/supabase/server";

type Fail = { error: "forbidden" | "invalid" | "not_photo" | "failed" };
export type GalleryResult = { ok: true } | Fail;
const MAX_BYTES = 5 * 1024 * 1024; // same as the bucket limit

async function isOwner() {
  try {
    await requireOwner();
    return true;
  } catch (e) {
    if (e instanceof NotOwnerError) return false;
    throw e; // signed out: requireOwner's redirect
  }
}

function done(error: unknown): GalleryResult {
  if (error) return { error: "failed" };
  updateTag(TAGS.gallery);
  refresh();
  return { ok: true };
}

export async function createUploadTarget(): Promise<{ ok: true; path: string; token: string } | Fail> {
  if (!(await isOwner())) return { error: "forbidden" };
  const path = `gallery/${crypto.randomUUID()}.jpg`;
  const db = await createClient();
  const { data, error } = await db.storage.from("gallery").createSignedUploadUrl(path);
  return error ? { error: "failed" } : { ok: true, path, token: data.token };
}

export async function registerPhoto(input: unknown): Promise<GalleryResult> {
  if (!(await isOwner())) return { error: "forbidden" };
  const args = parseRegister(input);
  if (!args) return { error: "invalid" };
  const db = await createClient();
  const bucket = db.storage.from("gallery");
  const { data: dupe } = await db.from("gallery").select("id").eq("storage_path", args.path).limit(1);
  if (dupe?.length) return { error: "invalid" };
  const { data: blob, error } = await bucket.download(args.path);
  if (error || !blob) return { error: "invalid" }; // never uploaded
  const head = new Uint8Array(await blob.slice(0, 3).arrayBuffer());
  if (blob.size > MAX_BYTES || head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) {
    await bucket.remove([args.path]);
    return { error: "not_photo" };
  }
  const { data: last } = await db.from("gallery").select("sort").order("sort", { ascending: false }).limit(1);
  const { error: e } = await db.from("gallery").insert({ storage_path: args.path, alt: args.alt, sort: (last?.[0]?.sort ?? 0) + 1 });
  return done(e);
}

export async function saveAlt(input: unknown): Promise<GalleryResult> {
  if (!(await isOwner())) return { error: "forbidden" };
  const args = parseEdit(input);
  if (!args) return { error: "invalid" };
  const db = await createClient();
  const { data, error } = await db.from("gallery").update({ alt: args.alt }).eq("id", args.id).select("id");
  if (!error && !data.length) return { error: "invalid" };
  return done(error);
}

// Row first, so the public page never points at a missing file; a leftover object is only wasted space.
export async function deletePhoto(input: unknown): Promise<GalleryResult> {
  if (!(await isOwner())) return { error: "forbidden" };
  const id = parseId(input);
  if (!id) return { error: "invalid" };
  const db = await createClient();
  const { data, error } = await db.from("gallery").delete().eq("id", id).select("storage_path");
  if (error) return { error: "failed" };
  if (!data.length) return { error: "invalid" };
  const { error: e } = await db.storage.from("gallery").remove(data.map((r) => r.storage_path)); // a missing object is not an error
  if (e) console.error("gallery: photo row deleted but object remains", data[0].storage_path, e.message);
  return done(null);
}

export async function movePhoto(input: unknown): Promise<GalleryResult> {
  if (!(await isOwner())) return { error: "forbidden" };
  const args = parseMove(input);
  if (!args) return { error: "invalid" };
  const db = await createClient();
  const { error } = await db.rpc("move_gallery_photo", { p_id: args.id, p_dir: args.dir });
  return done(error);
}
