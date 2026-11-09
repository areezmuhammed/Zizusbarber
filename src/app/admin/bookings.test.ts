import { beforeEach, describe, expect, it, vi } from "vitest";

class NotOwnerError extends Error {}
const requireOwner = vi.fn();
const createClient = vi.fn();
const createBooking = vi.fn();
vi.mock("@/lib/auth", () => ({ requireOwner, NotOwnerError }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/booking", () => ({ createBooking }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const { addBooking, changeLength, setStatus } = await import("./bookings");

const id = "8f1c2a34-5b6d-4e7f-8a9b-0c1d2e3f4a5b";
const calls = [
  ["setStatus", () => setStatus({ id, status: "done" })],
  ["changeLength", () => changeLength({ id, mode: "add", minutes: 10 })],
  ["addBooking", () => addBooking({ serviceId: id, date: "2031-06-03", time: "15:00", name: "Walk", phone: "07700 900111" })],
] as const;

describe("admin booking actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOwner.mockResolvedValue({ id: "owner" });
  });

  it.each(calls)("%s refuses a non-owner before touching the database", async (_, call) => {
    requireOwner.mockRejectedValue(new NotOwnerError("not an owner"));
    await expect(call()).resolves.toEqual({ error: "forbidden" });
    expect(createClient).not.toHaveBeenCalled();
    expect(createBooking).not.toHaveBeenCalled();
  });

  it("lets other errors (e.g. the signed-out redirect) propagate", async () => {
    requireOwner.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(setStatus({ id, status: "done" })).rejects.toThrow("NEXT_REDIRECT");
  });

  it.each([
    ["setStatus", () => setStatus({ id, status: "confirmed" })],
    ["changeLength", () => changeLength({ id, mode: "add", minutes: 241 })],
    ["addBooking", () => addBooking({ serviceId: id, date: "2031-06-03", time: "15:00", name: "", phone: "07700 900111" })],
  ] as const)("%s returns invalid for bad input without a database call", async (_, call) => {
    await expect(call()).resolves.toEqual({ error: "invalid" });
    expect(requireOwner).toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });
});
