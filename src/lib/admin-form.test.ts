import { describe, expect, it } from "vitest";
import { parseDay, parseLength, parseReminders, parseStatus, parseWalkIn } from "./admin-form";

const id = "8f1c2a34-5b6d-4e7f-8a9b-0c1d2e3f4a5b";

describe("parseStatus", () => {
  it("accepts the owner statuses", () => {
    for (const status of ["arrived", "done", "no_show", "cancelled"])
      expect(parseStatus({ id, status })).toEqual({ id, status });
  });
  it("rejects other statuses, bad ids and non-objects", () => {
    for (const bad of [{ id, status: "confirmed" }, { id, status: "pending" }, { id: "x", status: "done" }, null, "done", { id }])
      expect(parseStatus(bad)).toBeNull();
  });
});

describe("parseLength", () => {
  it("accepts integer minutes 1..240 for add or set", () => {
    expect(parseLength({ id, mode: "add", minutes: 10 })).toEqual({ id, mode: "add", minutes: 10 });
    expect(parseLength({ id, mode: "set", minutes: 240 })).toEqual({ id, mode: "set", minutes: 240 });
    expect(parseLength({ id, mode: "add", minutes: 1 })).toEqual({ id, mode: "add", minutes: 1 });
  });
  it("rejects out of range, fractional, string and unknown mode", () => {
    for (const bad of [
      { id, mode: "add", minutes: 0 },
      { id, mode: "add", minutes: 241 },
      { id, mode: "add", minutes: 2.5 },
      { id, mode: "add", minutes: "10" },
      { id, mode: "add", minutes: -5 },
      { id, mode: "sub", minutes: 10 },
      { id: "nope", mode: "add", minutes: 10 },
      undefined,
    ])
      expect(parseLength(bad)).toBeNull();
  });
});

describe("parseWalkIn", () => {
  const good = { serviceId: id, date: "2031-06-03", time: "15:00", name: " Walk ", phone: "07700 900111" };
  it("turns London date and time into a UTC instant, normalising name and phone", () => {
    expect(parseWalkIn(good)).toEqual({ serviceId: id, startAt: new Date("2031-06-03T14:00:00Z"), name: "Walk", phone: "+447700900111" });
    expect(parseWalkIn({ ...good, date: "2031-01-07" })?.startAt).toEqual(new Date("2031-01-07T15:00:00Z"));
  });
  it("rejects malformed input without throwing", () => {
    for (const bad of [
      { ...good, serviceId: "x" },
      { ...good, date: "2031-02-30" },
      { ...good, time: "25:00" },
      { ...good, time: "9am" },
      { ...good, date: "2031-03-30", time: "01:30" }, // skipped by the spring-forward change
      { ...good, name: "" },
      { ...good, name: "a".repeat(101) },
      { ...good, phone: "+44 0771234567" },
      { ...good, phone: 7700900111 },
      "x",
    ])
      expect(parseWalkIn(bad)).toBeNull();
  });
});

describe("parseDay", () => {
  it("accepts real dates only", () => {
    expect(parseDay("2031-06-03")).toBe("2031-06-03");
    for (const bad of ["2031-02-30", "today", undefined, ["2031-06-03"], "2031-6-3"]) expect(parseDay(bad)).toBeNull();
  });
});

describe("parseReminders", () => {
  it("accepts an id and a boolean", () => {
    expect(parseReminders({ id, off: true })).toEqual({ id, off: true });
    expect(parseReminders({ id, off: false })).toEqual({ id, off: false });
  });
  it("rejects anything else", () => {
    for (const bad of [{ id, off: "true" }, { id }, { id: "x", off: true }, null, true]) expect(parseReminders(bad)).toBeNull();
  });
});
