# Warm, photo-led redesign: design spec

Date: 15 November 2026. Status: approved in conversation section by section; this written spec awaits the developer's review.
Inspiration: https://originalbarbershop.nyc (inspiration only: none of its text, photos, logo, video or brand is copied). Analysis: `docs/research/2026-11-15-reference-original-barbershop.md` plus the mobile audit summarised in section 9.

## 1. Goal and success

The demo must make the owner say yes. Today's site reads as cold, "depressing" black with almost no photography. The redesign makes the public site warm, photo-led and premium, restyles the owner admin to match, and stays simple for a non-technical owner.

Success means:
- the home page feels warm and premium at 375px within the first screen;
- prices are reachable on screen 2;
- booking is one tap from anywhere (sticky bar);
- no functional regression and no material performance regression.

Presentation only. No booking logic, schema, auth, RLS or notification changes. Prices, hours, closures, live status and the gallery still come from the database.

## 2. Visual system: "Heritage"

### 2.1 Palette
These replace `shopConfig.theme` in `shop.config.ts`. `band` is the only new key; `src/app/layout.tsx` maps it to a `--band` variable (plus a Tailwind `--color-band` in `globals.css`).

| Key | Hex | Use | Contrast on bg / on raised surface |
|---|---|---|---|
| bg | `#120F0B` | page | n/a |
| band | `#17130E` | alternate section band, footer | n/a |
| surface | `#1F1913` | cards, sheets, admin cards | n/a |
| text | `#F3EAD8` | body and headings | 15.99 / 12.98 |
| muted | `#B3A487` | secondary text | 7.81 / 6.34 |
| accent | `#C9A44C` | gold buttons, labels, prices, active tab | 8.10 / 6.57 |
| destructive | `#E5605A` | errors, destructive actions | 5.60 / 4.54 |

- Gold buttons use `bg` text, at 8.10:1.
- "Raised" is the existing `color-mix(text 8%, surface)`.
- Ratios were computed with the WCAG formula. Any new pairing must be checked at 4.5:1 or better (3:1 only for large display text).

### 2.2 Type
All fonts load through `next/font/google`, replacing Cormorant Garamond 500/600 and DM Sans in `layout.tsx`. JetBrains Mono stays only where it is used today.

| Role | Face | Rules |
|---|---|---|
| Display (`--font-heading`) | Marcellus 400 | uppercase, letter-spacing about 0.06–0.12em; h1, h2, wordmark, admin page titles |
| Voice (`--font-voice`) | Cormorant Garamond italic 500 | at most one line per section: tagline, prices, short pull lines |
| Body (`--font-sans`) | Manrope (variable) | everything informational: body, buttons, forms, all admin UI |

Labels are tiny tracked gold caps in Manrope (11–12px, tracking about 0.3em), placed above major sections only.

### 2.3 Shape, texture and motion
- `--radius` drops from 0.625rem to 0.125rem. Photos are square-cornered. Pill buttons (`rounded-full`) become `rounded-sm`.
- Use hairline borders and rules in gold at 15–30% alpha instead of shadows. Use tonal bands (`bg` / `band`) between sections.
- Motion is CSS only:
  - hero entrance: fade plus 8px rise, 500ms;
  - marquee: linear loop, about 40s;
  - optional once-only section reveal.
- `prefers-reduced-motion: reduce` shows final states and stops the marquee.
- No GSAP, Motion, Lenis or video.
- Tap targets: every button and link row is at least 48px tall.

## 3. Home page (`src/app/(public)/page.tsx`)

Mobile order is listed below, aiming for about 7–8 screens at 375px. Existing heading accessible names stay ("Prices", "Recent work", "Opening hours"), as do the "Quick actions" nav and its `Book` → `/book` link.

1. **Hero** (`Hero.tsx`, new `src/components/marketing/HeroVisual.tsx`):
   - Full-bleed, about 85svh, so the next section peeks in.
   - Art-directed photo: a 4:5 mobile crop and a 16:9 desktop crop, using the Next.js `getImageProps` + `<picture>` pattern (verify against `node_modules/next/dist/docs` first). Preload the LCP image and give it explicit dimensions, so CLS is 0.
   - Overlays: a bottom-up gradient from `bg` plus a radial vignette.
   - Top row: the wordmark, then the StatusBadge (still server- and realtime-fed).
   - Bottom block:
     - the gold label `UPPERTHORPE · SHEFFIELD`;
     - the h1 "Zizu's Barbers", rendered as `ZIZU'S` with `BARBERS` in gold on the next line (the accessible name stays "Zizu's Barbers");
     - `shopConfig.tagline` in voice italic (unchanged);
     - a 48px gold "Book an appointment" link to `/book`;
     - the address link to `shopConfig.mapsUrl`.
