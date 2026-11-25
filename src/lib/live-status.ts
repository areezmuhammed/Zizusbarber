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
    manual_date: typeof o.manual_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.manual_date) ? o.manual_date : null,
  };
}

export type LiveDeps = {
  /** Opens a realtime subscription (`id` is unique per call, for a unique channel name); reports each channel state (true = subscribed). Returns the teardown. */
  subscribe: (onRow: (row: unknown) => void, onState: (subscribed: boolean) => void, id: number) => () => void;
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
  // Bumped on every Realtime row: a fetch that started earlier is stale and must not overwrite the newer state.
  let seq = 0;
  const refetch = () => {
    const s = seq;
    return d.fetchRow().then((r) => s === seq && push(r), () => {});
  };
  // Every connection has a generation; callbacks from a superseded or stopped one are ignored.
  let gen = 0;
  const connect = () => {
    unsub?.();
    const g = ++gen;
    unsub = d.subscribe(
      (r) => {
        if (g !== gen) return;
        seq++;
        push(r);
      },
      (ok) => {
        if (stopped || g !== gen) return;
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
      },
      g,
    );
  };
  connect();
  return () => {
    stopped = true;
    gen++;
    if (timer !== null) clearI(timer);
    unsub?.();
  };
}
