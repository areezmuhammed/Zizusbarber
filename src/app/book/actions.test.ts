import { beforeEach, describe, expect, it, vi } from "vitest";

const createBooking = vi.fn();
const getServices = vi.fn();
const getHours = vi.fn();
vi.mock("@/lib/booking", () => ({ createBooking }));
vi.mock("@/lib/shop-data", () => ({ getServices, getHours, getClosures: async () => [] }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc: async () => ({ data: [], error: null }) }) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const { book, getTimes } = await import("./actions");

const good = {
  serviceId: "8f1c2a34-5b6d-4e7f-8a9b-0c1d2e3f4a5b",
  start: "2026-11-13T10:45:00.000Z",
  name: "Sam",
  phone: "07700 900123",
  email: "",
};

it("does not advertise slots after the public 90-day booking horizon", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
  try {
    getServices.mockResolvedValue([{ id: good.serviceId, duration_min: 30 }]);
    getHours.mockResolvedValue([{ weekday: 4, open_local: "09:30:00", close_local: "10:15:00" }]);
    await expect(getTimes(good.serviceId, "2026-04-02")).resolves.toEqual([]);
  } finally {
    vi.useRealTimers();
  }
});

describe("book action trust boundary", () => {
  beforeEach(() => createBooking.mockReset().mockResolvedValue({ ok: false, reason: "invalid" }));

  it.each([
    ["non-string name", { ...good, name: 42 }],
    ["oversize name", { ...good, name: "a".repeat(101) }],
    ["oversize phone", { ...good, phone: "0".repeat(31) }],
    ["oversize email", { ...good, email: `${"a".repeat(250)}@b.co` }],
    ["bad serviceId", { ...good, serviceId: "1; drop table" }],
    ["bad start", { ...good, start: "not a date" }],
    ["nonexistent calendar date", { ...good, start: "2027-02-29T10:45:00Z" }],
    ["not an object", "hello"],
  ])("%s returns details error and never reaches the RPC", async (_, input) => {
    await expect(book(input)).resolves.toEqual({ error: "details" });
    expect(createBooking).not.toHaveBeenCalled();
  });

  it("passes too_many through for the friendly message", async () => {
    createBooking.mockResolvedValue({ ok: false, reason: "too_many" });
    await expect(book(good)).resolves.toEqual({ error: "too_many" });
  });

  it("passes busy through for the friendly message", async () => {
    createBooking.mockResolvedValue({ ok: false, reason: "busy" });
    await expect(book(good)).resolves.toEqual({ error: "busy" });
  });

  it("passes normalised args to createBooking and maps taken", async () => {
    createBooking.mockResolvedValue({ ok: false, reason: "taken" });
    await expect(book(good)).resolves.toEqual({ error: "taken" });
    expect(createBooking).toHaveBeenCalledWith({
      serviceId: good.serviceId,
      startAt: new Date(good.start),
      name: "Sam",
      phone: "+447700900123",
      email: undefined,
    });
  });
});