2. **Marquee** (new `marketing/Marquee.tsx`, server component, CSS animation):
   - Service names from `getServices()` joined with " · ", between gold rules.
   - `aria-hidden` (decorative; the price list follows).
   - Static under reduced motion.
3. **Menu** (`Services.tsx`): the label "THE MENU", h2 "Prices", one 3:2 photo, then the list. Each row has the name, the duration in muted text below it, and the price in gold voice italic on the right, with gold hairlines between rows.
4. **The shop** (new `marketing/ShopIntro.tsx`):
   - A 4:5 interior photo, the label "THE SHOP", an h2, and `shopConfig.intro` copy.
   - Draft copy (owner approval needed): "A Euro-Afro barbershop on Upperthorpe Road. Fades, tapers, beards and designs. Walk in, or book your chair online."
   - Only facts the owner can confirm; no dates, awards or claims.
5. **Barber card** (new `marketing/BarberCard.tsx`): renders only when `shopConfig.barber` is `{ name, photo, alt }`. It is `null` by default, so it is hidden in the demo until a real name and photo are supplied. It shows a 4:5 portrait with the name over a gradient.
6. **Recent work** (`Gallery.tsx`):
   - DB gallery in the owner's order: a 2-column 4:5 grid on mobile, 3 columns from `sm`, square corners, gold hairline frame.
   - The empty state is restyled.
   - The image delivery change (transforms vs full-size URLs) remains a separate later task; plain `<img>` with lazy loading stays.
7. **Visit us** (`Hours.tsx`):
   - The label "VISIT", h2 "Opening hours", and the DB hours plus closures as today.
   - The live status, and the address with 48px "Directions" (maps URL) and "Call" buttons.
   - A 3:2 street or door photo with no signage.
8. **Footer** (`SiteFooter.tsx`): on the `band` background, with the wordmark, address, phone, Instagram and legal links.
9. **Sticky bar** (`StickyBar.tsx`): same three actions and labels. Gold Book, hairline-outlined Call and WhatsApp, 2px corners, warm translucent background.

At 768px and above:
- The hero text sits bottom-left.
- The menu and the shop become photo/text side by side.
- The gallery has 3 columns.
- Content is capped at about 1100px.

The other public pages (`/book`, `/booking/[token]`, privacy, cookies, error screens) inherit the tokens, fonts and button shapes only; no layout or logic changes.

## 4. Photos

Static brand placeholders live in `public/images/brand/placeholder-*.{webp,jpg}`. They are generated with `/codex $imagegen`: warm tungsten light, wood, brick, brass, Euro-Afro hair. No logos, no signage, no text.

| File stem | Ratio | Subject |
|---|---|---|
| `placeholder-hero-mobile` | 4:5 | barber mid-fade on a client, chair and mirror |
| `placeholder-hero-desktop` | 16:9 | wider shot of the same scene |
| `placeholder-menu` | 3:2 | clippers, combs, razor on wood |
| `placeholder-shop` | 4:5 | empty interior: chairs, mirrors, lamps |
| `placeholder-visit` | 3:2 | street or shop door at dusk, no signage |

Generation and approval rules:
- Generate large and commit compressed, aiming for about 100–160 KB for the typical mobile hero response.
- The developer approves the set before it is used.
- Six new tone-matched gallery photos go into the **local** stack only. Uploading them to the live demo project (`acppxnvjxihdxfabzyam`) is a remote write and needs a separate yes.
- No generated barber portrait, ever.

Labelling:
- `docs/photos.md` lists every placeholder: file, slot, "AI-generated, replace with the owner's real photo before launch".
- `docs/launch-checklist.md` gains a "swap all placeholder photos" gate.
- The private demo shows no on-site label, as today.

