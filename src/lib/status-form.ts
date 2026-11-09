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

// Partial update: a state tap sends only `state`, "Save note" only `note`, so neither can overwrite the other
// with a stale client-side copy. At least one key is required.
export function parseSetStatus(input: unknown) {
  const o = obj(input);
  if (!o) return null;
  const out: { state?: Status["state"]; note?: string | null } = {};
  if (o.state !== undefined) {
    if (!STATES.includes(o.state as Status["state"])) return null;
    out.state = o.state as Status["state"];
  }
  if (o.note !== undefined) {
    if (typeof o.note !== "string") return null;
    const note = o.note.trim();
    if (note.length > MAX_NOTE) return null;
    out.note = note || null;
  }
  return out.state === undefined && out.note === undefined ? null : out;
}
