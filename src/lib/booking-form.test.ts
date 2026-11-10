import { describe, expect, it } from "vitest";
import { dayHours, limitNotice, normalisePhone, openDays, parseBooking, validateDetails } from "./booking-form";

const everyDay = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, open_local: "09:30:00", close_local: "20:00:00" }));
const consecutive = (days: string[]) =>
  days.slice(1).every((d, i) => Date.parse(`${d}T00:00Z`) - Date.parse(`${days[i]}T00:00Z`) === 86_400_000);

describe("openDays", () => {
  it("does not skip or repeat a day across the 25 Oct 2026 change", () => {
    // 00:30 BST on 25 Oct is still 24 Oct in UTC
    const days = openDays(new Date("2026-10-24T23:30:00Z"), 5, everyDay, []);
    expect(days).toEqual(["2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29"]);
  });

  it("does not skip or repeat a day across the 29 Mar 2026 change", () => {
    const days = openDays(new Date("2026-03-27T23:59:00Z"), 14, everyDay, []);
    expect(days[0]).toBe("2026-03-27");
    expect(days).toContain("2026-03-29");
    expect(new Set(days).size).toBe(14);
    expect(consecutive(days)).toBe(true);
  });

  it("skips closed weekdays and closures, and honours special-hours closures", () => {
    const tueToSun = everyDay.filter((h) => h.weekday !== 1);
    const closures = [
      { date: "2026-11-10", open_local: null, close_local: null }, // Tue shut
      { date: "2026-11-16", open_local: "10:00:00", close_local: "14:00:00" }, // Mon special opening
    ];
    const days = openDays(new Date("2026-11-09T10:00:00Z"), 7, tueToSun, closures);
    expect(days).toEqual(["2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17"]);
  });
});

describe("dayHours", () => {
  it("uses weekday hours, closure overrides, and null when closed", () => {
    expect(dayHours("2026-11-11", everyDay, [])).toEqual({ open: "09:30", close: "20:00" });
    const c = [{ date: "2026-11-11", open_local: "10:00:00", close_local: "14:00:00" }];
    expect(dayHours("2026-11-11", everyDay, c)).toEqual({ open: "10:00", close: "14:00" });
    expect(dayHours("2026-11-11", everyDay, [{ date: "2026-11-11", open_local: null, close_local: null }])).toBeNull();
    expect(dayHours("2026-11-09", everyDay.filter((h) => h.weekday !== 1), [])).toBeNull();
  });
});

describe("validateDetails", () => {
  it("accepts a valid UK mobile or landline and optional email", () => {
    expect(validateDetails({ name: "Sam", phone: "07700 900123", email: "" })).toEqual({});
    expect(validateDetails({ name: "Sam", phone: "+44 114 496 0000", email: "a@b.co" })).toEqual({});
    expect(validateDetails({ name: "Sam", phone: "(0114) 496-0000", email: "" })).toEqual({});
  });

  it("rejects blank name, implausible phone and bad email", () => {
    const e = validateDetails({ name: "  ", phone: "12345", email: "nope" });
    expect(Object.keys(e).sort()).toEqual(["email", "name", "phone"]);
    expect(validateDetails({ name: "Sam", phone: "+1 202 555 0100", email: "" }).phone).toBeTruthy();
  });

  it("accepts 44… and +44 (0)… forms, normalised to +44", () => {
    for (const p of ["447700900123", "+44 (0)7700 900123", "+44 7700 900123", "0044 7700.900.123", "07700 900123"]) {
      expect(validateDetails({ name: "Sam", phone: p, email: "" })).toEqual({});
      expect(normalisePhone(p)).toBe("+447700900123");
    }
  });

  it("rejects too-short and lettered phones, and national parts starting 0 or 4", () => {
    for (const p of ["07700 9001", "07700 9001ab", "phone", "+44 0771234567", "+44 44 7700 9001", "00447700", "0447700900123"]) {
      expect(validateDetails({ name: "Sam", phone: p, email: "" }).phone).toBeTruthy();
      expect(normalisePhone(p)).toBeNull();
    }
  });

  it("caps name, phone and email lengths", () => {
    expect(validateDetails({ name: "a".repeat(101), phone: "07700900123", email: "" }).name).toBeTruthy();
    expect(validateDetails({ name: "Sam", phone: `07700900123${" ".repeat(20)}`, email: "" }).phone).toBeTruthy();
    expect(validateDetails({ name: "Sam", phone: "07700900123", email: `${"a".repeat(250)}@b.co` }).email).toBeTruthy();
  });
});

describe("parseBooking", () => {
  const good = {
    serviceId: "8f1c2a34-5b6d-4e7f-8a9b-0c1d2e3f4a5b",
    start: "2026-11-13T10:45:00.000Z",
    name: " Sam ",
    phone: "+44 (0)7700 900123",
    email: "",
  };

  it("returns normalised args for good input", () => {
    expect(parseBooking(good)).toEqual({
      serviceId: good.serviceId,
      startAt: new Date(good.start),
      name: "Sam",
      phone: "+447700900123",
      email: undefined,
    });
  });

  it("returns null, without throwing, for malformed input", () => {
    for (const bad of [
      null,
      "x",
      { ...good, name: 42 },
      { ...good, phone: ["07700900123"] },
      { ...good, email: undefined },
      { ...good, serviceId: "not-a-uuid" },
      { ...good, start: "tomorrow" },
      { ...good, start: "2026-13-45T10:45:00Z" },
      { ...good, name: "a".repeat(101) },
    ]) expect(parseBooking(bad)).toBeNull();
  });
});

describe("limitNotice", () => {
  it("too_many covers the 3-upcoming and the 24h caps and gives the phone", () => {
    expect(limitNotice("too_many", "07535 423544")).toBe(
      "You have made several bookings recently, please call us on 07535 423544 to add more.",
    );
  });
  it("busy asks to try again later or call", () => {
    expect(limitNotice("busy", "07535 423544")).toBe(
      "We are getting a lot of requests right now. Please try again in a few minutes or call us on 07535 423544.",
    );
  });
});
