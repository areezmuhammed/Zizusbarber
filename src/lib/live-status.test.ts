import { describe, expect, it, vi } from "vitest";
import { startLive, toStatus } from "./live-status";

const row = (n: number) => ({ state: "open", in_shop: n, waiting: 0, note: null });

function harness() {
  let tick: (() => void) | null = null;
  const states: ((ok: boolean) => void)[] = [];
  const rows: ((r: unknown) => void)[] = [];
  const unsubs: ReturnType<typeof vi.fn>[] = [];
  const seen: number[] = [];
  let db = 0;
  const stop = startLive({
    subscribe: (onRow, onState) => {
      rows.push(onRow);
      states.push(onState);
      const u = vi.fn();
      unsubs.push(u);
      return u;
    },
    fetchRow: async () => row(db),
    onStatus: (s) => seen.push(s.in_shop),
    setInterval: (fn) => {
      tick = fn;
      return 1;
    },
    clearInterval: () => {
      tick = null;
    },
  });
  return { stop, states, rows, unsubs, seen, tick: () => tick, setDb: (n: number) => (db = n) };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("toStatus", () => {
  it("validates a row", () => {
    expect(toStatus({ ...row(2), extra: 1 })).toEqual(row(2));
    expect(toStatus({ ...row(1), state: "x" })).toBeNull();
    expect(toStatus({ ...row(1), in_shop: "1" })).toBeNull();
    expect(toStatus(null)).toBeNull();
  });
});

describe("startLive", () => {
  it("applies realtime rows and does not poll while subscribed", async () => {
    const h = harness();
    h.states[0](true);
    h.rows[0](row(3));
    await flush();
    expect(h.seen).toContain(3);
    expect(h.tick()).toBeNull();
  });
  it("polls and resubscribes when the subscription errors, stops polling once it recovers", async () => {
    const h = harness();
    h.states[0](false);
    expect(h.tick()).not.toBeNull();
    h.setDb(7);
    h.tick()!();
    await flush();
    expect(h.seen).toContain(7);
    expect(h.states).toHaveLength(2); // retried
    expect(h.unsubs[0]).toHaveBeenCalled();
    h.states[1](true);
    expect(h.tick()).toBeNull();
  });
  it("ignores everything after stop and tears down", async () => {
    const h = harness();
    h.stop();
    h.states[0](false);
    h.rows[0](row(9));
    await flush();
    expect(h.seen).toEqual([]);
    expect(h.unsubs[0]).toHaveBeenCalled();
  });
});
