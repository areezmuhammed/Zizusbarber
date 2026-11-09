import { describe, expect, it } from "vitest";
import { buildIcs, isUuid } from "./customer-booking";
import { utcToLondon } from "./time";

const times = { start_at: "2030-12-03T14:20:00Z", end_at: "2030-12-03T14:50:00Z" };

describe("buildIcs", () => {
  it("BST booking keeps the correct UTC instant (14:20 London = 13:20Z)", () => {
    const b = { service_name: "Hair Cut", start_at: "2030-06-04T13:20:00+00:00", end_at: "2030-06-04T13:50:00+00:00" };
    const ics = buildIcs("t", b);
    expect(ics).toContain("DTSTART:20300604T132000Z");
    expect(ics).toContain("DTEND:20300604T135000Z");
    expect(utcToLondon(new Date(b.start_at)).toFormat("ccc d LLL, HH:mm")).toBe("Tue 4 Jun, 14:20");
  });
  it("GMT booking keeps the correct UTC instant (14:20 London = 14:20Z)", () => {
    const b = { service_name: "Hair Cut", start_at: "2030-12-03T14:20:00+00:00", end_at: "2030-12-03T14:50:00+00:00" };
    expect(buildIcs("t", b)).toContain("DTSTART:20301203T142000Z");
    expect(utcToLondon(new Date(b.start_at)).toFormat("ccc d LLL, HH:mm")).toBe("Tue 3 Dec, 14:20");
  });
  it("escapes , ; backslash and newline per RFC 5545 TEXT", () => {
    const ics = buildIcs("tok", { service_name: "A, B; C\\D\nE", ...times });
    expect(ics).toContain("SUMMARY:A\\, B\\; C\\\\D\\nE at");
    expect(ics).toContain("LOCATION:Zizu's Barbers\\, 135 Upperthorpe Rd\\, Sheffield S6 3EB");
    expect(ics).toContain("DESCRIPTION:Booking at Zizu's Barbers. Call 07535 423544 to change it.");
    expect(ics).toContain("UID:tok@zizusbarbers.com\r\n");
  });
  it("CRLF is the only line terminator", () => {
    const ics = buildIcs("tok", { service_name: "A\nB\r\nC", ...times });
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });
  it("folds lines over 75 octets with CRLF + space", () => {
    const ics = buildIcs("tok", { service_name: "é".repeat(100), ...times });
    const lines = ics.split("\r\n");
    for (const l of lines) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(lines.some((l) => l.startsWith(" "))).toBe(true);
    expect(ics.replace(/\r\n /g, "")).toContain("SUMMARY:" + "é".repeat(100) + " at");
  });
});

it("isUuid", () => {
  expect(isUuid("00000000-0000-0000-0000-0000000009b1")).toBe(true);
  expect(isUuid("nope")).toBe(false);
});
