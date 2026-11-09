# Zizu's Barbers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mobile-first barber site with own booking system, owner admin (bookings, live status, services, gallery) and DST-correct UK times.

**Architecture:** Next.js (App Router, TS) on Vercel; Supabase Postgres/Auth/Realtime/Storage. Times stored as UTC `timestamptz`, converted at the edge in Europe/London. Business rules (no overlap, extend-and-shift) live in Postgres functions. One codebase per shop, shop identity in `shop.config.ts`.

**Tech Stack:** Next.js, TypeScript, Tailwind, shadcn/ui, Luxon, Vitest, Supabase (CLI local stack, pgTAP), Resend, SMS provider (Twilio), Playwright (smoke).

**Spec:** `docs/superpowers/specs/2026-11-09-zizus-barbers-design.md`

## Global Constraints
- All booking times stored as `timestamptz`; shop hours stored as local wall-clock `time`; display zone `Europe/London`.
- Never add 24h to get "tomorrow"; add one calendar day in London zone.
- Prices in integer pence; durations in integer minutes.
- Public clients never write directly to tables; bookings only via RPC. All other writes owner-only (RLS).
- Mobile first: 44px+ tap targets, bottom-sheet booking, `prefers-reduced-motion` honoured.
- No ratings in JSON-LD unless real. No marketing SMS without consent.
- One barber seeded; every booking carries `barber_id`.

## Review Focus
- Booking at 01:30 on 25 Oct 2026 (ambiguous hour): must resolve to one instant, never two bookings.
- Slot on 29 Mar 2026 spring-forward day: 01:00-02:00 does not exist; no slot offered there.
- Two customers book the same slot concurrently: exactly one succeeds, other gets "slot just taken".
- Extend pushes a later booking past closing: returns conflict list, changes nothing.
- Large phone photo (10MB+) or non-image file uploaded to gallery: resized or rejected, never breaks the page.

---

## File Structure
- `shop.config.ts`: name, address, phone, theme tokens, timezone.
- `src/lib/time.ts`: London<->UTC helpers.
- `src/lib/slots.ts`: pure slot generation.
- `src/lib/supabase/{server,client}.ts`: clients.
- `supabase/migrations/*.sql`, `supabase/tests/*.sql`: schema, RPCs, RLS, pgTAP.
- `supabase/functions/notify/`: reminders and change notices.
- `src/app/(public)/...`, `src/app/book/...`, `src/app/booking/[token]/...`, `src/app/admin/...`: UI.

### Task 1: Scaffold
**Files:** Create Next.js app in project root, `shop.config.ts`, `vitest.config.ts`; `git init`.
**Produces:** `shopConfig: { name; address; phone; timezone: "Europe/London"; theme }`.
- [ ] **Step 1:** `npx create-next-app` (TS, Tailwind, App Router), add shadcn/ui, Luxon, Vitest, Supabase CLI (`supabase init`, `supabase start`).
- [ ] **Step 2:** Add a trivial Vitest test and `npm test`; Expected: PASS.
- [ ] **Step 3:** Commit.

### Task 2: Time helpers (DST fix)
**Files:** Create `src/lib/time.ts`, test `src/lib/time.test.ts`.
**Produces:** `londonToUtc(date: string, time: string): Date | null` (null if nonexistent local time); `utcToLondon(d: Date): DateTime`; `addLondonDays(d: Date, n: number): Date`.
- [ ] **Step 1:** Failing tests: `londonToUtc("2026-10-25","01:30")` returns a single instant; `londonToUtc("2026-03-29","01:30")` is null; `utcToLondon(new Date("2026-10-25T13:00:00Z")).toFormat("HH:mm")` is `"13:00"` and `"14:00"` for `2026-07-01T13:00:00Z`; `addLondonDays` across 25 Oct keeps same local time.
- [ ] **Step 2:** Run `npx vitest run src/lib/time.test.ts`; Expected: FAIL.
- [ ] **Step 3:** Implement with Luxon `DateTime.fromObject(..., {zone})`, checking `isValid` and round-trip.
- [ ] **Step 4:** Run; Expected: PASS. Commit.

