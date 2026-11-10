import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { londonToUtc, utcToLondon } from "../time";
import { runNotifications, supabaseNotifyDb } from "./core";

// Local dev stack keys only (public demo JWTs); override via env. Providers are fakes: nothing is sent.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:56321";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

let up = false;
try {
  up = (await fetch(`${URL}/rest/v1/`, { headers: { apikey: ANON }, signal: AbortSignal.timeout(2000) })).ok;
} catch {}
if (!up) console.warn(`SKIPPED: local Supabase stack not reachable at ${URL} (run npx supabase start)`);

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const PHONE = "+447700900555";
const MAIL = "notify-it@example.test";
// A Tuesday 22-28 days ahead (inside the public 90-day horizon, no reminders due yet), London 11:00 and 12:00.
const ahead = utcToLondon(new Date()).plus({ days: 22 });
const DAY = ahead.plus({ days: (2 - ahead.weekday + 7) % 7 }).toISODate()!;
const at = (hhmm: string) => londonToUtc(DAY, hhmm)!.toISOString();
const label = (iso: string) => utcToLondon(new Date(iso)).toFormat("ccc d LLL, HH:mm");
const A = at("11:00");
const B = at("12:00");
const shop = { name: "Zizu's Barbers", phone: "07535 423544", siteUrl: "http://localhost:3000" };

describe.skipIf(!up)("runNotifications (local stack, fake providers)", () => {
  // 017 logs every public booking (md5 of the phone) and counts it even after the booking row is deleted
  const clean = async () => {
    await admin.from("bookings").delete().eq("phone", PHONE);
    await admin.from("public_booking_log").delete().eq("phone_hash", createHash("md5").update(PHONE).digest("hex"));
  };
  beforeAll(clean);
  afterAll(clean);

  it("confirmation, change and shop-cancel notices go out once; a rerun sends nothing", async () => {
    const anon = createClient(URL, ANON, { auth: { persistSession: false } });
    const { data: svc } = await admin.from("services").select("id").eq("name", "Hair Cut").single();
    const book = async (start: string, email: string) => {
      const { data, error } = await anon.rpc("create_booking", { p_service: svc!.id, p_start: start, p_name: "It Test", p_phone: PHONE, p_email: email });
      expect(error).toBeNull();
      return data[0] as { id: string; cancel_token: string };
    };
    const a = await book(A, MAIL);
    const b = await book(B, "");
    const moved = { start: at("11:20"), end: at("11:50") };
    await admin.from("bookings").update({ start_at: moved.start, end_at: moved.end }).eq("id", a.id);
    const { error: e1 } = await admin.from("booking_changes").insert({
      booking_id: a.id, old_start: A, old_end: at("11:30"), new_start: moved.start, new_end: moved.end, reason: "test",
    });
    expect(e1).toBeNull();
    await admin.from("bookings").update({ status: "cancelled", cancelled_by: "shop" }).eq("id", b.id); // as admin setStatus does

    const mails: { to: string; subject: string; text: string }[] = [];
    const texts: { to: string; text: string }[] = [];
    // scoped to this test's bookings: other bookings in the local DB are never touched
    const real = supabaseNotifyDb(admin);
    const db = { ...real, candidates: async (now: Date) => (await real.candidates(now)).filter((x) => x.id === a.id || x.id === b.id) };
    const run = () => runNotifications({
      db, now: new Date(), shop,
      email: { send: async (m) => { mails.push(m); } },
      sms: { send: async (m) => { texts.push(m); } },
    });
    await run();

    const ours = { mails, texts };
    expect(ours.mails).toHaveLength(1);
    expect(ours.mails[0].subject).toBe(`Booking confirmed: ${label(moved.start)}`);
    expect(ours.mails[0].text).toContain(`http://localhost:3000/booking/${a.cancel_token}`);
    expect(ours.texts.map((t) => t.text).sort()).toEqual([
      `Zizu's Barbers: sorry, we had to cancel your Hair Cut on ${label(B)}. Call 07535 423544 or rebook: http://localhost:3000/book`,
      `Zizu's Barbers: your booking is now ${label(moved.start)}-11:50. Problem? Call 07535 423544. http://localhost:3000/booking/${a.cancel_token}`,
    ]);

    const { data: rows } = await admin.from("notifications").select("booking_id,kind,channel,status,sent_at").in("booking_id", [a.id, b.id]);
    expect(rows!.map((r) => `${r.booking_id === a.id ? "a" : "b"}:${r.kind}:${r.channel}:${r.status}`).sort()).toEqual([
      "a:changed:sms:sent", "a:confirmation:email:sent", "b:cancelled_by_shop:sms:sent",
    ]);
    expect(rows!.every((r) => r.sent_at)).toBe(true);

    expect(mails.length + texts.length).toBe(3);
    expect(await run()).toEqual({ sent: 0, failed: 0, skipped: 0 });
    expect(mails.length + texts.length).toBe(3);
  });
});