## 5. Admin
- Base: merge `feat/admin-refresh` (bottom tab bar, booking cards, big Status counters, 320px fix) into the integration branch first, then rerun the gates.
- The palette arrives through the tokens; no hard-coded colours were found in `src/components` or `src/app`.
- Re-skin:
  - Manrope for all admin UI; Marcellus for the wordmark and the page titles Today, Status, Settings and Gallery.
  - Gold hairline cards on `surface`, 2px corners.
  - Tab bar: gold active tab with a hairline top border.
  - Booking status chips on warm tinted backgrounds, each checked at 4.5:1 or better.
  - Login page: wordmark plus one brand photo strip.
- Unchanged: layouts, flows, every server action and its `requireOwner()` check, every accessible name the e2e tests use, 48px tap targets.

## 6. Delivery

Branching:
- Integration branch `feat/redesign`, created from `build/zizus-barbers` with `feat/admin-refresh` merged.
- Each PR is built in its own git worktree branch off `feat/redesign` and merged back after review.
- `build/zizus-barbers` (auto-deploys the demo) is touched only by one final merge, with the developer's explicit yes.
- Any `git push` also needs a yes.

| # | PR | Main files |
|---|---|---|
| 1 | Tokens, fonts, shapes, sticky bar | `shop.config.ts`, `layout.tsx`, `globals.css`, `StickyBar.tsx`, `components/ui/button.tsx` |
| 2 | Placeholder photos plus docs (parallel with 1) | `public/images/brand/`, `docs/photos.md`, `docs/launch-checklist.md` |
| 3 | Photographic hero | `Hero.tsx`, `marketing/HeroVisual.tsx`, `StatusBadge.tsx` (style only), `e2e/home.spec.ts` |
| 4 | Marquee plus menu | `marketing/Marquee.tsx`, `Services.tsx`, page order |
| 5 | Shop intro, barber card, Visit us, footer | `marketing/ShopIntro.tsx`, `marketing/BarberCard.tsx`, `Hours.tsx`, `SiteFooter.tsx`, `shop.config.ts` (`intro`, `barber`) |
| 6 | Gallery restyle | `Gallery.tsx` |
| 7 | Admin re-skin plus login | `src/components/admin/*`, `src/app/admin/**` (presentation only) |

## 7. Testing and quality gates
- **Unit tests, written test-first:**
  - the barber card renders nothing when `shopConfig.barber` is null and renders name and alt when set;
  - the marquee text comes from service names.
- **Playwright:**
  - no horizontal overflow on `/` and `/book` at 320, 375, 390, 430, 768 and 1280;
  - the hero image is visible and the h1 accessible name is "Zizu's Barbers";
  - the marquee animation is `none` under `reducedMotion: 'reduce'`;
  - existing accessible names and the Book link are unchanged;
  - the admin pages keep the admin-refresh overflow checks.
- **Lighthouse mobile:** a baseline on the current build before PR 1 and a comparison after PR 7. Both run on a local `next start` with the same flags through `npx lighthouse` (no project dependency). Targets: 90+, LCP under 2.5s, CLS under 0.1. Any regression is explained in writing.
- **Screenshots** at 375 and 1280 for every PR.
- **Before every merge**, show the real output of:
  - `npx tsc --noEmit`
  - `npm test`
  - `npx supabase db reset && npx supabase test db`
  - `npx playwright test --workers=1`
  - `npm run build`

  Then run a code review. A security review runs before the final merge.

## 8. Out of scope
- Per-service Book buttons (`/book` cannot preselect a service without a booking-flow change).
- An admin-managed hero image (needs a schema change).
- Video, reviews, FAQ and barber bios (no real content yet).
- Gallery image transforms.
- New animation libraries.
- Copying anything from the reference site.

## 9. Reference mobile audit (375 and 390, 15 November 2026), the parts that shaped this spec
- Their palette: bg `#0C0B09`, bands `#100E0B`, footer `#090807`, text `#F3EAD8`, muted `#B7A98C`, gold `#BC9F1F`, borders gold at about 22%.
- Their type: Cinzel, Cormorant Garamond italic, Outfit; caps only for labels, buttons and nav.
- Their mobile weaknesses, which this design avoids:
  - 19 screens long, with services first appearing on screen 5.3;
  - no Book button after the hero and no sticky bar;
  - tap targets of 36–40px;
  - a 1.5 MB landscape video centre-cropped into a faceless dark portrait.
- What carries their warmth: warm photography, a warm-tinted near-black, cream text, one muted brass accent, hairlines instead of shadows, and generous spacing.
