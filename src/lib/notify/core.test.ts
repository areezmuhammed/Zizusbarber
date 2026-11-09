import { describe, expect, it, vi } from "vitest";
import {
  dueNotifications, render, runNotifications, londonTime, MAX_ATTEMPTS,
  type Booking, type Due, type NotifyDb, type Sent,
} from "./core";

const H = 3_600_000;
const shop = { name: "Zizu's Barbers", phone: "07535 423544", siteUrl: "https://zizusbarbers.com" };

function booking(over: Partial<Booking> = {}): Booking {
  return {
    id: "b1", status: "confirmed", start_at: "2026-11-20T14:20:00Z", end_at: "2026-11-20T14:50:00Z",
    created_at: "2026-11-01T10:00:00Z", phone: "+447700900123", email: "ann@example.com",
    cancel_token: "11111111-2222-3333-4444-555555555555", cancelled_by: null,
    service_name: "Hair Cut", changes: [], notifications: [], ...over,
  };
}
const kinds = (d: Due[]) => d.map((x) => `${x.kind}:${x.channel}`).sort();
const at = (b: Booking, msBefore: number) => new Date(Date.parse(b.start_at) - msBefore);

describe("dueNotifications", () => {
  it("confirmation within 24h of creation: email when present, else SMS", () => {
    const b = booking({ created_at: "2026-11-10T10:00:00Z" });
    const now = new Date("2026-11-10T10:05:00Z");
    expect(kinds(dueNotifications([b], now))).toEqual(["confirmation:email"]);
    expect(kinds(dueNotifications([{ ...b, email: "" }], now))).toEqual(["confirmation:sms"]);
    expect(kinds(dueNotifications([b], new Date("2026-11-11T10:00:00Z")))).toEqual([]); // older than 24h
  });

  it("24h reminder window [start-24h, start-2h) by SMS, exact to the minute", () => {
    const b = booking();
    expect(kinds(dueNotifications([b], at(b, 24 * H + 60_000)))).toEqual([]);
    expect(kinds(dueNotifications([b], at(b, 24 * H)))).toEqual(["reminder_24h:sms"]);
    expect(kinds(dueNotifications([b], at(b, 2 * H + 60_000)))).toEqual(["reminder_24h:sms"]);
    expect(kinds(dueNotifications([b], at(b, 2 * H)))).toEqual(["reminder_2h:email"]);
  });

  it("2h reminder window [start-2h, start): email, SMS when no email; nothing once started", () => {
    const b = booking();
    expect(kinds(dueNotifications([b], at(b, 60_000)))).toEqual(["reminder_2h:email"]);
    expect(kinds(dueNotifications([{ ...b, email: "  " }], at(b, H)))).toEqual(["reminder_2h:sms"]);
    expect(kinds(dueNotifications([b], at(b, 0)))).toEqual([]);
    expect(kinds(dueNotifications([b], at(b, -H)))).toEqual([]);
  });

  it("a booking made inside a reminder window gets only the confirmation", () => {
    const b = booking({ created_at: "2026-11-20T04:00:00Z" }); // 10h20 before
    expect(kinds(dueNotifications([b], new Date("2026-11-20T04:01:00Z")))).toEqual(["confirmation:email"]);
    const confirmed = { ...b, notifications: [{ kind: "confirmation" as const, change_id: null, status: "sent" as const, attempts: 1 }] };
    expect(kinds(dueNotifications([confirmed], at(b, H)))).toEqual(["reminder_2h:email"]);
  });

  it("a confirmation covers the 2h reminder: booked < 2h30 before start, or both due in the same run", () => {
    const b = booking({ created_at: "2026-11-20T12:16:00Z" }); // 2h04 before 14:20
    expect(kinds(dueNotifications([b], new Date("2026-11-20T12:17:00Z")))).toEqual(["confirmation:email"]);
    const confirmed = { ...b, notifications: [{ kind: "confirmation" as const, change_id: null, status: "sent" as const, attempts: 1 }] };
    expect(kinds(dueNotifications([confirmed], at(b, H)))).toEqual([]);
    const late = booking({ created_at: "2026-11-20T11:00:00Z" }); // 3h20 before; cron down until 1h before start
    expect(kinds(dueNotifications([late], at(late, H)))).toEqual(["confirmation:email"]);
  });

  it("DST end day: 09:30 London on Mon 26 Oct 2026 (GMT) -> 24h reminder at 09:30Z Sun 25 Oct", () => {
    const b = booking({ start_at: "2026-10-26T09:30:00Z", created_at: "2026-10-01T00:00:00Z" });
    expect(londonTime(b.start_at)).toBe("Mon 26 Oct, 09:30");
    expect(kinds(dueNotifications([b], new Date("2026-10-25T09:29:00Z")))).toEqual([]);
    expect(kinds(dueNotifications([b], new Date("2026-10-25T09:30:00Z")))).toEqual(["reminder_24h:sms"]);
  });

  it("DST start day: 10:00 London on Sun 29 Mar 2026 (BST) = 09:00Z -> 24h reminder at 09:00Z Sat 28 Mar", () => {
    const b = booking({ start_at: "2026-03-29T09:00:00Z", created_at: "2026-03-01T00:00:00Z" });
    expect(londonTime(b.start_at)).toBe("Sun 29 Mar, 10:00");
    expect(kinds(dueNotifications([b], new Date("2026-03-28T08:59:00Z")))).toEqual([]);
    expect(kinds(dueNotifications([b], new Date("2026-03-28T09:00:00Z")))).toEqual(["reminder_24h:sms"]);
    expect(kinds(dueNotifications([b], new Date("2026-03-29T07:00:00Z")))).toEqual(["reminder_2h:email"]);
  });

  it("cancelled, finished and past bookings never get reminders", () => {
    const now = at(booking(), H);
    for (const status of ["cancelled", "done", "no_show", "arrived"]) {
      expect(dueNotifications([booking({ status })], now)).toEqual([]);
    }
    expect(dueNotifications([booking({ start_at: "2026-11-01T09:00:00Z" })], new Date("2026-11-01T10:00:00Z"))).toEqual([]);
  });

  it("cancelled by the shop -> one SMS notice; customer self-cancel -> nothing", () => {
    const now = new Date("2026-11-15T10:00:00Z");
    expect(kinds(dueNotifications([booking({ status: "cancelled", cancelled_by: "shop" })], now))).toEqual(["cancelled_by_shop:sms"]);
    expect(dueNotifications([booking({ status: "cancelled", cancelled_by: "customer" })], now)).toEqual([]);
  });

  it("changed: only the latest unsent change, by SMS", () => {
    const changes = [
      { id: "c1", old_start: "2026-11-20T14:00:00Z", new_start: "2026-11-20T14:10:00Z", new_end: "2026-11-20T14:40:00Z", at: "2026-11-14T09:00:00Z" },
      { id: "c2", old_start: "2026-11-20T14:10:00Z", new_start: "2026-11-20T14:20:00Z", new_end: "2026-11-20T14:50:00Z", at: "2026-11-14T10:00:00Z" },
    ];
    const now = new Date("2026-11-15T10:00:00Z");
    const d = dueNotifications([booking({ changes })], now);
    expect(d.map((x) => [x.kind, x.changeId, x.channel])).toEqual([["changed", "c2", "sms"]]);
    const sent: Sent = { kind: "changed", change_id: "c2", status: "sent", attempts: 1 };
    expect(dueNotifications([booking({ changes, notifications: [sent] })], now)).toEqual([]);
  });

  it("already sent / pending / skipped excluded; failed retried until the attempt cap", () => {
    const b = booking();
    const now = at(b, H);
    const n = (status: Sent["status"], attempts = 1): Sent => ({ kind: "reminder_2h", change_id: null, status, attempts });
    for (const s of ["sent", "pending", "skipped"] as const) expect(dueNotifications([booking({ notifications: [n(s)] })], now)).toEqual([]);
    expect(kinds(dueNotifications([booking({ notifications: [n("failed", MAX_ATTEMPTS - 1)] })], now))).toEqual(["reminder_2h:email"]);
    expect(dueNotifications([booking({ notifications: [n("failed", MAX_ATTEMPTS)] })], now)).toEqual([]);
  });
});

