# Deploy and domain cutover runbook

> **WARNING: accounts.** Use NEW Supabase/Vercel projects created under the owner's own accounts. Never use any
> other company or personal account's Supabase project; do not run `supabase link` against an existing project.
> The only `supabase link` in this runbook (B) is to the brand-new project created in the owner's org in B.

Zizu's Barbers (Sheffield). Written for a developer new to the project. Work top to bottom; tick each box.
Legal / ICO / copy items live in `docs/launch-checklist.md` and are referenced, not repeated, here. Notification
internals: `docs/notifications.md`. Erasure/retention: `docs/privacy-ops.md`.

Conventions: `<angle-brackets>` are placeholders you fill in. NEVER paste real keys into this file, chat or git.
Commands assume Git Bash in the repo root. Anything marked **verify** was not checked against a live account.

Order of play: A accounts -> B Supabase -> C Edge Function -> D Vercel preview -> E verify on preview ->
F DNS cutover -> G post-launch. Do not start F until E is fully ticked and the owner has signed off.

---

## A. Accounts and ownership

The OWNER creates and pays for every account in their own name; the developer is added as a collaborator.
(Handover then needs no transfers.) Use one owner-controlled mailbox as the login for all of them.

- [ ] GoDaddy: owner already has it (holds the domain `zizusbarbers.com` and its DNS). Developer gets delegate access
      (GoDaddy "Delegate Access") or the owner does the DNS edits on a call. Never share the password.
- [ ] Supabase: owner creates an organisation on the **Pro** plan (daily backups, no pausing); invites the developer
      as Developer/Admin on the org.
- [ ] Vercel: owner creates a **Pro** team (Hobby does not permit commercial use); invites the developer as a member.
- [ ] Resend: owner signs up (free tier); developer invited as a team member.
- [ ] Twilio: owner signs up, adds billing, buys/registers a UK-capable sender (alphanumeric sender ID or UK number;
      UK sender rules apply, **verify** current requirements). Developer invited as a user.
- [ ] Owner enables 2FA on all five.
- [ ] Owner has a mailbox for `bookings@zizusbarbers.com` (it is `shopConfig.email` in `shop.config.ts`) and for
      the email used to log in to the admin (can be the same).

