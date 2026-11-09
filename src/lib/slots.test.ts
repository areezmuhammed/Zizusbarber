import { describe, it, expect } from "vitest";
import { generateSlots } from "./slots";
import { londonToUtc, utcToLondon } from "./time";

const base = {
  date: "2026-06-10",
  openLocal: "09:30",
  closeLocal: "20:00",
  durationMin: 30,
  stepMin: 30,
  busy: [],
  closed: false,
  now: new Date("2026-01-01T00:00:00Z"),
};
const hhmm = (ds: Date[]) => ds.map((d) => utcToLondon(d).toFormat("HH:mm"));

describe("generateSlots", () => {
  it("empty day starts at 09:30 London and last slot ends by close", () => {
    const s = hhmm(generateSlots(base));
    expect(s[0]).toBe("09:30");
    expect(s[s.length - 1]).toBe("19:30");
  });
  it("busy block removes overlapping starts", () => {
    const start = londonToUtc("2026-06-10", "10:00")!;
    const end = londonToUtc("2026-06-10", "11:00")!;
    const s = hhmm(generateSlots({ ...base, busy: [{ start, end }] }));
    expect(s).toContain("09:30");
    expect(s).not.toContain("10:00");
    expect(s).not.toContain("10:30");
    expect(s).toContain("11:00");
  });
  it("closed day gives []", () => {
    expect(generateSlots({ ...base, closed: true })).toEqual([]);
  });
  it("excludes slots before now", () => {
    const now = londonToUtc("2026-06-10", "12:00")!;
    expect(hhmm(generateSlots({ ...base, now }))[0]).toBe("12:00");
  });
  it("29 Mar 2026 offers nothing in the missing hour", () => {
    const s = hhmm(generateSlots({ ...base, date: "2026-03-29", openLocal: "00:00", closeLocal: "04:00" }));
    expect(s).toEqual(["00:00", "00:30", "02:00", "02:30", "03:00", "03:30"]);
  });
  it("25 Oct 2026 has no duplicate instants", () => {
    const ds = generateSlots({ ...base, date: "2026-10-25", openLocal: "00:00", closeLocal: "04:00" });
    expect(new Set(ds.map((d) => d.getTime())).size).toBe(ds.length);
  });
});