### Task 3: Schema, constraints, RLS
**Files:** Create `supabase/migrations/001_schema.sql`, `002_rls.sql`, `supabase/seed.sql`, test `supabase/tests/schema.sql`.
**Produces:** tables `barbers, services, opening_hours, closures, bookings, booking_changes, shop_status, gallery` per spec section 5; `bookings` exclusion constraint `no_overlap` on `(barber_id, tstzrange(start_at,end_at,'[)'))` where status in `('pending','confirmed','arrived')`.
- [ ] **Step 1:** pgTAP tests: overlapping confirmed bookings raise 23P01; cancelled booking does not block; anon cannot insert into `services`; anon can select `services`, `gallery`, `shop_status`; anon cannot select `bookings`.
- [ ] **Step 2:** `supabase test db`; Expected: FAIL.
- [ ] **Step 3:** Write migrations (`btree_gist`, RLS policies owner = authenticated user in `owners` table) and seed (one barber, services from the old site: Hair Cut 14, Hair Cut and Beard 20, Beard 8, Hot Towel Shave 8, Face Mask 7, Hair Cut and Designs 5, Thread 5, Facial 20; durations as placeholders flagged for owner).
- [ ] **Step 4:** `supabase db reset && supabase test db`; Expected: PASS. Commit.

### Task 4: Slot generation
**Files:** Create `src/lib/slots.ts`, test `src/lib/slots.test.ts`.
**Consumes:** `londonToUtc`.
**Produces:** `generateSlots(input: { date: string; openLocal: string; closeLocal: string; durationMin: number; stepMin: number; busy: {start: Date; end: Date}[]; closed: boolean; now: Date }): Date[]`.
- [ ] **Step 1:** Failing tests: 09:30-20:00, 30-min service, empty day gives first slot 09:30 London; busy block removes overlapping starts; closed day gives `[]`; slots before `now` excluded; 29 Mar 2026 offers no slot in the missing hour; 25 Oct 2026 yields no duplicate instants.
- [ ] **Step 2:** Run; Expected: FAIL. **Step 3:** Implement. **Step 4:** PASS. Commit.

### Task 5: create_booking and availability RPCs
**Files:** Create `supabase/migrations/003_booking_rpc.sql`, test `supabase/tests/booking.sql`; `src/lib/booking.ts`.
**Produces:** SQL `create_booking(p_service uuid, p_start timestamptz, p_name text, p_phone text, p_email text) returns table(id uuid, cancel_token text)`; SQL `get_busy(p_from timestamptz, p_to timestamptz) returns setof (start_at, end_at)` (no customer data); TS `createBooking(args): Promise<{ok:true;token:string}|{ok:false;reason:"taken"|"invalid"}>`.
- [ ] **Step 1:** pgTAP: second identical call fails "taken"; end = start + service duration; `get_busy` exposes no personal columns; start outside opening hours rejected.
- [ ] **Step 2-4:** fail, implement, pass. **Step 5:** Commit.

### Task 6: extend_booking RPC
**Files:** Create `supabase/migrations/004_extend.sql`, test `supabase/tests/extend.sql`.
**Produces:** `extend_booking(p_id uuid, p_new_end timestamptz, p_reason text) returns jsonb` giving `{ok:true, moved:[ids]}` or `{ok:false, conflicts:[ids]}`.
- [ ] **Step 1:** pgTAP: extending 20 to 40 min pushes only following bookings that now overlap, by the minimum needed; a push past closing returns conflicts and leaves all rows unchanged; each move writes `booking_changes`; owner-only.
- [ ] **Step 2-4:** fail, implement (lock day rows `FOR UPDATE`, update last-to-first), pass. **Step 5:** Commit.

### Task 7: Public site (SSR)
**Files:** Create `src/app/(public)/page.tsx`, `src/components/{Hero,Services,Gallery,Hours,StatusBadge,StickyBar}.tsx`, `src/app/sitemap.ts`, JSON-LD in layout.
- [ ] **Step 1:** Playwright smoke at 375px width: home renders services from DB, sticky Book bar visible, no horizontal scroll, `HairSalon` JSON-LD present with no `aggregateRating`.
- [ ] **Step 2-4:** fail, implement using `frontend-design` skill and Midnight Gold tokens from `shop.config.ts`, pass. **Step 5:** Commit.

### Task 8: Booking flow UI
**Files:** Create `src/app/book/page.tsx`, `src/components/BookingSheet.tsx`.
**Consumes:** `generateSlots`, `get_busy`, `createBooking`.
- [ ] **Step 1:** Playwright: choose service, date, time, enter details, confirm; price and duration shown on each step; a taken slot shows "slot just taken" and reloads times.
- [ ] **Step 2-4:** fail, implement, pass. **Step 5:** Commit.