Indicative running costs (**verify current pricing on each vendor's site before quoting the owner**):

| Service | Plan | Approx. cost |
|---|---|---|
| Supabase | Pro | ~$25 / month per project |
| Vercel | Pro | ~$20 / month per user (one seat is enough) |
| Resend | Free tier | $0 at this volume (check the daily/monthly email caps) |
| Twilio | Pay as you go | ~GBP 0.04 per UK SMS, plus number/sender fees; reminders + confirmations + changes all use SMS |
| GoDaddy | Domain renewal | owner's existing plan |

Who pays: the owner, directly, on their own cards. Rough total about $45-50 / month plus SMS usage.

---

## B. Supabase production project

- [ ] Create the project in the owner's org. Region: **EU (London, `eu-west-2`) if offered**, else Frankfurt/Ireland
      (data stays in the UK/EU; the privacy page talks about transfers). Save the database password in the owner's password manager.
- [ ] Install/use the CLI via npx (no global install needed): `npx supabase --version`.
- [ ] Link: `npx supabase login` (opens browser) then
      `npx supabase link --project-ref <project-ref>` (ref is in the dashboard URL / Project Settings).
- [ ] Apply migrations: `npx supabase db push`.

  Migration numbering is non-contiguous: `001`-`005` then `007`-`017` (there is **no 006**; this is expected).
  On a FRESH production project `db push` applies all of them in filename order, which works. `--include-all` is only
  needed on a database that already applied later migrations out of order (not the case for a new project).
  Do not run `seed.sql` on production (it is local-only sample data, see "Seed" below).

  | File | What it does |
  |---|---|
  | `001_schema.sql` | Tables: owners, barbers, services, opening_hours, closures, bookings (no-overlap exclusion constraint), booking_changes, shop_status, gallery |
  | `002_rls.sql` | `is_owner()` and row-level security on every table |
  | `003_booking_rpc.sql` | `create_booking` RPC (hours/overlap checks, returns cancel token) |
  | `004_extend.sql` | `extend_booking` (owner +10 min; pushes later bookings, rejects past closing) |
  | `005_storage.sql` | Public `gallery` bucket (5 MB, jpeg/png/webp), owner-only write policies, `move_gallery_photo` |
  | `007_customer_booking.sql` | Customer manage-link RPCs (`get_booking_by_token`, cancel by token) |
  | `008_realtime.sql` | Adds `shop_status` to the Realtime publication, count/note caps |
  | `009_admin_fixes.sql` | Day-lock fixes for `extend_booking`; owner walk-in up to 5 min in the past |
  | `010_settings.sql` | One hours row per weekday constraint; owner settings support |
  | `011_notifications.sql` | `notifications` table (claim-before-send), `bookings.cancelled_by`, extend logs changes |
  | `012_notify_cron.sql` | Enables `pg_cron` and `pg_net`; schedules `notify-every-5-min` (does nothing until Vault secrets exist) |
  | `013_cancelled_by_explicit.sql` | Who cancelled is set explicitly (customer vs shop); trigger fallback to shop |
  | `014_privacy.sql` | `anonymise_customer_by_token`, `anonymise_old_bookings`, daily `anonymise-old-bookings` cron job |
  | `015_reminders_opt_out.sql` | `bookings.reminders_off`, `set_reminders_off_by_token`, scrub `booking_changes.reason` |
  | `016_hardening.sql` | Erasure by token = that booking only; `create_booking` UK-phone/length/90-day/3-per-phone limits; `get_busy` 31-day clamp; the `shop_status` row; lookup indexes |
  | `017_booking_abuse_limits.sql` | `public_booking_log` (md5 of phone + time, kept 24h); public `create_booking` capped at 5 bookings per phone per 24h (cancelled included) and 20 per hour shop-wide |

- [ ] Confirm: `npx supabase migration list` shows every file applied (Local and Remote columns match).
- [ ] Seed (production data by hand, not `seed.sql`): in the dashboard SQL editor or the owner's admin (Settings),
      create the barber, the services (names, prices, durations) and opening hours (the single `shop_status` row is created by migration 016). `supabase/seed.sql`
      is the template: copy its statements, but fix the placeholders first (durations, 09:30 vs 10:00, "Hair Cut and Designs"
      price; see E3). A row in `barbers` is required or booking fails. **verify** the exact required rows against
      `supabase/seed.sql` (barber, services, opening_hours; check `select count(*) from shop_status` = 1).
- [ ] Owner login user: Dashboard -> Authentication -> Users -> **Invite user** (or Add user) with the owner's
      email. Copy the new user's UUID. Then in the SQL editor:
  ```sql
  insert into public.owners (user_id) values ('<owner-auth-user-uuid>');
  ```
  The admin area only admits ids present in `public.owners` (`is_owner()`).
- [ ] Auth settings (Authentication -> URL Configuration / Providers / Sign In):
  - [ ] Site URL = `https://zizusbarbers.com` at cutover. While testing on the preview, set it to the preview URL
        (and switch it back in F).
  - [ ] Redirect allow-list: `${SITE_URL}/auth/callback` (production) and, during testing, `<preview-url>/auth/callback`.
        The app asks for `/auth/callback?next=/admin`; if sign-in links land on the Site URL instead, widen the entry
        to `${SITE_URL}/auth/callback**` (**verify** Supabase wildcard matching for query strings).
  - [ ] **Allow new users to sign up: OFF** (the app also uses `shouldCreateUser: false` in `src/app/admin/actions.ts`, belt and braces).
  - [ ] Magic-link email template (Authentication -> Email Templates -> Magic Link): plain wording in the shop's name, link kept.
        Also tidy the Invite template.
  - [ ] Rate limits (Authentication -> Rate Limits): the built-in mailer allows only a handful of emails per hour; after
        custom SMTP is set, raise "emails sent per hour" to something sane (e.g. 30) and keep the sign-in limits at defaults.
  - [ ] Custom SMTP via Resend (Authentication -> Emails -> SMTP Settings): host `smtp.resend.com`, port 465 or 587,
        user `resend`, password = a Resend API key created for SMTP (store only in the Supabase field), sender
        `bookings@zizusbarbers.com` (**verify** current Resend SMTP settings). The sending domain must be verified in Resend first (see F7).
        Without this, owner magic links are throttled and may land in spam.
- [ ] Storage: Storage -> Buckets shows `gallery` (public, 5 MB limit, image/jpeg, image/png, image/webp). It is
      created by `005_storage.sql`; do not recreate it. Project-wide upload limit (Storage settings) must be >= 5 MB.
- [ ] Extensions: Database -> Extensions shows `pg_cron` and `pg_net` enabled (migration 012 enables them; if the
      push errored on permissions, enable them here and re-run `db push`).
- [ ] Vault secrets for the cron job (names only; values are set in C2). In the SQL editor:
  ```sql
  select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/notify', 'notify_url');
  select vault.create_secret('<same value as the CRON_SECRET function secret>', 'cron_secret');
  ```
  Per `docs/notifications.md`, migration 012 already created the job `notify-every-5-min`; with the two Vault secrets
  missing it does nothing. Confirm: `select jobname, schedule, active from cron.job;` lists `notify-every-5-min`
  and `anonymise-old-bookings`.
- [ ] Copy for D: Project Settings -> API: Project URL and the **anon (public) key**. Do NOT copy the service role
      key anywhere except (if ever needed) Supabase itself.

- [ ] **Abuse limits (anonymous booking and SMS cost).** Booking is public and every booking can send an SMS billed
      to the owner. The database already refuses non-UK phones, bookings more than 90 days ahead and a 4th upcoming
      booking per phone (`016_hardening.sql`), and the notify job only texts UK mobiles (`+447`; landlines get
      email if they gave one, else nothing). Two more database caps apply to the public only (`017_booking_abuse_limits.sql`;
      the owner's own bookings from the admin are exempt and never counted):
  - **5 bookings per phone per 24 hours**, cancelled ones included, so book -> cancel -> rebook cannot text one
    number forever. The customer sees "You have made several bookings recently, please call us...".
  - **20 public bookings per hour for the whole shop**, so a script rotating fake numbers cannot fill the diary
    or text hundreds of strangers. Customers then see "We are getting a lot of requests right now...". Real
    volume is a few an hour; if the shop ever hits this legitimately, raise it.
  - The numbers are the constants `c_phone_per_day` and `c_shop_per_hour` at the top of `create_booking` in
    `supabase/migrations/017_booking_abuse_limits.sql`. To raise them, add a new migration that create-or-replaces
    `create_booking` (copy of 017 with the new numbers) and `db push` it; never edit an applied migration.
    To unblock now, as SQL: `delete from public_booking_log;` (it only holds the last 24h of public bookings).
  - These caps do not replace the dashboard limits below: keep the Vercel firewall rule and Supabase rate limits.
  Also:
  - [ ] Twilio -> Messaging -> Settings -> **Geo permissions**: allow **United Kingdom only** (blocks SMS pumping to
        premium foreign numbers even if a bad number gets in).
  - [ ] Twilio -> Billing / Usage -> **usage trigger / spend alert** (e.g. email at GBP 10 per day and GBP 30 per
        month); consider auto-recharge OFF so spend is capped by the balance (**verify** current Twilio menu names).
  - [ ] Vercel -> Project -> Firewall -> **rate limit rule** on `POST /book` (server actions post to the page),
        e.g. 10 requests per minute per IP, action Deny/429 (**verify** availability on the plan).
  - [ ] Supabase -> Project Settings -> API / Auth rate limits: keep the defaults or lower them; the anon key is
        public, so `create_booking` can also be called directly on the REST API (the database limits above still apply;
        still recommended, as they stop a flood before it reaches the 017 caps and locks out real customers).
  - [ ] Junk bookings: list them, then cancel by phone. `cancelled_by = 'customer'` and `reminders_off` mean no
        message is sent to the junk number:
    ```sql
    select id, customer_name, phone, start_at from bookings
    where phone = '+44...' and status in ('pending', 'confirmed') and start_at > now() order by start_at;

    update bookings set status = 'cancelled', cancelled_by = 'customer', reminders_off = true
    where phone = '+44...' and status in ('pending', 'confirmed') and start_at > now();
    ```

---

## C. Edge Function `notify`

The function sends confirmations/reminders/change/cancel notices (email via Resend, SMS via Twilio).

- [ ] C1. Generate a long random `CRON_SECRET` (e.g. `openssl rand -hex 32`). Keep it in the password manager.
- [ ] C2. Set secrets (names from `.env.example`; supply values from each dashboard, never commit):
  ```sh
  npx supabase secrets set CRON_SECRET=<value> SITE_URL=https://zizusbarbers.com \
    RESEND_API_KEY=<value> EMAIL_FROM="Zizu's Barbers <bookings@zizusbarbers.com>" \
    TWILIO_ACCOUNT_SID=<value> TWILIO_AUTH_TOKEN=<value> TWILIO_FROM=<+44... or sender id>
  npx supabase secrets list      # names only; confirm all seven exist
  ```
  `SITE_URL` is used to build the customer manage link in messages, so set it to the FINAL domain even before cutover
  (messages sent during testing then link to a not-yet-live domain; for preview testing temporarily use the preview URL, then reset).
  `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase automatically; do not set them.
- [ ] C3. Deploy: `npx supabase functions deploy notify` (`verify_jwt = false` is set in `supabase/config.toml`; the
      function authenticates `x-cron-secret` itself).
- [ ] C4. **LAUNCH GATE.** Call it once and confirm it works:
  ```sh
  curl -i -X POST -H "x-cron-secret: <CRON_SECRET>" -H "Content-Type: application/json" -d '{}' \
    https://<project-ref>.supabase.co/functions/v1/notify
  ```
  Expect `HTTP 200` and a JSON summary like `{"sent":0,"failed":0,"skipped":0}`. Interpret failures:
  - `401 unauthorized`: wrong/missing secret header.
  - `503 {"error":"not_configured","missing":[...]}`: a provider secret is missing (the body names which). Fix C2 and retry. Nothing is lost; the function fails closed before claiming any row.
  - `500` / bundle error on deploy: see C5.
- [ ] C5. Only if the deploy fails to bundle: `supabase/functions/notify/index.ts` imports from outside the function
      folder (`../../../src/lib/notify/core.ts`, `../../../src/lib/notify/providers.ts`, `../../../shop.config.ts`).
      If the CLI cannot bundle those paths, move the shared code into the function tree:
  1. `mkdir supabase/functions/_shared` and move (or copy) `src/lib/notify/core.ts`, `src/lib/notify/providers.ts` and a copy of the needed `shopConfig` fields into it.
  2. Change the three imports in `index.ts` to `../_shared/core.ts`, `../_shared/providers.ts`, `../_shared/shop.config.ts`.
  3. Have `src/lib/notify/*` re-export from there (or keep the tests importing the moved files) so Vitest still passes; run `npm test`.
  4. Redeploy and repeat C4.
  Not verified against a real deploy (the bundling is untested in this repo): treat C4 as a hard gate.
- [ ] C6. After a few minutes confirm the schedule ran and reached the function:
  ```sql
  select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
  select status_code, content from net._http_response order by id desc limit 5;
  ```
  Expect `200` rows every 5 minutes. 503 = missing function secret; 401 = Vault `cron_secret` != `CRON_SECRET`.

---

## D. Vercel preview deployment

- [ ] Vercel -> Add New -> Project -> import the Git repo, branch `build/zizus-barbers` (or `main` once merged). Framework preset: **Next.js**
      (build `npm run build`, install `npm install`; defaults are right). Node: Vercel default (the repo uses `@types/node` 22; **verify** the project Node version setting is 22.x).
- [ ] Environment variables (Production AND Preview). Checked against the code (`grep process.env src`):

  | Name | Required? | Notes |
  |---|---|---|
  | `NEXT_PUBLIC_SUPABASE_URL` | YES | Used by every Supabase client and `src/proxy.ts` |
  | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | YES | Anon key only |
  | `NEXT_PUBLIC_SITE_URL` | YES | Magic-link redirect origin (`src/app/admin/actions.ts`) and `metadataBase` (`src/app/layout.tsx`). Inlined at build: redeploy after changing. Falls back to `shopConfig.url` in production if unset, but set it explicitly |
  | `SUPABASE_SERVICE_ROLE_KEY` | **NO** | Not read by the Next.js app. Only the test files and the Edge Function (where Supabase injects it) use it. Do NOT add it to Vercel. |
  | `PLAUSIBLE_DOMAIN`, `PLAUSIBLE_SRC` | Optional | Cookieless analytics, off while unset (`docs/launch-checklist.md`) |

  For the preview deployment, `NEXT_PUBLIC_SITE_URL` = the preview URL (so magic links return to the preview); at cutover (F) set it to `https://zizusbarbers.com` and redeploy.
- [ ] Build-time requirement: `cacheComponents: true` (`next.config.ts`) means pages prerender at build and read the
      database, so **Supabase must be reachable and migrated/seeded before the first Vercel build**, or the build fails/empty pages. Do B before D.
- [ ] Deploy; open the `*.vercel.app` URL. Confirm `/` shows services and hours, `/book` loads slots.
- [ ] Add the preview URL to Supabase redirect allow-list (B) for testing the owner login.
- [ ] Before this step, locally: `npm run build`, `npx tsc --noEmit`, `npm test` are green (integration tests need the local Supabase stack; see `docs/notifications.md`). E2E: `npx playwright test` (config `playwright.config.ts`, specs in `e2e/`; needs the local stack, **verify** how it starts the server).

---

## E. Pre-cutover verification (on the preview URL)

Use a real iPhone (Safari) and a real Android phone (Chrome) for the starred items. Use a test booking with the
developer's own phone number/email for anything that sends.

- [ ] E1. Customer flow*: pick service -> date -> time -> details -> confirm; confirmation email/SMS arrives within ~5 min with a working manage link.
- [ ] Owner login*: `/admin/login`, enter the owner email, magic link arrives (via Resend SMTP), opens `/admin`. A non-owner email gets no access. Signup is off.
- [ ] Owner day view: add a walk-in booking, extend by +10 min (later bookings shift; refused past closing), cancel a booking (customer gets a cancellation SMS), mark status.
- [ ] Live status*: change status/in-shop/waiting on one device; the public badge updates on a second device without refresh (Realtime).
- [ ] Gallery*: upload a photo straight from the phone camera (<=5 MB jpeg/png/webp; larger or HEIC-only should be refused with a clear message, **verify** behaviour with iPhone HEIC), reorder with up/down buttons, delete.
- [ ] Settings: edit hours/prices/closures; the public site shows the change immediately (no stale cache).
- [ ] Reminders: book a test slot > 24 h away to your own phone; confirm the 24 h and 2 h SMS (or shift the test by creating bookings near those windows); "Stop reminder messages" on the manage page stops them.
- [ ] Customer cancel link: cancels, sends no shop notice. "Delete my data": booking shows anonymised, old link 404s.
- [ ] `/privacy` and `/cookies` render (legal sign-off is tracked in `docs/launch-checklist.md`).
- [ ] Clock changes: automated tests cover 25 Oct 2026 and 29 Mar 2026 (`src/lib/slots.test.ts`, `src/lib/time.test.ts`, `src/lib/booking-form.test.ts`). Manually spot-check by browsing to those dates on `/book` (slots stay on London local time; no missing or duplicate hour).
- [ ] Lighthouse (mobile, Chrome DevTools) on `/` and `/book`. Targets, not claims: Performance >= 90, Accessibility >= 95, Best Practices >= 95, SEO >= 95. Record actual numbers.
- [ ] PWA: add to home screen on both phones; icons are placeholders (`public/icon-192.png`, `public/icon-512.png`).
- [ ] `/robots.txt` and `/sitemap.xml` respond (sitemap uses `shopConfig.url`, so it shows the production domain even on preview).
- [ ] Monitor `select * from notifications order by created_at desc limit 20;` for `failed` rows during the tests.

### E3. Content to confirm with the owner (also see `docs/launch-checklist.md`, "With the owner")

- [ ] Service durations (seed values are placeholders).
- [ ] Opening time 09:30 (old site) vs 10:00 (Treatwell); shop closed Mondays.
- [ ] "Hair Cut and Designs" price (seed has 500 pence next to Hair Cut at 1400).
- [ ] Contact mailbox `bookings@zizusbarbers.com` exists and is monitored.
- [ ] ICO registration number (`shopConfig.privacy.icoRegistration`, null for now).
- [ ] Treatwell/Fresha: retire or keep (two diaries risk double bookings).
- [ ] Owner knows: the hero image cannot be changed by the owner yet; gallery reorder uses buttons (no drag); a booking's name/phone/time cannot be edited yet (cancel and rebook).
- [ ] Owner sign-off on the preview, in writing (message is fine).

---

## F. DNS cutover on GoDaddy

Nameservers stay at GoDaddy. Only two records change.

- [ ] F1. Export the current zone: GoDaddy -> DNS -> Manage Zones (or domain DNS page) -> export/copy the zone file; also take screenshots. Store with the runbook. This is the rollback source.
- [ ] F2. At least 24 h before: lower the TTL of the apex `A @` and `CNAME www` to 300 seconds. (Wait for the OLD TTL to expire first.)
- [ ] F3. In Vercel: Project -> Settings -> Domains -> add `zizusbarbers.com` and `www.zizusbarbers.com`. Choose ONE canonical host and redirect the other to it (the app does not do this; `next.config.ts` notes it). Vercel then shows the exact records to create. Typically:
      `A  @    76.76.21.21` and `CNAME  www  cname.vercel-dns.com`.
      **Verify in the Vercel dashboard; these values may have changed.** Use what Vercel shows.
- [ ] F4. Resend: add the domain `zizusbarbers.com`; Resend shows SPF, DKIM (and suggests DMARC) TXT/CNAME records. Add them exactly as shown, in GoDaddy, and click Verify in Resend (do this well before F6 so email is ready).
      Do not replace an existing SPF TXT; merge the `include:` mechanism into the one SPF record if the domain already has one (**verify**: only one SPF record is allowed).
- [ ] F5. Pre-flight checks: Supabase Site URL/redirects are ready to switch (B); function secret `SITE_URL` is `https://zizusbarbers.com` (C2); Vercel `NEXT_PUBLIC_SITE_URL` will be production.
- [ ] F6. **Cutover** at a quiet time. Suggested: Monday morning (shop closed Mondays), TTL already at 300.
  - [ ] In GoDaddy edit ONLY: apex `A @` and `CNAME www` to the Vercel values. Delete any conflicting old `A`/`CNAME` for those two names (a CNAME cannot coexist with other records on the same name; old parking/forwarding records also conflict).
  - [ ] Leave MX, SPF/TXT, DKIM and every other record untouched. Do NOT change nameservers.
  - [ ] A stale `_acme-challenge` TXT record can block Vercel's SSL issuance; delete it if Vercel's certificate stays pending (**verify**).
  - [ ] Set Vercel `NEXT_PUBLIC_SITE_URL=https://zizusbarbers.com` and redeploy (it is inlined at build).
  - [ ] Supabase Auth: Site URL = `https://zizusbarbers.com`; allow-list has `https://zizusbarbers.com/auth/callback`; remove the preview URL entries afterwards.
  - [ ] Wait for Vercel to show "Valid Configuration" and a certificate (minutes to a couple of hours).
- [ ] F7. After cutover verify:
  - [ ] `https://zizusbarbers.com` loads over HTTPS (padlock), and `www` redirects to the canonical host (and `http` to `https`).
  - [ ] Place a real booking; confirmation email AND SMS arrive with a manage link on the real domain.
  - [ ] Owner can sign in by magic link on the real domain.
  - [ ] Existing email still works (send/receive on `bookings@` and any other mailbox).
  - [ ] `https://zizusbarbers.com/robots.txt` and `/sitemap.xml` return correctly.
  - [ ] Old URLs return 301 to the new pages (map in `src/lib/redirects.ts`): `/index.html`, `/home` -> `/`; `/services`, `/prices` -> `/#services`; `/gallery` -> `/#gallery`; `/contact` -> `/#hours`; `/booking` -> `/book`. Check with `curl -I https://zizusbarbers.com/services`. Add any other real old paths you find.
  - [ ] `dig +short zizusbarbers.com` / `nslookup` from a few networks shows the Vercel IP.
- [ ] F8. Keep the old site and YouCanBookMe live for one week, then retire them. Raise the TTL back (e.g. 3600) after a stable week.

---

## G. Post-launch

- [ ] Google Business Profile: update the Book link to `https://zizusbarbers.com/book`, website link, hours; NAP must match the site exactly.
- [ ] Search Console: verify the domain (DNS TXT at GoDaddy, additive), submit `https://zizusbarbers.com/sitemap.xml`.
- [ ] Legal/ICO items: complete `docs/launch-checklist.md` (remove the DRAFT marker only after review).
- [ ] **Owner training (10 minutes).** Walk through on the owner's phone:
  1. Sign in (magic link) and add to home screen.
  2. **Today** view: read the day, tap a booking.
  3. **+10 min** button: finish late, watch later bookings shift; what happens past closing time.
  4. **Status**: open/closed, in shop, waiting count, note (shows live on the site).
  5. **Gallery**: add a photo from the camera, move up/down, delete.
  6. **Settings**: change hours, a closure day, prices.
  7. **Stopping reminders**: per booking "Stop reminders"; customer data requests per `docs/privacy-ops.md`.
  8. What customers receive (confirmation, reminders, change/cancel notices) and who to call if it breaks.
- [ ] Monitoring (weekly at first):
  - Supabase Dashboard -> Logs (Edge Functions -> `notify`, Auth, Postgres).
  - Cron: `select status, return_message, start_time from cron.job_run_details order by start_time desc limit 10;`
  - Failed/pending messages:
    ```sql
    select * from notifications where status = 'failed' order by created_at desc limit 20;
    select * from notifications where status = 'pending' and created_at < now() - interval '10 minutes';
    ```
  - Vercel -> Logs/Analytics; Resend and Twilio dashboards for bounces/spend alerts (the Twilio usage alert and UK-only geo permissions are set in B).
- [ ] Backups: Supabase Pro keeps daily backups (7 days, **verify**). Restore is a dashboard operation (Database -> Backups); a restore reverts all data since, including bookings and any erasures (re-run erasures after a restore; see `docs/privacy-ops.md`). Consider a monthly `npx supabase db dump --data-only` stored by the owner (**verify** it works against the linked project).
- [ ] **Rollback plan**: if the site fails after cutover, in GoDaddy restore the old apex `A` and `www` records from the F1 export (TTL 300 makes this effective in minutes), leave everything else alone. Bookings made on the new site in the meantime stay in Supabase; export them before retrying. Because the old site was kept live, customers can still book there.
- [ ] **Handover**:
  - All accounts (A) are in the owner's name with the owner as primary admin and 2FA; developer access reviewed/removed per the contract.
  - Owner holds the password-manager entries (Supabase DB password, CRON_SECRET, provider keys).
  - Code ownership / licence / support terms are covered in the contract (confirm it is signed; not specified in this repo).
  - Give the owner this runbook and `docs/*.md`.

---

## H. Known limitations

- The hero image cannot be changed by the owner (code change needed).
- Gallery reorder is by up/down buttons, not drag and drop.
- No editing of a booking's name, phone or time (cancel and rebook; extending the end time is supported).
- Confirmations are sent on the next 5-minute cron run, not instantly.
- Single barber: bookings go to the first active barber.
- `/privacy` and `/cookies` are DRAFT until legally reviewed (`docs/launch-checklist.md`).
- PWA icons are placeholders; OG image is generated, not a photo.
- Erasure does not reach Twilio/Resend logs (`docs/privacy-ops.md`).
- www/non-www canonicalisation is done in Vercel Domains, not in the app.
- Edge Function bundling of `../../../src/lib/notify` and prices/limits of all vendors are unverified (C4/C5, A).
