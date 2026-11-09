import { beforeEach, describe, expect, it, vi } from "vitest";

const eraseCustomerByToken = vi.fn();
const stopRemindersByToken = vi.fn();
vi.mock("@/lib/customer-booking", () => ({ eraseCustomerByToken, stopRemindersByToken, cancelBookingByToken: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { deleteMyData, stopReminders } = await import("./actions");
const token = "8f1c2a34-5b6d-4e7f-8a9b-0c1d2e3f4a5b";

describe("customer data actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deleteMyData passes the result through", async () => {
    eraseCustomerByToken.mockResolvedValue({ ok: true, anonymised: 2 });
    await expect(deleteMyData(token)).resolves.toEqual({ ok: true, anonymised: 2 });
  });

  it("deleteMyData turns an RPC error into the failed state", async () => {
    eraseCustomerByToken.mockRejectedValue(new Error("connection refused"));
    await expect(deleteMyData(token)).resolves.toEqual({ ok: false, reason: "failed" });
  });

  it("stopReminders turns an RPC error into ok:false", async () => {
    stopRemindersByToken.mockRejectedValue(new Error("boom"));
    await expect(stopReminders(token)).resolves.toEqual({ ok: false });
  });
});
