"use client";

import { ChevronDown, ChevronUp, ImagePlus } from "lucide-react";
import { useState } from "react";
import { createUploadTarget, deletePhoto, movePhoto, registerPhoto, saveAlt } from "@/app/admin/gallery";
import { MAX_ALT } from "@/lib/gallery-form";
import { resizeForUpload } from "@/lib/image";
import type { Photo } from "@/lib/shop-data";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDelete, useSave } from "./Settings";
import { btn, field } from "./ui";

const primary = `${btn} bg-primary text-primary-foreground`;
const quiet = `${btn} border border-border bg-card`;
type Upload = { key: number; name: string; state: "busy" | "done" | "error"; text: string };
const FAILED: Record<string, string> = {
  forbidden: "Only the shop owner can add photos.",
  not_photo: "That file is not a photo.",
};

// One photo end to end: shrink on the phone, get a one-off upload slot, upload, then publish.
async function addOne(file: File, say: (text: string) => void) {
  say("Preparing…");
  const blob = await resizeForUpload(file);
  say("Uploading…");
  const target = await createUploadTarget();
  if ("error" in target) throw new Error(FAILED[target.error] ?? "Could not upload. Try again.");
  const { error } = await createClient().storage.from("gallery").uploadToSignedUrl(target.path, target.token, blob, {
    contentType: "image/jpeg",
  });
  if (error) throw new Error("Could not upload. Check your signal and try again.");
  const r = await registerPhoto({ path: target.path, alt: "" });
  if ("error" in r) throw new Error(FAILED[r.error] ?? "Could not upload. Try again.");
}

export function GalleryManager({ photos }: { photos: Photo[] }) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const busy = uploads.some((u) => u.state === "busy");

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = ""; // picking the same photo again still fires change
    const base = Date.now();
    const batch = files.map((f, i) => ({ key: base + i, name: f.name, state: "busy" as const, text: "Waiting…" }));
    setUploads(batch);
    const set = (key: number, state: Upload["state"], text: string) =>
      setUploads((all) => all.map((u) => (u.key === key ? { ...u, state, text } : u)));
    // one at a time: a phone decoding several 12MP photos at once can run out of memory
    for (const [i, f] of files.entries()) {
      const key = batch[i].key;
      try {
        await addOne(f, (text) => set(key, "busy", text));
        set(key, "done", "Added");
      } catch (err) {
        set(key, "error", err instanceof Error ? err.message : "Could not upload. Try again.");
      }
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl leading-tight">Gallery</h1>
          <p className="text-sm text-muted-foreground">{photos.length === 1 ? "1 photo" : `${photos.length} photos`}</p>
        </div>
        <label className={`${primary} cursor-pointer gap-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${busy ? "pointer-events-none opacity-50" : ""}`}>
          <ImagePlus aria-hidden className="size-5" />
          Add photos
          <input type="file" accept="image/*" multiple disabled={busy} onChange={pick} className="sr-only" />
        </label>
      </div>
      <p className="text-sm text-muted-foreground">
        Photos show on the home page in this order. They are shrunk on your phone before uploading, and location data is removed.
      </p>

      {uploads.length > 0 && (
        <ul aria-label="Uploads" aria-live="polite" className="grid gap-1 rounded-xl border border-border bg-card p-3 text-sm">
          {uploads.map((u) => (
            <li key={u.key} className={u.state === "error" ? "text-destructive" : u.state === "done" ? "text-primary" : "text-muted-foreground"}>
              <span className="break-all">{u.name}</span>: {u.text}
            </li>
          ))}
        </ul>
      )}

      {photos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-muted-foreground">
          No photos yet. Add a few recent cuts and they will appear on the home page straight away.
        </p>
      ) : (
        <ul aria-label="Photos" className="grid gap-3">
          {photos.map((p, i) => (
            <PhotoRow key={p.id} p={p} n={i + 1} last={i === photos.length - 1} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PhotoRow({ p, n, last }: { p: Photo; n: number; last: boolean }) {
  const order = useSave("That photo has changed. Reload the page.");
  const alt = useSave(`Keep the description under ${MAX_ALT} characters.`);
  const pending = order.pending || alt.pending;
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = String(new FormData(e.currentTarget).get("alt"));
    alt.run(() => saveAlt({ id: p.id, alt: text }), "Saved.");
  }
  return (
    <li className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start gap-3">
        <span aria-hidden className="w-6 pt-1 text-right font-heading text-2xl text-primary lining-nums">{n}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.url} alt={p.alt} loading="lazy" decoding="async" className="aspect-[4/5] w-24 shrink-0 rounded-md bg-background object-cover" />
        <p className={`min-w-0 flex-1 break-words text-sm ${p.alt ? "" : "text-muted-foreground"}`}>{p.alt || "No description yet"}</p>
        <div className="grid gap-2">
          <button type="button" aria-label={`Move photo ${n} up`} disabled={pending || n === 1}
            onClick={() => order.run(() => movePhoto({ id: p.id, dir: -1 }), "Order saved.")} className={`${quiet} size-12 px-0`}>
            <ChevronUp aria-hidden className="size-5" />
          </button>
          <button type="button" aria-label={`Move photo ${n} down`} disabled={pending || last}
            onClick={() => order.run(() => movePhoto({ id: p.id, dir: 1 }), "Order saved.")} className={`${quiet} size-12 px-0`}>
            <ChevronDown aria-hidden className="size-5" />
          </button>
        </div>
      </div>
      {order.out}
      <div className="flex flex-wrap items-start gap-2">
        <details className="min-w-0 flex-1">
          <summary className="flex min-h-12 cursor-pointer items-center text-primary">Describe this photo</summary>
          <form onSubmit={submit} className="mt-2 grid gap-2">
            <label className="block text-sm text-muted-foreground">
              Description
              <input name="alt" maxLength={MAX_ALT} defaultValue={p.alt} placeholder="e.g. Skin fade with a beard trim" className={field} />
            </label>
            <button disabled={pending} className={primary}>Save description</button>
            {alt.out}
          </form>
        </details>
        <ConfirmDelete label="Delete" what={`photo ${n}`} pending={pending}
          onConfirm={() => order.run(() => deletePhoto(p.id), "Deleted.")} />
      </div>
    </li>
  );
}
