import { describe, expect, it } from "vitest";
import { parseClosure, parseDate, parseHours, parsePrice, parseService, parseTime } from "./settings-form";

const ID = "3f2b8c1e-1d2a-4c3b-9a8e-7f6e5d4c3b2a";

describe("parsePrice (pounds in, pence out)", () => {
  it.each([
    ["14", 1400],
    ["14.50", 1450],
    ["14.5", 1450],
    [" £8 ", 800],
    ["0", 0],
    ["9999.99", 999999],
  ])("%s -> %i", (s, p) => expect(parsePrice(s)).toBe(p));
  it.each([",", "14,50", "-1", "1e3", "14.505", "10000", "", ".5", "abc", "1".repeat(30), 14, null])("rejects %s", (s) =>
    expect(parsePrice(s)).toBeNull(),
  );
});

describe("parseTime", () => {
  it("accepts HH:MM on a 5-minute step", () => {
    expect(parseTime("09:30")).toBe("09:30");
    expect(parseTime("23:55")).toBe("23:55");
  });
  it.each(["9:30", "24:00", "09:31", "09:30:00", "12:60", "", 930])("rejects %s", (t) => expect(parseTime(t)).toBeNull());
});

describe("parseDate", () => {
  it("accepts real dates including DST change days", () => {
    expect(parseDate("2026-03-29")).toBe("2026-03-29"); // clocks go forward
    expect(parseDate("2026-10-25")).toBe("2026-10-25"); // clocks go back
  });
  it.each(["2026-02-30", "2026-13-01", "26-03-29", "2026-3-9", "2026-03-29T00:00", null])("rejects %s", (d) =>
    expect(parseDate(d)).toBeNull(),
  );
});

describe("parseService", () => {
  const ok = { name: " Skin Fade ", price: "14.50", duration: 30, active: true };
  it("parses a new and an existing service", () => {
    expect(parseService(ok)).toEqual({ id: null, name: "Skin Fade", price_pence: 1450, duration_min: 30, active: true });
    expect(parseService({ ...ok, id: ID })?.id).toBe(ID);
  });
  it.each([
    { name: "" },
    { name: "x".repeat(61) },
    { price: "-1" },
    { duration: 4 },
    { duration: 241 },
    { duration: 30.5 },
    { duration: "30" },
    { active: "yes" },
    { id: "not-a-uuid" },
  ])("rejects %o", (patch) => expect(parseService({ ...ok, ...patch })).toBeNull());
  it("accepts a 60-character name and 5..240 minutes", () => {
    expect(parseService({ ...ok, name: "x".repeat(60), duration: 5 })).not.toBeNull();
    expect(parseService({ ...ok, duration: 240 })).not.toBeNull();
  });
});

describe("parseHours", () => {
  it("open day and closed day", () => {
    expect(parseHours({ weekday: 2, closed: false, open: "09:30", close: "20:00" })).toEqual({
      weekday: 2, open: "09:30", close: "20:00",
    });
    expect(parseHours({ weekday: 1, closed: true })).toEqual({ weekday: 1, open: null, close: null });
  });
  it.each([
    { weekday: 7, closed: true },
    { weekday: -1, closed: true },
    { weekday: 1.5, closed: true },
    { weekday: 2, closed: false, open: "20:00", close: "09:30" },
    { weekday: 2, closed: false, open: "10:00", close: "10:00" },
    { weekday: 2, closed: false, open: "10:02", close: "12:00" },
    { weekday: 2, closed: false },
  ])("rejects %o", (i) => expect(parseHours(i)).toBeNull());
});

describe("parseClosure", () => {
  const today = "2026-11-09";
  it("whole-day and special-hours closures", () => {
    expect(parseClosure({ date: "2026-12-25", reason: " Christmas ", closed: true }, today)).toEqual({
      date: "2026-12-25", reason: "Christmas", open_local: null, close_local: null,
    });
    expect(parseClosure({ date: "2027-03-28", reason: "", closed: false, open: "10:00", close: "14:00" }, today)).toEqual({
      date: "2027-03-28", reason: null, open_local: "10:00", close_local: "14:00",
    });
    expect(parseClosure({ date: today, reason: "Today", closed: true }, today)?.date).toBe(today);
  });
  it.each([
    { date: "2026-11-08", closed: true }, // in the past
    { date: "2026-02-30", closed: true },
    { date: "2026-12-25", closed: true, reason: "x".repeat(101) },
    { date: "2026-12-25", closed: false, open: "14:00", close: "10:00" },
    { date: "2026-12-25", closed: false, open: "10:00" },
    { date: "2026-12-25" },
  ])("rejects %o", (i) => expect(parseClosure(i, today)).toBeNull());
});
