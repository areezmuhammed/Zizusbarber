import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
const A = "2031-01-14T11:00:00.000Z"; // Tuesday 11:00 GMT
const B = "2031-01-14T12:00:00.000Z";
const shop = { name: "Zizu's Barbers", phone: "07535 423544", siteUrl: "http://localhost:3000" };

describe.skipIf(!up)("runNotifications (local stack, fake providers)", () => {
  const clean = () => admin.from("bookings").delete().eq("phone", PHONE);
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
    const moved = { start: "2031-01-14T11:20:00.000Z", end: "2031-01-14T11:50:00.000Z" };
    await admin.from("bookings").update({ start_at: moved.start, end_at: moved.end }).eq("id", a.id);
    const { error: e1 } = await admin.from("booking_changes").insert({
      booking_id: a.id, old_start: A, old_end: "2031-01-14T11:30:00Z", new_start: moved.start, new_end: moved.end, reason: "test",
    });
    expect(e1).toBeNull();
    await admin.from("bookings").update({ status: "cancelled", cancelled_by: "shop" }).eq("id", b.id); // as admin setStatus would

    const mails: { to: string; subject: string; text: string }[] = [];
    const texts: { to: string; text: string }[] = [];
    const run = () => runNotifications({
      db: supabaseNotifyDb(admin), now: new Date(), shop,
      email: { send: async (m) => { mails.push(m); } },
      sms: { send: async (m) => { texts.push(m); } },
    });
    await run();

    const ours = { mails: mails.filter((m) => m.to === MAIL), texts: texts.filter((m) => m.to === PHONE) };
    expect(ours.mails).toHaveLength(1);
    expect(ours.mails[0].subject).toBe("Booking confirmed: Tue 14 Jan, 11:20");
    expect(ours.mails[0].text).toContain(`http://localhost:3000/booking/${a.cancel_token}`);
    expect(ours.texts.map((t) => t.text).sort()).toEqual([
      `Zizu's Barbers: sorry, we had to cancel your Hair Cut on Tue 14 Jan, 12:00. Call 07535 423544 or rebook: http://localhost:3000/book`,
      `Zizu's Barbers: your booking is now Tue 14 Jan, 11:20-11:50. Problem? Call 07535 423544. http://localhost:3000/booking/${a.cancel_token}`,
    ]);

    const { data: rows } = await admin.from("notifications").select("booking_id,kind,channel,status,sent_at").in("booking_id", [a.id, b.id]);
    expect(rows!.map((r) => `${r.booking_id === a.id ? "a" : "b"}:${r.kind}:${r.channel}:${r.status}`).sort()).toEqual([
      "a:changed:sms:sent", "a:confirmation:email:sent", "b:cancelled_by_shop:sms:sent",
    ]);
    expect(rows!.every((r) => r.sent_at)).toBe(true);

    const before = mails.length + texts.length;
    await run();
    expect(mails.filter((m) => m.to === MAIL).length + texts.filter((m) => m.to === PHONE).length).toBe(3);
    expect(mails.length + texts.length).toBe(before); // nothing else was due either
  });
});
