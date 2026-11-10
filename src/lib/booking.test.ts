import { createClient } from "@supabase/supabase-js";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createBooking } from "./booking";
import { londonToUtc, utcToLondon } from "./time";

// Local dev stack keys only (public demo JWTs); override via env.
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

// A Tuesday 8-14 days ahead (inside the public 90-day horizon), London 11:00-14:00: inside opening hours.
const soon = utcToLondon(new Date()).plus({ days: 8 });
const DAY = soon.plus({ days: (2 - soon.weekday + 7) % 7 }).toISODate()!;
const start = londonToUtc(DAY, "11:00")!;
const later = ["12:00", "13:00", "14:00"].map((t) => londonToUtc(DAY, t)!);
const PHONE = "+447700900321";
const admin = createClient(URL, SERVICE);

describe.skipIf(!up)("createBooking (local stack)", () => {
  const clean = () => admin.from("bookings").delete().eq("phone", PHONE);
  beforeAll(clean);
  afterAll(clean);

  it("books once, then reports taken", async () => {
    const { data: svc } = await admin.from("services").select("id").eq("name", "Hair Cut").single();
    const args = { serviceId: svc!.id, startAt: start, name: "Test", phone: PHONE };
    const first = await createBooking(args, createClient(URL, ANON));
    expect(first.ok).toBe(true);
    expect(await createBooking(args, createClient(URL, ANON))).toEqual({ ok: false, reason: "taken" });
  });

  it("rejects non-UK phones and a 4th upcoming booking for one phone", async () => {
    const { data: svc } = await admin.from("services").select("id").eq("name", "Hair Cut").single();
    const anon = createClient(URL, ANON);
    const at = (startAt: Date, phone = PHONE) => createBooking({ serviceId: svc!.id, startAt, name: "Test", phone }, anon);
    expect(await at(later[0], "+12025550123")).toEqual({ ok: false, reason: "invalid" });
    expect((await at(later[0])).ok).toBe(true); // 2nd (the first test made the 1st)
    expect((await at(later[1])).ok).toBe(true); // 3rd
    expect(await at(later[2])).toEqual({ ok: false, reason: "too_many" });
  });
});