describe("render", () => {
  const link = "https://zizusbarbers.com/booking/11111111-2222-3333-4444-555555555555";
  const all = ["confirmation", "reminder_24h", "reminder_2h", "changed", "cancelled_by_shop"] as const;

  it("shows London time and the manage link", () => {
    const m = render("confirmation", booking({ start_at: "2026-06-04T13:20:00Z" }), shop);
    expect(m.smsText).toContain("Thu 4 Jun, 14:20");
    expect(m.smsText).toContain(link);
    expect(m.emailText).toContain(link);
    expect(m.emailSubject).toContain("Thu 4 Jun, 14:20");
  });

  it("changed shows new start-end and asks to call if it does not work", () => {
    const m = render("changed", booking(), shop);
    expect(m.smsText).toContain("Fri 20 Nov, 14:20-14:50");
    expect(m.smsText).toContain("07535 423544");
    expect(m.emailText).toContain("doesn't work");
  });

  it("cancelled_by_shop says sorry and how to rebook, no manage link", () => {
    const m = render("cancelled_by_shop", booking(), shop);
    expect(m.smsText).toContain("cancel");
    expect(m.smsText).toContain("https://zizusbarbers.com/book");
    expect(m.smsText).not.toContain("/booking/");
  });

  it("never includes customer-supplied text", () => {
    const evil = booking({ email: "x@y.z" }) as Booking & { customer_name: string };
    evil.customer_name = "Ann\nVisit http://evil.example <b>now</b> 💈";
    for (const k of all) {
      const m = render(k, evil, shop);
      for (const t of [m.smsText, m.emailSubject, m.emailText]) {
        expect(t).not.toMatch(/evil|<b>|💈|Ann/);
      }
      expect(m.smsText).not.toContain("\n");
      expect(m.emailSubject).not.toContain("\n");
    }
  });

  it("SMS fits one 160-char GSM segment with the longest service name and widest date", () => {
    const b = booking({ service_name: "Hair Cut and Designs", start_at: "2026-11-25T14:20:00Z", end_at: "2026-11-25T15:20:00Z" });
    for (const k of all) {
      const t = render(k, b, shop).smsText;
      expect(t.length, `${k}: ${t}`).toBeLessThanOrEqual(160);
      expect(t).toMatch(/^[A-Za-z0-9 .,:;'!?£\-/()]+$/); // GSM-7 basic set only
    }
  });
});

// In-memory fake with the same claim semantics as claim_notification() in SQL.
function fakeDb(rows: Booking[]) {
  const store: (Sent & { id: string; booking_id: string; channel: string; error: string | null })[] = [];
  const db: NotifyDb = {
    async candidates() {
      return rows.map((b) => ({ ...b, notifications: store.filter((n) => n.booking_id === b.id) }));
    },
    async claim(d) {
      const prev = store.find((n) => n.booking_id === d.booking.id && n.kind === d.kind && n.change_id === d.changeId);
      if (!prev) {
        const row = { id: `n${store.length + 1}`, booking_id: d.booking.id, kind: d.kind, change_id: d.changeId, channel: d.channel, status: "pending" as const, attempts: 1, error: null };
        store.push(row);
        return row.id;
      }
      if (prev.status !== "failed" || prev.attempts >= MAX_ATTEMPTS) return null;
      Object.assign(prev, { status: "pending", attempts: prev.attempts + 1 });
      return prev.id;
    },
    async finish(id, status, error) {
      Object.assign(store.find((n) => n.id === id)!, { status, error });
    },
  };
  return { db, store };
}
const fakes = () => {
  const mails: { to: string; subject: string; text: string }[] = [];
  const texts: { to: string; text: string }[] = [];
  return {
    email: { sent: mails, send: vi.fn(async (m: (typeof mails)[number]) => { mails.push(m); }) },
    sms: { sent: texts, send: vi.fn(async (m: (typeof texts)[number]) => { texts.push(m); }) },
  };
};

describe("runNotifications", () => {
  const now = new Date("2026-11-20T12:30:00Z"); // 1h50 before b1: 2h reminder due

  it("sends once and never twice on rerun; email vs SMS fallback", async () => {
    const { db, store } = fakeDb([booking(), booking({ id: "b2", email: "", cancel_token: "t2" })]);
    const { email, sms } = fakes();
    expect(await runNotifications({ db, email, sms, now, shop })).toEqual({ sent: 2, failed: 0, skipped: 0 });
    expect(email.sent.map((m) => m.to)).toEqual(["ann@example.com"]);
    expect(sms.sent.map((m) => m.to)).toEqual(["+447700900123"]);
    expect(store.every((n) => n.status === "sent")).toBe(true);
    expect(await runNotifications({ db, email, sms, now, shop })).toEqual({ sent: 0, failed: 0, skipped: 0 });
    expect(email.send).toHaveBeenCalledTimes(1);
    expect(sms.send).toHaveBeenCalledTimes(1);
  });

  it("a throwing provider fails only that booking, retried at most 3 times", async () => {
    const { db, store } = fakeDb([booking(), booking({ id: "b2", email: "", cancel_token: "t2" })]);
    const { sms } = fakes();
    const email = { send: vi.fn(async () => { throw new Error("resend 500"); }) };
    expect(await runNotifications({ db, email, sms, now, shop })).toEqual({ sent: 1, failed: 1, skipped: 0 });
    await runNotifications({ db, email, sms, now, shop });
    await runNotifications({ db, email, sms, now, shop });
    expect(await runNotifications({ db, email, sms, now, shop })).toEqual({ sent: 0, failed: 0, skipped: 0 });
    expect(email.send).toHaveBeenCalledTimes(3);
    expect(store.find((n) => n.booking_id === "b1")).toMatchObject({ status: "failed", attempts: 3, error: "Error: resend 500" });
    expect(sms.send).toHaveBeenCalledTimes(1);
  });

  it("a claim lost to another run is not sent", async () => {
    const { db } = fakeDb([booking()]);
    db.claim = async () => null;
    const { email, sms } = fakes();
    expect(await runNotifications({ db, email, sms, now, shop })).toEqual({ sent: 0, failed: 0, skipped: 0 });
    expect(email.send).not.toHaveBeenCalled();
  });

  it("dry-run (console) providers and non-E.164 phones are recorded as skipped, not sent", async () => {
    const { db, store } = fakeDb([booking(), booking({ id: "b2", email: "", phone: "0700", cancel_token: "t2" })]);
    const { sms } = fakes();
    const email = { dryRun: true, send: vi.fn(async () => {}) };
    expect(await runNotifications({ db, email, sms, now, shop })).toEqual({ sent: 0, failed: 0, skipped: 2 });
    expect(email.send).toHaveBeenCalledTimes(1); // logged
    expect(sms.send).not.toHaveBeenCalled();
    expect(store.map((n) => n.status)).toEqual(["skipped", "skipped"]);
  });

  it("a failing finish() after a successful send leaves the row claimed, so it is never resent", async () => {
    const { db, store } = fakeDb([booking()]);
    db.finish = async () => { throw new Error("db down"); };
    const { email, sms } = fakes();
    expect(await runNotifications({ db, email, sms, now, shop })).toEqual({ sent: 1, failed: 0, skipped: 0 });
    expect(await runNotifications({ db, email, sms, now, shop })).toEqual({ sent: 0, failed: 0, skipped: 0 });
    expect(store[0].status).toBe("pending");
    expect(email.send).toHaveBeenCalledTimes(1);
  });
});
