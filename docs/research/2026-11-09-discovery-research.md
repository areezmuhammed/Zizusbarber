# Discovery research (9 November 2026)

Condensed from four research agents run at the start of the project. These were mostly from model knowledge plus a few searches, so **treat prices, limits, licences and star counts as unverified.** The decisions that came out of this are in `docs/superpowers/specs/2026-11-09-zizus-barbers-design.md`.

## The existing site (audit)
- Vite/React single-page app, static marketing page, no backend or admin.
- Every "Book" button opens an external YouCanBookMe page (`zizu.youcanbook.me`). Services, prices and durations are hard-coded in the site's JS, separate from that booking page, so a duration change there never reaches the site (the owner's "20 to 40 minutes not visible" problem).
- Time-zone bug: confirmation text says times are BST and may shift; calendar invites and email clients re-interpret times after the October clock change. Fix chosen: store UTC instants, display in Europe/London.
- Listed on Treatwell and Fresha as well (extra diaries, double-booking risk). Hours conflict: site says Tue-Sun 09:30-20:00, Treatwell says Tuesday from 10:00.
- Services seen: Hair Cut £14, Hair Cut and Beard £20, Beard £8, Hot Towel Shave £8, Face Mask £7, Hair Cut and Designs £5 (looks like an add-on), Thread from £5, Facial Session £20.
- Contact: 135 Upperthorpe Rd, Sheffield S6 3EB; 07535 423544; Instagram @zizusbarbers.

## Competitors and feature ideas
Waitwhile (virtual queue and wait-time prediction), Qless (SMS "your turn"), Squire (card on file, auto no-show fee, review prompts), Booksy (weaker cancellation controls), Treatwell/Fresha (marketplaces that take commission and own the customer).
Feature ideas by priority: must-have (single source of truth for services, owner admin, DST-safe times, in-site booking, no double-booking, live status, reminders, day view, closures, SEO); owner wow (walk-in queue, auto wait estimate, deposits and no-show fees, running-late push-back, dashboard, customer notes); customer wow (live "open now" badge, one-tap rebook, add to calendar, self-serve cancel, waitlist, gallery, Google review prompt); later (loyalty, multi-barber, vouchers, WhatsApp, product sales).
**Built:** the must-haves, live status, extend-and-push-back, gallery, reminders, self-serve cancel. **Not built (by design):** walk-in queue with auto estimate, deposits, waitlist, loyalty, review prompts, multi-barber UI.

## Stack choice
Next.js (App Router) + Supabase (Postgres, Auth, Realtime, Storage, Edge Function) + Vercel, custom booking. Rejected: Cal.com (meeting model, no extend-and-shift or live status), Firebase (no range constraints), Cloudflare D1 (no exclusion constraints), SvelteKit variant (marginal gain).
Key ideas used: UTC timestamps plus London display; Postgres exclusion constraint on `tstzrange` for no-double-booking; one transactional function to extend a booking and push later ones; Realtime on a one-row `shop_status` table.
Costs quoted (unverified): Vercel Pro about £16-20/mo, Supabase Pro about $25/mo, Resend free tier, Twilio UK SMS about £0.04 per message.

## UK operations and compliance notes
- DNS: keep nameservers at GoDaddy, change only apex A and `www` CNAME, leave MX/SPF/TXT; lower TTL a day before; keep the old site a week.
- Local SEO: 301 old URLs, HairSalon JSON-LD (no fake ratings), NAP matching Google Business Profile, update the GBP Book link, Search Console.
- UK GDPR / PECR: ICO registration and fee, privacy notice, cookieless analytics to avoid a banner, transactional-only SMS, fair cancellation terms if deposits are added. Legal points came from commentary and need professional review.
- Operations: 24h and 2h reminders cut no-shows (vendor-sourced figures), waitlist auto-fill, reserve walk-in capacity, show wait as a range, text only affected customers on an overrun.
- Suggested pricing (agent's own, unsourced): about £1.5-3.5k MVP, retainer about £50-120 a month, and the owner holds the accounts.

## Design and GitHub research
- `morluto/rea`: reverse-engineering toolkit, irrelevant here. HyperFrames (HeyGen): HTML to MP4, useful later for Instagram promo videos only.
- Repos worth reading (verify licences): Cal.com (slot logic, AGPL core), a Next.js/Prisma/shadcn barber app, Openfront Salon and open-salon (schemas), 21st.dev and reui shadcn booking blocks, a queue-management repo for the join-by-QR pattern. No open-source barber walk-in queue exists.
- Palettes considered: A "Midnight Gold" (dark, brass; chosen), B "Classic Parlour" (cream, barber red, navy), C "Modern Sharp" (off-black, lime). Fonts: serif headings plus sans body plus mono for prices and live badges.