### Task 9: Customer booking page
**Files:** Create `src/app/booking/[token]/page.tsx`, SQL `get_booking_by_token`, `cancel_booking_by_token`.
- [ ] **Step 1:** Tests: valid token shows booking in London time; invalid token 404; cancel works before cutoff, refused after; banner shown when `booking_changes` exists; `.ics` has correct `TZID:Europe/London`.
- [ ] **Step 2-4:** fail, implement, pass. **Step 5:** Commit.

### Task 10: Admin auth and shell
**Files:** Create `src/app/admin/layout.tsx`, `src/app/admin/login/page.tsx`, `src/middleware.ts`.
- [ ] **Step 1:** Playwright: `/admin` redirects to login unauthenticated; owner email login reaches dashboard; non-owner user is refused.
- [ ] **Step 2-4:** fail, implement Supabase Auth magic link and owner check, pass. **Step 5:** Commit.

### Task 11: Admin day view and actions
**Files:** Create `src/app/admin/page.tsx`, `src/components/admin/{BookingRow,EditSheet}.tsx`, server actions.
**Consumes:** `extend_booking`.
- [ ] **Step 1:** Playwright (mobile): list today's bookings; mark arrived/done/no-show; "+10 min" calls `extend_booking` and shows moved bookings or conflict list; cancel; add manual booking.
- [ ] **Step 2-4:** fail, implement, pass. **Step 5:** Commit.

### Task 12: Live status
**Files:** Create `src/app/admin/status/page.tsx`, update `StatusBadge.tsx` with Realtime plus 30s poll fallback.
- [ ] **Step 1:** Test: owner changes `in_shop` +1; public badge updates without reload; badge falls back to polling when subscription errors.
- [ ] **Step 2-4:** fail, implement, pass. **Step 5:** Commit.

### Task 13: Admin settings
**Files:** Create `src/app/admin/settings/page.tsx` (services, hours, closures).
- [ ] **Step 1:** Test: editing a service duration changes slots offered on `/book` and the price on home; a closure removes that day's slots; holiday shown on public site.
- [ ] **Step 2-4:** fail, implement, pass. **Step 5:** Commit.

### Task 14: Gallery management
**Files:** Create `supabase/migrations/005_storage.sql`, `src/app/admin/gallery/page.tsx`, `src/lib/image.ts`.
**Produces:** `resizeForUpload(file: File): Promise<Blob>` (max 1600px long edge, JPEG ~0.8; rejects non-image).
- [ ] **Step 1:** Tests: 10MB image resized under 500KB; PDF rejected; anon cannot upload or delete (storage RLS); owner upload appears on public gallery; delete removes row and object; reorder persists `sort`.
- [ ] **Step 2-4:** fail, implement (camera/roll input, bucket `gallery`, public read), pass. **Step 5:** Commit.

### Task 15: Notifications
**Files:** Create `supabase/functions/notify/index.ts`, cron migration `006_cron.sql`.
- [ ] **Step 1:** Tests (function level, provider mocked): confirmation sent on booking; reminders at 24h (SMS) and 2h (email) computed in UTC correctly across 25 Oct 2026; change notice sent only to bookings in `booking_changes`; no duplicate sends (sent flags).
- [ ] **Step 2-4:** fail, implement, pass. **Step 5:** Commit.

### Task 16: Compliance and SEO
**Files:** Create `src/app/{privacy,cookies}/page.tsx`, `src/app/robots.ts`, `redirects` in `next.config.ts`; privacy delete-my-data route.
- [ ] **Step 1:** Tests: privacy page lists processors; analytics is cookieless; old URLs 301 to new pages; delete route anonymises a customer's bookings.
- [ ] **Step 2-4:** fail, implement, pass. **Step 5:** Commit. Legal wording to be checked before launch (spec section 8).

### Task 17: Deploy and cutover
**Files:** Create `docs/cutover.md`.
- [ ] **Step 1:** Create paid Vercel and Supabase projects; set env vars; deploy to preview URL; run full test suite and mobile manual pass on iOS Safari and Android Chrome.
- [ ] **Step 2:** Export GoDaddy DNS zone; lower TTL a day ahead; add domain in Vercel.
- [ ] **Step 3:** Change only apex A and www CNAME (leave MX/SPF/TXT); verify HTTPS, a test booking and a test email; update Google Business Profile Book link; keep old site live one week.
- [ ] **Step 4:** Handover: owner creates own accounts (GoDaddy, Supabase, Vercel, SMS), owner trained on admin.
