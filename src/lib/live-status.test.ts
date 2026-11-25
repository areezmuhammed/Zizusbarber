import { describe, expect, it, vi } from "vitest";
import { startLive, toStatus } from "./live-status";

const row = (n: number) => ({ state: "open", in_shop: n, waiting: 0, note: null, manual_date: null });

function harness() {
  let tick: (() => void) | null = null;
  const states: ((ok: boolean) => void)[] = [];
  const rows: ((r: unknown) => void)[] = [];
  const unsubs: ReturnType<typeof vi.fn>[] = [];
  const seen: number[] = [];
  const ids: number[] = [];
  let db = 0;
  const stop = startLive({
    subscribe: (onRow, onState, id) => {
      ids.push(id);
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
  return { stop, ids, states, rows, unsubs, seen, tick: () => tick, setDb: (n: number) => (db = n) };
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
  it("keeps a newer Realtime change when an older status fetch finishes late", async () => {
    let receive: (value: unknown) => void = () => {};
    const fetched = Promise.withResolvers<unknown>();
    const onStatus = vi.fn();
    const stop = startLive({
      subscribe: (onRow, onState) => {
        receive = onRow;
        onState(true);
        return () => {};
      },
      fetchRow: () => fetched.promise,
      onStatus,
    });
    const closed = { ...row(0), state: "closed" };
    try {
      receive(closed);
      fetched.resolve(row(0));
      await fetched.promise;
      expect(onStatus).toHaveBeenLastCalledWith(closed);
    } finally {
      stop();
    }
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

  it("a stale CLOSED from a superseded channel does not start polling or tear down the healthy one", async () => {
    const h = harness();
    h.states[0](false); // gen 1 fails, polling starts
    h.tick()!(); // retry -> gen 2
    h.states[1](true); // healthy, polling stops
    expect(h.tick()).toBeNull();
    h.states[0](false); // late CLOSED from the old channel
    h.rows[0](row(99)); // and a late row
    await flush();
    expect(h.tick()).toBeNull();
    expect(h.states).toHaveLength(2);
    expect(h.unsubs[1]).not.toHaveBeenCalled();
    expect(h.seen).not.toContain(99);
  });
  it("retries use a new channel id each time", () => {
    const h = harness();
    h.states[0](false);
    h.tick()!();
    h.states[1](false);
    h.tick()!();
    expect(new Set(h.ids).size).toBe(3);
  });
  it("a StrictMode-style start/stop/start leaves one live channel and ignores the first", async () => {
    const first = harness();
    first.stop();
    const second = harness();
    second.states[0](true);
    first.states[0](false);
    first.rows[0](row(5));
    await flush();
    expect(first.unsubs[0]).toHaveBeenCalledTimes(1);
    expect(second.unsubs[0]).not.toHaveBeenCalled();
    expect(first.seen).toEqual([]);
  });
});
