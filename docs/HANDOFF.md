# Handoff: Zizu's Barbers (written 15 November 2026)

## 0. LATEST STATE (end of session 2, 15 November 2026): read this before anything else
- **Demo is live** at https://zizusbarber.vercel.app (Vercel Hobby, team "areezmuhammed's projects", production branch `build/zizus-barbers` at `2068031`). Per-deployment URLs (`zizusbarber-<hash>-...vercel.app`) ask for a Vercel login by design; share only the main URL. The Vercel connector in the Claude app showed 0 projects for that team, so it may be a different login; ask the developer before using it.
- **Personal Supabase project `acppxnvjxihdxfabzyam`** ("elonnmuskmelon@gmail.com's Project") has: migrations 001-018 applied; demo data (1 barber, 8 placeholder services, Tue-Sun 09:30-20:00, Monday closed); owner row for auth user `10613acd-9b79-400c-ab29-e723a4130fee` (the developer's Gmail); 6 gallery photos. `notify` is NOT deployed (no SMS/email).
- **The 6 gallery photos are AI-generated** (Codex imagegen) placeholders for the private demo. Never present them as the shop's real work on a public launch.
- **Still to do by the developer (dashboards):** Supabase Auth URL Configuration (Site URL = https://zizusbarber.vercel.app, redirect `https://zizusbarber.vercel.app/auth/callback**`, optionally `http://localhost:3000/auth/callback**`); turn OFF the OAuth Server and "Allow new users to sign up"; Vercel `NEXT_PUBLIC_SITE_URL=https://zizusbarber.vercel.app` then redeploy. Until then owner magic links fall back to localhost (seen: `otp_expired` on localhost). Open the magic link on the same phone/browser that requested it (PKCE).
- **Branch `feat/admin-refresh`** (one commit on top of the docs; not pushed, not merged): admin bottom tab bar, booking cards, big Status counters, 320px Settings overflow fix, new e2e. Gates were green: tsc, Vitest 237, pgTAP 265 (after `db reset`), Playwright 56, build. The developer is **not satisfied with the overall look** and wants a new direction (next point); treat this branch as a starting point, not final.
- **New design direction:** the developer wants the public site (and the admin to match) to feel like https://originalbarbershop.nyc: warm, photo-led, not "depressing black". Analysis: `docs/research/2026-11-15-reference-original-barbershop.md`. It supersedes the "midnight black" look in the frontend plan where they conflict. Needs a brainstorm and approval before building.
- Local notes: Docker Desktop must be running for the local stack. `pgTAP gallery.sql` fails if the local gallery has rows: run `npx supabase db reset` before `supabase test db`. Only one `next dev` per project can run (Playwright's server on 3107 fails if the preview on 3000 is running). Helper scripts used this session (local-only owner link, gallery upload) lived in the session scratchpad and are not in the repo.

Read this first in a new session. Then `AGENTS.md`, `docs/launch-checklist.md`, `docs/cutover.md` and `docs/research/README.md`.

## 1. What this is
Mobile-first website and booking system for Zizu's Barbers (135 Upperthorpe Rd, Sheffield S6 3EB, 07535 423544), replacing zizusbarbers.com (a Vite SPA that links out to YouCanBookMe). It is a **personal freelance project**; the developer must show a **demo first** and only moves to paid hosting if the owner says yes. Nothing is deployed yet.

Owner's four asks (all built): (1) fix the October clock-change time bug; (2) full control of bookings, including making a cut longer and pushing later ones back, visible to customers; (3) live shop status for customers; (4) upload and delete gallery photos. A second shop (owner's friend) may follow: reuse the code as a template, one deployment per shop.

## 2. State of the code
- Branch `build/zizus-barbers` (remote `origin` = github.com/areezmuhammed/Zizusbarber). All 17 planned tasks plus a final-review fix wave are built, reviewed and merged on that branch. Last code commit `956f598`; this docs commit comes after it. `main` holds only the original design docs. Nothing has been merged into `main`.
- Stack: Next.js 16 (App Router, `cacheComponents`, `proxy.ts` not middleware), TypeScript, Tailwind v4, shadcn/ui, Luxon, Supabase (Postgres, Auth magic link, Realtime, Storage, one Edge Function `notify`), Vitest, Playwright, pgTAP.
- Tests last run green: pgTAP 265, Vitest 237, Playwright 55 (`--workers=1`), build OK. The build needs a reachable Supabase because the home page prerenders DB data.
- Migrations `supabase/migrations/001..018` (there is **no 006** on purpose). Final function definitions are the LATEST `create or replace` (e.g. `create_booking` is in 017, `anonymise_customer_by_token` in 016, `extend_booking` in 011, `cancel_booking_by_token` in 013).
- Key behaviours: UTC instants stored, shown in Europe/London; double-booking blocked by an exclusion constraint; `extend_booking` pushes later bookings or refuses without changing anything; booking abuse caps (3 upcoming per phone, 5 created per phone per 24h, 20 public bookings per hour, 90-day horizon, UK phone format); reminders 24h and 2h with a once-only `notifications` table; erase-my-data only touches the one booking; hashed-phone anti-abuse log purged hourly.
- Owner admin: `/admin` (email magic link, owner only): Today (arrived/done/no-show/cancel/+N min/add booking/stop reminders), Status (live counters), Settings (services, hours, closures), Gallery (upload/delete/reorder).

## 3. SECRETS AND ACCOUNTS: read carefully
- **The Supabase connector/MCP tools in the Claude app are the developer's COMPANY account. Never call any `mcp__*supabase*` tool for this project.** Also never touch the unrelated `energen-e2e-stack` Docker containers.
- The developer has now created a **personal Supabase project** for this demo. Its values are in `C:\Users\areee\OneDrive\Desktop\Saloon\.env` (git-ignored; verified with `git check-ignore`). Variable names only: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`. **Never print, log, paste or commit values.** Load them in a shell with `set -a; . ./.env; set +a` rather than reading the file into chat.
- `.env.local` (also ignored) points the app at the LOCAL Docker stack (`zizus-barbers`, ports 56320-56329) using well-known local demo keys. Keep local dev on local.
- Before any `supabase link`, `db push` or `functions deploy`, get the developer's explicit go-ahead and confirm the project ref in `.env` is the personal project (not the company one). These change a remote system.

## 4. Running locally
```
docker desktop running
npx supabase start            # local stack, project_id zizus-barbers
npx supabase db reset && npx supabase test db
npm test
npx playwright test --workers=1    # run `rm -rf .next` first if admin pages loop on "Loading"
npm run build
npm run dev
```
Playwright specs share one barber's slots, hence one worker. A dev-only `Date.now()` prerender warning on admin routes is harmless.

## 5. Demo plan (decided)
1. Show the demo before paying for anything. Use the **personal Supabase free project** and a free Vercel Hobby deployment (verify Hobby's non-commercial terms cover a prospect demo); move to Vercel Pro and Supabase Pro only after the owner agrees.
2. Pushing to the personal Supabase project: apply migrations 001-018 (`supabase link` with `SUPABASE_PROJECT_REF`, then `db push`; on a fresh project it applies in order). **`supabase/seed.sql` does not run on `db push`**, so the demo project also needs: one `barbers` row, the services, the weekly `opening_hours` rows (Tue-Sun 09:30-20:00, Monday closed, placeholders), and an `owners` row for the owner's auth user. `shop_status` is created by migration 016. Use SQL run against the personal project only.
3. Auth settings in that project: Site URL and redirect allow-list `${SITE_URL}/auth/callback`, disable open sign-ups, invite the owner user.
4. For a demo, the `notify` function can be left undeployed (no SMS/email needed). If deployed it returns 503 until all provider secrets exist, by design.
5. Vercel env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`. The app does not read the service-role key. Details: `docs/cutover.md`.

## 6. Frontend direction (decided, not started)
See `docs/research/2026-11-15-frontend-design-plan.md`. Decisions: some photos available, luxury **editorial**, **balanced** animation (CSS first), balanced business priority. **PR 1 = photographic hero** (new `src/components/marketing/HeroVisual.tsx`, changes in `Hero.tsx`, `globals.css`, `e2e/home.spec.ts`); then services, gallery, booking micro-interactions, shop story, optional cinematic experiment. Inputs still needed: an approved real photograph, a performance baseline, tagline approval. Do not add GSAP, Lenis, Three.js or Motion in PR 1.

## 7. Open decisions and gaps
- Optional shop-wide daily booking cap (~60/day) to bound SMS cost and diary-filling: offered, not decided.
- Owner answers needed: real service durations (seed values are placeholders), opening time 09:30 vs 10:00, price of "Hair Cut and Designs" (£5, looks like an add-on), contact mailbox (`bookings@zizusbarbers.com` is a guess), ICO number, whether to retire the Treatwell and Fresha listings.
- Not built: edit a booking's name/phone/start time; owner-changeable hero image; drag-to-reorder (buttons instead); walk-in queue with automatic wait estimate; deposits; waitlist; review prompts.
- Launch gates (see `docs/launch-checklist.md`): legal review of privacy/cookie text; Twilio UK-only geo permissions and spend alert; Resend domain verification; deploy `notify` and call it once with the secret; supabase/Vercel dashboard limits; real-phone testing; DNS cutover.
- Post-launch list (minor, deferred): see section 8.

## 8. Known minor items (deferred)
ics `esc()` bare CR; remove the storage object when a gallery insert fails; double-tap race on "+10 min"; ConfirmDelete focus and aria-label mismatch; clearer HEIC upload message and decode memory; unique index on `gallery.storage_path`; banner shows after a booking is done; stale day chips after midnight; 15-minute slot step may fragment gaps; e2e coverage for the owner "Stop reminders" toggle; two-session lock-ordering test; `connect()` generation order in `live-status.ts`; `get_busy` and bookings index review at scale; all six notification provider variables are required (no SMS-only or email-only setup yet).

## 9. How the project was built (so you can continue the same way)
Spec and plan are in `docs/superpowers/specs/` and `docs/superpowers/plans/`. Work ran test-first, one subagent per task, each followed by an independent review and a fix loop, then a whole-branch review. The detailed ledger of rulings and per-task findings is in `.superpowers/sdd/2026-11-09-zizus-barbers/progress.md` on the developer's machine (git-ignored, local only).
