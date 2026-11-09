import { describe, expect, it } from "vitest";
import { buildIcs, isUuid } from "./customer-booking";
import { utcToLondon } from "./time";

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
  it("escapes text and uses CRLF", () => {
    const ics = buildIcs("tok", { service_name: "A, B", start_at: "2030-12-03T14:20:00Z", end_at: "2030-12-03T14:50:00Z" });
    expect(ics).toContain("SUMMARY:A\, B at");
    expect(ics).toContain("UID:tok@zizusbarbers.com\r\n");
  });
});

it("isUuid", () => {
  expect(isUuid("00000000-0000-0000-0000-0000000009b1")).toBe(true);
  expect(isUuid("nope")).toBe(false);
});
