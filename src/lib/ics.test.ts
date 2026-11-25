import { describe, expect, it } from "vitest";
import { buildOwnerIcs, type OwnerBooking } from "./ics";

const b: OwnerBooking = {
  id: "8f1c2a34-5b6d-4e7f-8a9b-0c1d2e3f4a5b", name: "Ann Lee", phone: "+447700900123", service: "Hair Cut",
  start: "2026-07-14T09:30:00+00:00", end: "2026-07-14T10:00:00+00:00", cancelled: false,
};

describe("buildOwnerIcs", () => {
  it("keeps one uid per booking and never uses a customer token", () => {
    const ics = buildOwnerIcs(b);
    expect(ics).toContain(`UID:booking-${b.id}@zizusbarbers.com\r\n`);
    expect(buildOwnerIcs({ ...b, start: "2026-07-14T11:00:00+00:00" })).toContain(`UID:booking-${b.id}@zizusbarbers.com\r\n`);
  });

  it("a later download outranks an earlier one (SEQUENCE rises)", () => {
    const seq = (s: string) => Number(/SEQUENCE:(\d+)/.exec(s)![1]);
    const first = buildOwnerIcs(b, new Date("2026-07-01T10:00:00Z"));
    const later = buildOwnerIcs({ ...b, end: "2026-07-14T10:10:00+00:00" }, new Date("2026-07-01T10:05:00Z"));
    expect(seq(later)).toBeGreaterThan(seq(first));
  });

  it("writes UTC instants: 10:30 BST in July and 10:30 GMT in December", () => {
    expect(buildOwnerIcs(b)).toContain("DTSTART:20260714T093000Z\r\nDTEND:20260714T100000Z\r\n");
    const winter = buildOwnerIcs({ ...b, start: "2026-12-15T10:30:00+00:00", end: "2026-12-15T11:00:00+00:00" });
    expect(winter).toContain("DTSTART:20261215T103000Z\r\n");
  });

  it("names the customer, service and phone, and marks a cancelled booking", () => {
    const ics = buildOwnerIcs(b);
    expect(ics).toContain("SUMMARY:Hair Cut: Ann Lee\r\n");
    expect(ics).toContain("+447700900123");
    expect(ics).not.toContain("STATUS:CANCELLED");
    expect(buildOwnerIcs({ ...b, cancelled: true })).toContain("STATUS:CANCELLED\r\n");
  });
});
