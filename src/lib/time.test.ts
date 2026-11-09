import { describe, it, expect } from "vitest";
import { londonToUtc, utcToLondon, addLondonDays } from "./time";

describe("time helpers", () => {
  it("returns a single instant for the repeated hour", () => {
    const d = londonToUtc("2026-10-25", "01:30");
    expect(d).toBeInstanceOf(Date);
    expect(d!.toISOString()).toBe("2026-10-25T01:30:00.000Z");
  });

  it("returns null for a nonexistent local time", () => {
    expect(londonToUtc("2026-03-29", "01:30")).toBeNull();
  });

  it("converts UTC to London wall-clock", () => {
    expect(utcToLondon(new Date("2026-10-25T13:00:00Z")).toFormat("HH:mm")).toBe("13:00");
    expect(utcToLondon(new Date("2026-07-01T13:00:00Z")).toFormat("HH:mm")).toBe("14:00");
  });

  it("addLondonDays keeps local time across the 25 Oct change", () => {
    const start = londonToUtc("2026-10-24", "10:00")!;
    const next = addLondonDays(start, 1);
    expect(utcToLondon(next).toFormat("yyyy-MM-dd HH:mm")).toBe("2026-10-25 10:00");
  });
});
