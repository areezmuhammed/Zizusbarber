import { expect, it, vi } from "vitest";

const createClient = vi.hoisted(() => vi.fn());
vi.mock("./auth", () => ({ requireOwner: vi.fn() }));
vi.mock("./supabase/server", () => ({ createClient }));

import { getDay } from "./admin-data";

it.each([
  ["2026-03-29", "2026-03-29T00:00:00.000Z", "2026-03-29T23:00:00.000Z"],
  ["2026-10-25", "2026-10-24T23:00:00.000Z", "2026-10-26T00:00:00.000Z"],
  ["2027-03-28", "2027-03-28T00:00:00.000Z", "2027-03-28T23:00:00.000Z"],
  ["2027-10-31", "2027-10-30T23:00:00.000Z", "2027-11-01T00:00:00.000Z"],
])("queries only the London diary day %s", async (day, start, end) => {
  const lt = vi.fn(() => ({ neq: () => ({ order: async () => ({ data: [] }) }) }));
  const gte = vi.fn(() => ({ lt }));
  createClient.mockResolvedValue({
    from: (table: string) => ({
      select: () => table === "bookings" ? { gte } : { eq: () => ({ order: async () => ({ data: [] }) }) },
    }),
  });
  await getDay(day);
  expect(gte).toHaveBeenCalledWith("start_at", start);
  expect(lt).toHaveBeenCalledWith("start_at", end);
});
