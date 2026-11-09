import type { Status } from "./shop-data";

export const POLL_MS = 30_000;

export function toStatus(v: unknown): Status | null {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  if (!o || !["open", "busy", "closed"].includes(o.state as string)) return null;
  if (!Number.isInteger(o.in_shop) || !Number.isInteger(o.waiting)) return null;
  return {
    state: o.state as Status["state"],
    in_shop: o.in_shop as number,
    waiting: o.waiting as number,
    note: typeof o.note === "string" && o.note ? o.note : null,
  };
}

export type LiveDeps = {
  /** Opens a realtime subscription; reports each channel state (true = subscribed). Returns the teardown. */
  subscribe: (onRow: (row: unknown) => void, onState: (subscribed: boolean) => void) => () => void;
  fetchRow: () => Promise<unknown>;
  onStatus: (s: Status) => void;
  pollMs?: number;
  setInterval?: (fn: () => void, ms: number) => unknown;
  clearInterval?: (id: unknown) => void;
};

/** Realtime first; while the subscription is down, poll every 30s and retry subscribing. Returns the stop function. */
export function startLive(d: LiveDeps) {
  const setI = d.setInterval ?? ((fn, ms) => globalThis.setInterval(fn, ms));
  const clearI = d.clearInterval ?? ((id) => globalThis.clearInterval(id as never));
  let stopped = false;
  let timer: unknown = null;
  let unsub: (() => void) | null = null;

  const push = (row: unknown) => {
    const s = toStatus(row);
    if (s && !stopped) d.onStatus(s);
  };
  const refetch = () => d.fetchRow().then(push, () => {});
  const connect = () => {
    unsub?.();
    unsub = d.subscribe(push, (ok) => {
      if (stopped) return;
      if (ok) {
        if (timer !== null) clearI(timer);
        timer = null;
        void refetch(); // closes the gap since the (cached) server render
      } else if (timer === null) {
        void refetch();
        timer = setI(() => {
          void refetch();
          connect();
        }, d.pollMs ?? POLL_MS);
      }
    });
  };
  connect();
  return () => {
    stopped = true;
    if (timer !== null) clearI(timer);
    unsub?.();
  };
}
