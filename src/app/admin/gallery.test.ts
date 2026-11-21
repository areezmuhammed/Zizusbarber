import { beforeEach, expect, it, vi } from "vitest";

const { createClient, updateTag } = vi.hoisted(() => ({ createClient: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireOwner: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/cache", () => ({ refresh: vi.fn(), updateTag }));

import { registerPhoto } from "./gallery";

const id = "0f8fad5b-d9cb-469f-a165-70867728950e";
const path = `gallery/${id}.jpg`;
const onePixelJpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/" +
  "wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AP7//2Q==",
  "base64",
);

function registration(blob: Blob | null, insertError: Error | null = null) {
  const bucket = {
    download: vi.fn().mockResolvedValue({ data: blob, error: blob ? null : new Error("Object missing") }),
    remove: vi.fn().mockResolvedValue({ error: null }),
  };
  const limit = vi.fn().mockResolvedValue({ data: [] });
  const query = {
    select: () => ({ eq: () => ({ limit }), order: () => ({ limit }) }),
    insert: vi.fn().mockResolvedValue({ error: insertError }),
  };
  createClient.mockResolvedValue({ storage: { from: () => bucket }, from: () => query });
  return { bucket, insert: query.insert };
}

beforeEach(() => vi.clearAllMocks());

it("does not publish a photo if upload never reached Storage", async () => {
  const { insert } = registration(null);
  await expect(registerPhoto({ path, alt: "Hair cut" })).resolves.toEqual({ error: "invalid" });
  expect(insert).not.toHaveBeenCalled();
  expect(updateTag).not.toHaveBeenCalled();
});

it.each([
  ["a non-image", () => new Blob(["plain text"], { type: "image/jpeg" })],
  ["an oversized JPEG", () => new Blob([new Uint8Array([0xff, 0xd8, 0xff]), new Uint8Array(5 * 1024 * 1024)])],
])("removes %s from Storage and skips the gallery insert", async (_, blob) => {
  const { bucket, insert } = registration(blob());
  await expect(registerPhoto({ path, alt: "Hair cut" })).resolves.toEqual({ error: "not_photo" });
  expect(bucket.remove).toHaveBeenCalledWith([path]);
  expect(insert).not.toHaveBeenCalled();
});

it("removes an uploaded object if the gallery insert fails", async () => {
  const jpeg = new Blob([new Uint8Array(onePixelJpeg)], { type: "image/jpeg" });
  const { bucket, insert } = registration(jpeg, new Error("Insert failed"));
  await expect(registerPhoto({ path, alt: "Hair cut" })).resolves.toEqual({ error: "failed" });
  expect(insert).toHaveBeenCalledWith({ storage_path: path, alt: "Hair cut", sort: 1 });
  expect(bucket.remove).toHaveBeenCalledWith([path]);
});
