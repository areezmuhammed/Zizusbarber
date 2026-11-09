# Zizu's Barbers: Website and Booking System, Design Spec

Date: 2026-11-09. Status: draft for owner/developer review.

## 1. Goal
Replace zizusbarbers.com (Vite SPA + external YouCanBookMe link) with our own mobile-first site and booking system that the owner fully controls. Own booking system is the single source of truth; Treatwell and Fresha are not integrated (owner may retire or leave them as listings only; see Open Questions).

## 2. Problems solved (from owner)
1. **DST bug**: times shift an hour after clocks go back. Fix: store UTC instants, render in Europe/London, shop hours as local wall-clock times.
2. **Owner control of bookings**: create, edit, cancel, and extend a booking's length (e.g. 20 to 40 min). Later bookings shift automatically; customers see the change.
3. **Live shop status**: customers see Open/Busy/Closed, people in shop, people waiting.
4. **Photo control**: owner can upload, delete and reorder gallery photos (and hero image) from his phone. Today photos are frozen in the code.
5. **Services/prices/hours editable** in one place; site and booking read the same data (today they are separate, which is why duration edits never showed).

## 3. Scope
**MVP (in):** public site, native booking flow, owner admin (day view, status, settings, gallery), email + SMS confirmations/reminders, calendar (.ics) file, self-serve cancel link, SEO basics (LocalBusiness schema, SSR, sitemap, redirects), privacy/cookie pages, domain cutover.
**Later (out of MVP):** Stripe deposits/no-show fees, waitlist, Google review prompt, remote walk-in queue with auto wait estimate, loyalty, vouchers, Wallet passes, multi-barber UI.
**Never (unless asked):** true multi-shop platform; Treatwell/Fresha sync.

## 4. Architecture
- Next.js (App Router, TypeScript) on Vercel; Tailwind + shadcn/ui; PWA manifest.
- Supabase: Postgres, Auth (owner email login), Realtime, Storage, Edge Functions + pg_cron for reminders.
- Resend (email), Twilio or UK SMS provider (SMS). Prices/limits unverified; confirm before launch.
- **One codebase, one deployment per shop** (separate Supabase + Vercel project, own domain). Shop name, address, colours, fonts, logo, theme in a config file plus DB. Second shop = clone + config + theme.
- DNS: stay on GoDaddy nameservers; change only apex A and www CNAME; leave MX/SPF/TXT; lower TTL a day before; keep old site reachable a week.

## 5. Data model
- `barbers` (id, name, active). MVP seeds one row; every booking references a barber so a second chair needs no rewrite.
- `services` (id, name, price_pence, duration_min, active, sort).
- `opening_hours` (barber/shop, weekday, open_local time, close_local time) and `closures` (date, reason, optional special hours). Local wall-clock `time`, never UTC.
- `bookings` (id, barber_id, service_id, customer_name, phone, email, start_at timestamptz, end_at timestamptz, status pending|confirmed|arrived|done|no_show|cancelled, cancel_token, created_at). Exclusion constraint on (barber_id, tstzrange(start_at,end_at)) where status in active states.
- `booking_changes` (booking_id, old_start, old_end, new_start, new_end, reason, at) drives the customer-facing "moved by the shop" banner and notifications.
- `shop_status` (single row: state open|busy|closed, in_shop, waiting, note).
- `gallery` (id, storage_path, alt, sort, created_at) + Storage bucket `gallery`.
- RLS: public read of services, hours, closures, gallery, shop_status, and availability via function; all writes owner-only. Customer booking via RPC; customer sees only own booking by cancel_token.

## 6. Key behaviours
- **Slots**: computed in Europe/London from opening hours minus closures minus existing bookings, using service duration. Luxon (or date-fns v4 + @date-fns/tz). Never add 24h for "tomorrow".
- **create_booking()** RPC: atomic insert; on exclusion violation (23P01) return "slot just taken".
- **extend_booking()** RPC: one transaction, locks the day's rows, lengthens the booking, pushes only the later bookings that now overlap, logs `booking_changes`. If a shifted booking would pass closing time, return a conflict list for the owner to resolve instead of moving silently. Affected customers get SMS/email with a reschedule/cancel link; never moved without notice.
- **Live status**: customers subscribe to `shop_status` via Realtime; 30s poll fallback. Owner sets counts with +/- buttons. Estimated wait is manual in MVP, automatic in the queue phase.
- **Reminders**: 24h and 2h before, via pg_cron to Edge Function; SMS only for the day-before to limit cost; email otherwise. Transactional only; marketing texts need explicit consent.
- **Gallery**: owner uploads from phone camera/roll; browser resizes/compresses before upload; delete and drag-reorder; public read, owner-only write. Same uploader serves hero image.
- **Admin (mobile first)**: today list with tap actions (arrived, done, no-show, +10 min, cancel), booking edit sheet, status controls, settings (services, hours, closures), gallery.

## 7. Customer UX (mobile first)
Hero + sticky bottom bar (Book, Call/WhatsApp); live status badge; bottom-sheet booking: service, date chips, time grid, details, confirm, with price and duration shown throughout; 44px+ targets; booking page with cancel link and change banner; `prefers-reduced-motion` honoured. Visual direction: dark "Midnight Gold" (bg #0B0B0C, brass #C8A15A, serif headings, sans body) with monospace prices and live badges. Built using the frontend-design skill; final palette confirmed with owner.

## 8. Compliance and SEO
ICO registration/fee and privacy notice; data retention policy (delete or anonymise after a set period) and delete-my-data route; processors listed; cookieless analytics (Plausible/Umami) to avoid a banner, strictly-necessary cookies only. Legal specifics are unverified and need checking before launch. SEO: server-rendered pages, `HairSalon` JSON-LD (no fake ratings), sitemap, Search Console, 301s from old URLs, correct Maps link, NAP matching Google Business Profile, update GBP Book link.

## 9. Testing
- Unit tests for slot generation and DST: 29 Mar 2026 and 25 Oct 2026 clock-change days, booking made in BST viewed in GMT.
- SQL tests for overlap rejection and `extend_booking()` shifting, closing-time conflicts, concurrent bookings.
- RLS tests: anonymous cannot write or read other customers' bookings; only owner can write gallery.
- Mobile manual pass on real phones (iOS Safari, Android Chrome).

## 10. Open questions
- Walk-ins: assumed appointments plus owner-set "in shop / waiting" counters for MVP. Confirm with owner.
- Opening hours: site says Tue-Sun 09:30-20:00, Treatwell says 10:00 start. Confirm.
- Current service durations (not visible on the site; likely only in YouCanBookMe). Get from owner.
- Retire or keep Treatwell/Fresha listings (risk: separate diaries cause double bookings).
- Deposits/no-show fees: deferred; policy to agree.
- Pricing to owner, code/data ownership terms.
