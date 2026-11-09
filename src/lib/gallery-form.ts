import { UUID } from "./booking-form";

// Trust boundary for the gallery actions: anything malformed becomes null, never an exception.

export const MAX_ALT = 120;
// Only paths the server itself minted (createUploadTarget): bucket folder + lowercase uuid + .jpg.
export const PATH = /^gallery\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/;

const obj = (input: unknown) => (input && typeof input === "object" ? (input as Record<string, unknown>) : null);

export function parseAlt(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const alt = v.trim();
  return alt.length <= MAX_ALT ? alt : null;
}

export const parsePath = (v: unknown): string | null => (typeof v === "string" && PATH.test(v) ? v : null);
export const parseId = (v: unknown): string | null => (typeof v === "string" && UUID.test(v) ? v : null);

export function parseRegister(input: unknown) {
  const o = obj(input);
  const path = parsePath(o?.path);
  const alt = parseAlt(o?.alt);
  return path && alt !== null ? { path, alt } : null;
}

export function parseEdit(input: unknown) {
  const o = obj(input);
  const id = parseId(o?.id);
  const alt = parseAlt(o?.alt);
  return id && alt !== null ? { id, alt } : null;
}

export function parseMove(input: unknown) {
  const o = obj(input);
  const id = parseId(o?.id);
  return id && (o?.dir === -1 || o?.dir === 1) ? { id, dir: o.dir as -1 | 1 } : null;
}
