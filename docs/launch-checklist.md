# Launch checklist

Everything that must happen before (or at) go-live. No secrets in this file: values go into the hosting/Supabase
dashboards or `npx supabase secrets set`.

## TODO: legal (DRAFT - not legal advice)

The `/privacy` and `/cookies` pages carry an HTML comment `DRAFT - not legal advice: review before launch`.
Remove it (`DRAFT` in `src/components/LegalPage.tsx`) only after:
- [ ] A competent person reviews the privacy and cookie wording against UK GDPR / DPA 2018 / PECR, including the
      lawful bases (contract for bookings, legitimate interests for reminders) and the international transfers sentence.
- [ ] ICO registration made and data protection fee paid; put the number in `shopConfig.privacy.icoRegistration`
      (`shop.config.ts`; the page omits the line while it is `null`).
- [ ] Processor list in `shopConfig.privacy.processors` matches the accounts actually used; DPAs accepted with
      Supabase, Vercel, Resend and Twilio; check where each stores data.
- [ ] The contact email `shopConfig.email` (bookings@zizusbarbers.com) exists and someone reads it (rights requests,
      one-month reply deadline).
- [ ] Privacy notice: confirm wording for the 24h anti-abuse hashed-phone record (`public_booking_log`, legitimate
      interests: preventing misuse/fraud).
- [ ] Update the "Last updated" dates on both pages when the text changes.
- [ ] Retention (2 years) agreed with the owner; see `docs/privacy-ops.md`.
- [ ] Check Twilio and Resend message-log retention and how to delete a customer's messages there (erasure does
      not reach them); note it in `docs/privacy-ops.md` if it differs.

## Email and SMS (see docs/notifications.md)

- [ ] Resend: verify the sending domain (SPF, DKIM, DMARC records at the DNS host).
- [ ] Twilio: UK alphanumeric sender ID or UK number registered; confirm per-message pricing with the owner.
- [ ] Function secrets set (`CRON_SECRET`, `SITE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `TWILIO_*`).
- [ ] `npx supabase functions deploy notify`, then call it once with the `x-cron-secret` header and expect a JSON summary.
- [ ] Vault secrets `notify_url` and `cron_secret` created.
- [ ] Twilio Geo Permissions: United Kingdom only.
- [ ] Twilio spend/usage alert set (daily and monthly), auto-recharge off or capped.
- [ ] Vercel Firewall rate-limit rule on `POST /book`; Supabase Auth rate limits reviewed. These protect the website
      and sign-in only: as far as is known Supabase has no per-IP limit on the Data API (verify in the Supabase
      dashboard) and direct anon RPC calls skip the Vercel firewall, so the caps inside `create_booking` (the
      3-upcoming-per-phone cap from 016 and the 017 hourly/24h caps) are the only protection against direct
      `create_booking` abuse. Worst case: 20 public bookings/hour, ~40 texts/hour,
      ~GBP 35-40/day, and the diary fills in about a day so real customers see "busy". The Twilio spend alert and UK-only
      geo permissions are therefore REQUIRED. Owner has the bulk-cancel SQL. Optional future: a shop-wide daily cap.
- [ ] Owner knows the database caps on public bookings (`017_booking_abuse_limits.sql`, owner bookings exempt):
      5 per phone per 24h (cancelled included) and 20 per hour shop-wide ("busy" message). Constants
      `c_phone_per_day` / `c_shop_per_hour` in `create_booking`; raise them with a new migration, or clear the
      24h log with `delete from public_booking_log;` (`docs/cutover.md`, B "Abuse limits").
- [ ] SMS goes to UK mobiles (`+447`) only; landline bookings get email if given, else no message.
- [ ] Owner knows the junk-booking bulk-cancel SQL (`docs/cutover.md`, B "Abuse limits").

## Supabase and Vercel

- [ ] NEW Supabase and Vercel projects under the owner's own accounts only (never another company's or a personal
      project; no `supabase link` to an existing project). See the warning at the top of `docs/cutover.md`.
- [ ] Supabase Pro plan (daily backups); `npx supabase db push` applies all migrations up to `018_purge_booking_log.sql`.
- [ ] Supabase Auth: Site URL = production URL; redirect allow-list includes `https://zizusbarbers.com/auth/callback`.
- [ ] Vercel: paid plan (commercial use); env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
      `NEXT_PUBLIC_SITE_URL=https://zizusbarbers.com` (also used for `metadataBase`, so og:image URLs are absolute).
- [ ] Optional analytics (off by default, cookieless, so no banner): set `PLAUSIBLE_DOMAIN=zizusbarbers.com` and,
      for a self-hosted/proxied script, `PLAUSIBLE_SRC` (must be the `script.exclusions.js` variant: the app passes
      `data-exclude` for `/booking/**`, `/admin/**`, `/auth/**`, and only public pages load the script; **verify** in Plausible that no
      `/booking/` path is ever recorded). Read at build time: redeploy after changing. The cookie notice then mentions Plausible automatically.
      Nothing is tracked while unset.

## Photos

- [ ] Replace every `placeholder-*` photo (`docs/photos.md`) and the demo gallery with the owner's real photos

## DNS cutover (GoDaddy)

- [ ] Export the current zone file first (backup).
- [ ] A day before: lower the TTL of `A @` and `CNAME www` to 300s (same as `docs/cutover.md` F2).
- [ ] Change ONLY `A @` and `CNAME www` to the Vercel values. Leave MX, SPF/TXT and every other record alone.
- [ ] www vs non-www: pick one canonical host in Vercel (Domains -> redirect the other). The app does not do it.
- [ ] After propagation: HTTPS works on both hosts, one redirects to the other, email still arrives.

## SEO

- [ ] Old URLs: 301 (permanent) redirects are in `src/lib/redirects.ts` (`/services`, `/gallery`, `/contact`, `/booking`, ...).
      Check the old site's real paths (Search Console, analytics, Google results) and add any missing ones.
- [ ] Google Search Console: verify the domain, submit `https://zizusbarbers.com/sitemap.xml`.
- [ ] Google Business Profile: update the "Book" / website link to `https://zizusbarbers.com/book`; check name,
      address and phone match the site exactly (NAP).
- [ ] Add the Facebook page to `shopConfig.sameAs` if there is one.
- [ ] Replace the placeholder PWA icons `public/icon-192.png` / `public/icon-512.png` (generated "Z") with the real logo,
      and consider a photo-based OG image (`src/app/opengraph-image.tsx`).

## With the owner

- [ ] Confirm service durations (seed values are placeholders).
- [ ] Confirm opening hours: 09:30 (old site) vs 10:00 (Treatwell).
- [ ] Confirm the "Hair Cut and Designs" price (£5 looks wrong next to Hair Cut £14).
- [ ] Owner training: diary, extend/move, status, settings, gallery, and handling data requests (`docs/privacy-ops.md`).
- [ ] Known limits: the hero image cannot be changed by the owner yet; gallery order uses buttons, not drag.
- [ ] Retire or keep Treatwell/Fresha (two diaries risk double bookings).

## Final checks

- [ ] Real devices: iOS Safari and Android Chrome (book, manage, cancel, delete my data, admin sign-in, install to home screen).
- [ ] `npm run build` clean; all tests green.
