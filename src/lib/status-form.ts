import type { Status } from "./shop-data";

// Trust boundary for the live-status actions: malformed input becomes null, never an exception.
export const MAX_NOTE = 80;
const STATES = ["open", "busy", "closed"] as const;

const obj = (input: unknown) => (input && typeof input === "object" ? (input as Record<string, unknown>) : null);

export function parseBump(input: unknown) {
  const o = obj(input);
  if (!o || (o.field !== "in_shop" && o.field !== "waiting") || (o.delta !== 1 && o.delta !== -1)) return null;
  return { field: o.field, delta: o.delta };
}

export function parseSetStatus(input: unknown) {
  const o = obj(input);
  if (!o || !STATES.includes(o.state as Status["state"]) || typeof o.note !== "string") return null;
  const note = o.note.trim();
  if (note.length > MAX_NOTE) return null;
  return { state: o.state as Status["state"], note: note || null };
}
