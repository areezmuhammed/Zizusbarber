import { describe, expect, it } from "vitest";
import { effectiveStatus } from "./open-now";

// Mon-Fri 09:00-20:00, Sat 10:00-18:00, Sunday shut.
const hours = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, open_local: "09:00:00", close_local: "20:00:00" }))
  .concat({ weekday: 6, open_local: "10:00:00", close_local: "18:00:00" });
const auto = { state: "open" as const, manual_date: null };
const at = (iso: string) => new Date(iso);

describe("effectiveStatus", () => {
  it("opens and closes on London time, summer and winter", () => {
    // Tue 14 Jul 2026, BST: 09:00 London = 08:00Z
    expect(effectiveStatus(auto, hours, [], at("2026-07-14T07:59:00Z"))).toEqual({ state: "closed", auto: true, next: "opens 09:00" });
    expect(effectiveStatus(auto, hours, [], at("2026-07-14T08:00:00Z"))).toEqual({ state: "open", auto: true, next: "closes 20:00" });
    // Tue 15 Dec 2026, GMT: 08:30Z is 08:30 London, still shut
    expect(effectiveStatus(auto, hours, [], at("2026-12-15T08:30:00Z")).state).toBe("closed");
    expect(effectiveStatus(auto, hours, [], at("2026-12-15T09:00:00Z")).state).toBe("open");
  });

  it("is closed from the closing minute and names the next opening", () => {
    expect(effectiveStatus(auto, hours, [], at("2026-07-14T18:59:00Z")).state).toBe("open");
    expect(effectiveStatus(auto, hours, [], at("2026-07-14T19:00:00Z"))).toEqual({ state: "closed", auto: true, next: "opens tomorrow 09:00" });
    // Sat 18 Jul after closing: Sunday is shut, so Monday
    expect(effectiveStatus(auto, hours, [], at("2026-07-18T17:30:00Z")).next).toBe("opens Mon 09:00");
  });

  it("follows closures: a shut day and special hours", () => {
    const shut = [{ date: "2026-07-14", open_local: null, close_local: null }];
    expect(effectiveStatus(auto, hours, shut, at("2026-07-14T10:00:00Z"))).toEqual({ state: "closed", auto: true, next: "opens tomorrow 09:00" });
    const short = [{ date: "2026-07-14", open_local: "09:00:00", close_local: "13:00:00" }];
    expect(effectiveStatus(auto, hours, short, at("2026-07-14T11:00:00Z")).state).toBe("open");
    expect(effectiveStatus(auto, hours, short, at("2026-07-14T12:00:00Z")).state).toBe("closed");
  });

  it("the owner's choice lasts for that London day only", () => {
    const closedToday = { state: "closed" as const, manual_date: "2026-07-14" };
    expect(effectiveStatus(closedToday, hours, [], at("2026-07-14T18:00:00Z"))).toEqual({ state: "closed", auto: false, next: null });
    // 23:30 BST is still the 14th in London (22:30Z)
    expect(effectiveStatus(closedToday, hours, [], at("2026-07-14T22:30:00Z")).auto).toBe(false);
    // next morning it is back to hours
    expect(effectiveStatus(closedToday, hours, [], at("2026-07-15T08:30:00Z"))).toEqual({ state: "open", auto: true, next: "closes 20:00" });
    expect(effectiveStatus({ state: "busy", manual_date: "2026-07-14" }, hours, [], at("2026-07-14T10:00:00Z")).state).toBe("busy");
  });

  it("no hours at all: closed with nothing to promise", () => {
    expect(effectiveStatus(auto, [], [], at("2026-07-14T10:00:00Z"))).toEqual({ state: "closed", auto: true, next: null });
  });
});
