# Warm Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Use frontend-design:frontend-design for every visual task.

**Goal:** Re-skin the Zizu's public site, and restyle the owner admin to match, into the approved warm, photo-led "Heritage" look, with no behaviour change.

**Architecture:** The theme already flows from `shopConfig.theme` through `src/app/layout.tsx` into the shadcn CSS variables, and the radius scale derives from `--radius`. So Task 1 re-skins everything at once, and later tasks restyle one home-page section each. The new presentational components live in `src/components/marketing/`. All data still comes from `src/lib/shop-data.ts`.

**Tech Stack:** Next.js 16.4.5 (App Router, `cacheComponents`), React 19.3, Tailwind v4, `next/font/google`, `next/image` (`getImageProps`), Vitest 5 (node env, `renderToStaticMarkup`), Playwright (375×812 default viewport, `--workers=1`).

**Spec:** `docs/superpowers/specs/2026-11-15-warm-redesign-design.md`

## Global Constraints

- **Presentation only.** No changes to booking logic, `supabase/`, auth, RLS, notifications or server actions. Every `requireOwner()` stays.
- **Accessible names stay as they are:**
  - headings "Prices", "Recent work", "Opening hours";
  - nav "Quick actions" with its links "Book" (`/book`), "Call" and "WhatsApp";
  - nav "Admin" with the tabs Today, Status, Settings and Gallery, and the "Sign out" button;
  - the `#services`, `#gallery` and `#hours` ids.
- **Palette** (`shopConfig.theme`):
  - bg `#120F0B`
  - band `#17130E`
  - surface `#1F1913`
  - text `#F3EAD8`
  - muted `#B3A487`
  - accent `#C9A44C`
  - destructive `#E5605A`
- **Contrast:** every text/background pair is at least 4.5:1, except display text at 24px or larger, which needs at least 3:1.
- **Fonts, all via `next/font/google`:**
  - display: Marcellus 400, uppercase, tracking 0.06–0.12em;
  - voice: Cormorant Garamond italic 500, at most one line per section;
  - body: Manrope.
  - No other faces, except that JetBrains Mono stays where it is already used.
- **Radius and shadows:** `--radius: 0.125rem`. No shadows. Borders are gold at 15–30% alpha (`border-primary/20` style).
- **Buttons and links:** every button and link row is at least 48px tall (`min-h-12`). `rounded-full` remains only on decorative dots.
- **Motion:** CSS only. Every animation is wrapped in `motion-safe:` or turned off under `motion-reduce:`. No new npm dependencies.
- **Images:**
  - use `next/image` / `getImageProps` with explicit width and height;
  - Next 16 has deprecated `priority`, so use `fetchPriority="high"` for the LCP image;
  - use the default quality (75), because no other quality is configured.
- **Content:** no invented testimonials, ratings, names, bios, dates or awards. Placeholder photos are named `placeholder-*`.
- **Remote changes:** never call any `mcp__*supabase*` tool, never print `.env` values, and never push or merge into `build/zizus-barbers` without the developer's yes.

## Review Focus

1. **Short phone screens (375×667, iPhone SE):** the hero's "Book an appointment" button must sit fully above the sticky bar on first load. Test in Task 3.
2. **Uppercase display headings:** `text-transform` must not break the existing exact-text and role-name selectors. Every task reruns the full Playwright suite, and Task 3 asserts the h1 name.
3. **No `shop_status` row** (`StatusBadge` returns null): the hero top row must keep its height and the wordmark must stay visible. Test in Task 3 via the fallback-size rule.
4. **Empty gallery:** the styled empty state renders and nothing overflows. Covered by the existing `e2e/gallery.spec.ts` plus the overflow sweep in Task 1, which runs on an empty local gallery after `db reset`.
5. **Long service names at 320px:** price rows must wrap the name, never squeeze or wrap the price. Layout rule in Task 4 (`min-w-0` on the name, `shrink-0` on the price), checked by the Task 1 overflow sweep.

---

### Task 0: Integration branch and baseline (orchestrator, no subagent)

- [ ] `git switch build/zizus-barbers && git switch -c feat/redesign && git merge --no-ff feat/admin-refresh`. Expect no conflicts, since admin-refresh only touched admin files and `.claude/launch.json`.
- [ ] Run all gates (see Task 8) and record the counts. Expected: Vitest 237, pgTAP 265, Playwright 56, build OK.
- [ ] Lighthouse baseline:
  1. `npm run build`
  2. `npx next start -p 3200` (in the background)
  3. `npx lighthouse http://localhost:3200/ --only-categories=performance --form-factor=mobile --output=json --output-path=<scratchpad>/lh-before.json --chrome-flags="--headless=new"`, run 3 times
  4. Write the median Performance, LCP, CLS and TBT to `docs/perf/2026-11-15-lighthouse.md`.
- [ ] Take 375 and 1280 screenshots of `/`, `/book` and `/admin`, store them in the scratchpad, and show them to the developer.
- [ ] Commit `docs/perf/2026-11-15-lighthouse.md` with the message "docs: Lighthouse baseline before redesign".

### Task 1: Tokens, fonts, shapes, sticky bar, overflow sweep

**Files:**
- Modify: `shop.config.ts` (`theme`)
- Modify: `src/app/layout.tsx` (fonts, `--band`)
- Modify: `src/app/globals.css`
- Modify: `src/components/StickyBar.tsx`
- Modify: `src/components/ui/button.tsx`, plus every `rounded-full` on a button or link in `src/components/*.tsx` and `src/app/**/page.tsx`
- Test (create): `src/lib/theme.test.ts`
- Test (modify): `e2e/home.spec.ts`

**Interfaces:**
- Produces:
  - `shopConfig.theme.band: string`;
  - CSS variables `--band` and `--font-voice`;
  - Tailwind utilities `bg-band` and `font-voice`;
  - `font-heading` now means Marcellus.

- [ ] **Step 1: Write the failing contrast test** in `src/lib/theme.test.ts`.
  - Write a local `ratio(a: string, b: string): number` using WCAG relative luminance.
  - Test `"theme text colours meet 4.5:1 on every surface"`: for each of `text`, `muted`, `accent` and `destructive`, against each of `bg`, `band` and `surface`, expect `ratio(...) >= 4.5`. Also expect `ratio(theme.bg, theme.accent) >= 4.5` (the gold button label).
  - Test `"theme is the approved Heritage palette"`: `expect(shopConfig.theme).toEqual({ bg: "#120F0B", band: "#17130E", surface: "#1F1913", text: "#F3EAD8", muted: "#B3A487", accent: "#C9A44C", destructive: "#E5605A" })`.
- [ ] **Step 2:** run `npx vitest run src/lib/theme.test.ts`. Expected: FAIL (there is no `band` key and the old values are still in place).
- [ ] **Step 3: Update the theme.** Set `shopConfig.theme` to the values above and keep the `muted` comment.
- [ ] **Step 4: Update the root layout** (`layout.tsx`).
  - Fonts:
    - `Marcellus({ variable: "--font-serif", subsets: ["latin"], weight: "400" })`;
    - `Cormorant_Garamond({ variable: "--font-voice-face", subsets: ["latin"], weight: "500", style: "italic" })`;
    - `Manrope({ variable: "--font-sans", subsets: ["latin"] })`.
  - Keep JetBrains Mono.
  - Add `"--band": t.band` to `themeVars` and add the voice variable class to `<html>`.
- [ ] **Step 5: Update `globals.css`.**
  - In `@theme inline`, add `--color-band: var(--band);` and `--font-voice: var(--font-voice-face);`.
  - Set `:root { --radius: 0.125rem; }`.
  - In `@layer base`, add `html { font-synthesis-weight: none; }`, because Marcellus has only weight 400 and fake bold must never render. Also add `:where(.font-heading) { text-transform: uppercase; letter-spacing: 0.08em; font-weight: 400; }`.
- [ ] **Step 6: Change the shapes.**
  - `button.tsx`: change `rounded-lg` to `rounded-sm` in the base class.
  - Replace `rounded-full` with `rounded-sm` on every button or link in `src/components/*.tsx` and `src/app/**`, except decorative dots (`size-2` and similar) and the admin tab indicator.
  - `StickyBar.tsx`: Book stays `bg-primary text-primary-foreground`; Call and WhatsApp use `border border-primary/30`; the container uses `bg-background/90 border-t border-primary/20`. Labels and hrefs stay as they are.
- [ ] **Step 7: Extend the overflow e2e.** In `e2e/home.spec.ts`, replace the `"no horizontal scroll"` test with `"no horizontal scroll at 320–1280 on / and /book"`. Loop over widths `[320, 375, 390, 430, 768, 1280]` and paths `["/", "/book"]`: call `page.setViewportSize({ width, height: 812 })`, then `goto(path)`, then `expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)`.
- [ ] **Step 8: Run** `npx vitest run src/lib/theme.test.ts` (PASS), then `npx tsc --noEmit`, then `npx playwright test --workers=1` (all PASS).
- [ ] **Step 9:** take 375 and 1280 screenshots of `/`, `/book` and `/admin/login` for review.
- [ ] **Step 10: Commit** with the message "feat(theme): warm Heritage palette, Marcellus/Cormorant/Manrope, square shapes".

### Task 2: Placeholder photos (orchestrator runs `/codex $imagegen`, developer approves; parallel with Task 1)

**Files:**
- Create: `public/images/brand/` containing:
  - `placeholder-hero-mobile.webp` (1080×1350)
  - `placeholder-hero-desktop.webp` (2400×1350)
  - `placeholder-menu.webp` (1800×1200)
  - `placeholder-shop.webp` (1200×1500)
  - `placeholder-visit.webp` (1800×1200)
- Create: `docs/photos/gallery/placeholder-gallery-1..6.webp` (1200×1500)
- Create: `docs/photos.md`
- Modify: `docs/launch-checklist.md`

**Interfaces:**
- Produces: the exact paths and pixel sizes above, which Tasks 3–5 and 7 hard-code as `width`/`height`.

- [ ] Brief the image generator.
  - Shared style: warm tungsten light, dark wood, exposed brick, brass, shallow depth of field, Euro-Afro hair styling, editorial photo realism.
  - Exclude: no text, logos, signage or watermarks; no recognisable real person.
  - Subjects:
    - hero (both crops): a barber mid-fade on a client in a chair, mirror behind; for the mobile 4:5 crop, the subject is centred in the upper two-thirds;
    - menu: clippers, combs and a straight razor on wood;
    - shop: an empty interior with two chairs, mirrors and lamps;
    - visit: a street or shop door at dusk with no signage;
    - gallery 1–6: fresh fades, tapers, beard line-ups and a hair design, each a close-up of the finished cut.
- [ ] Show the set to the developer and wait for approval. Regenerate any image they reject.
- [ ] Compress with a scratchpad script using the `sharp` already in `node_modules` (not committed): cover-crop to the sizes above, WebP quality 72. Aim for each brand file under 350 KB and the mobile hero under 200 KB.
- [ ] `docs/photos.md`: a table with file, slot, size and "AI-generated placeholder, replace with the owner's real photo before launch". Note that the gallery set is uploaded through `/admin/gallery`: locally freely, but to the demo project only with the developer's yes.
- [ ] `docs/launch-checklist.md`: add `- [ ] Replace every placeholder-* photo (docs/photos.md) and the demo gallery with the owner's real photos`.
- [ ] Commit with the message "assets: warm placeholder photo set and photo register".

### Task 3: Photographic hero

**Files:**
- Create: `src/components/marketing/HeroVisual.tsx`
- Modify: `src/components/Hero.tsx`, `src/components/StatusBadge.tsx` (fallback class only)
- Test: `e2e/home.spec.ts`

**Interfaces:**
- Consumes: Task 1 tokens and `font-heading`/`font-voice`; Task 2 hero files and sizes.
- Produces: `export function HeroVisual(): JSX.Element`, a `<picture>` that fills its positioned parent (`absolute inset-0`, `object-cover`).

- [ ] **Step 1: Write the failing e2e tests** in `e2e/home.spec.ts`:
  - `"hero shows the brand, the art-directed photo and a reachable Book button"`. At the default 375×812:
    - `getByRole("heading", { level: 1 })` has accessible name matching `/zizu's barbers/i`;
    - `page.locator("header picture img")` is visible, and `img.currentSrc` contains `placeholder-hero-mobile`;
    - `getByRole("link", { name: "Book an appointment" })` has href `/book`.

    Then set the viewport to 1280×800, reload, and assert `currentSrc` contains `placeholder-hero-desktop`.
  - `"hero Book button sits above the sticky bar on a 375x667 screen"`: set the viewport to 375×667 and go to `/`. The bottom of the Book link's bounding box must be at most the sticky nav's (`navigation "Quick actions"`) bounding box `y`.
  - `"hero has no layout shift"`: after `goto("/")`, evaluate the sum of `layout-shift` PerformanceObserver entries with `buffered: true` after waiting for `load`. Expect it to be below 0.1.
- [ ] **Step 2:** run `npx playwright test e2e/home.spec.ts --workers=1`. Expected: the new tests FAIL (there is no picture or img).
- [ ] **Step 3: Implement `HeroVisual()`** following the art-direction example in `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md` ("Art direction"):
  - call `getImageProps` with `alt: ""` (decorative; the h1 carries the meaning), `sizes: "100vw"`, the desktop file at 2400×1350 and the mobile file at 1080×1350;
  - add `<source media="(min-width: 768px)">` for the desktop file;
  - on the `<img>`: `fetchPriority="high"` (no `preload` or `loading="eager"`, as the doc says), `className="absolute inset-0 size-full object-cover object-[50%_30%]"`;
  - overlay `div`s, `aria-hidden`: `bg-gradient-to-t from-background via-background/55 to-background/20`, plus a radial vignette `bg-[radial-gradient(ellipse_at_center,transparent_40%,var(--background)_100%)] opacity-70`.
- [ ] **Step 4: Rebuild `Hero()`.**
  - Layout: `<header className="relative isolate flex min-h-[85svh] flex-col bg-band">` containing `<HeroVisual/>`.
  - Top row (`relative z-10 flex items-center justify-between px-5 pt-4 min-h-[54px]`):
    - wordmark `<span className="font-heading text-lg">` showing `Zizu's`;
    - the existing `<Suspense fallback={<StatusBadgeFallback/>}><StatusBadge/></Suspense>`.
  - Bottom block (`relative z-10 mt-auto px-5 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-16 max-w-[1100px] mx-auto w-full`, wrapped in the existing `motion-safe:animate-in fade-in slide-in-from-bottom-2 duration-500`):
    - label `<p className="text-[11px] tracking-[0.3em] uppercase text-primary">{shopConfig.area}</p>`;
    - `<h1 className="font-heading text-[clamp(2.75rem,13vw,5.5rem)] leading-[0.95]"><span className="block">Zizu&apos;s</span><span className="block text-primary">Barbers</span></h1>`;
    - tagline `<p className="font-voice text-2xl">`;
    - the existing Book link restyled `min-h-12 rounded-sm bg-primary px-7 uppercase tracking-[0.14em] text-sm`, keeping its text "Book an appointment";
    - the address link as today.
  - Keep `Hero` a server component.
  - `StatusBadgeFallback`: change `rounded-full` to `rounded-sm` and keep `h-[38px]`.
- [ ] **Step 5:** run `npx playwright test e2e/home.spec.ts --workers=1`. Expected: all PASS. Then `npx tsc --noEmit`.
- [ ] **Step 6:** take screenshots at 375×812, 375×667 and 1280×800.
- [ ] **Step 7: Commit** with the message "feat(home): art-directed photographic hero".

### Task 4: Marquee and menu

**Files:**
- Modify: `src/lib/format.ts` (+ `marqueeText`); test in `src/lib/format.test.ts` (create it if absent, otherwise extend)
- Create: `src/components/marketing/Marquee.tsx`
- Modify: `src/components/Services.tsx`, `src/app/(public)/page.tsx`
- Test: `e2e/home.spec.ts`

**Interfaces:**
- Produces:
  - `export function marqueeText(names: string[]): string`;
  - `export async function Marquee(): Promise<JSX.Element | null>`.

- [ ] **Step 1: Write the failing unit test:**
  - `marqueeText(["Skin fade", "Beard trim"])` → `"Skin fade · Beard trim"`;
  - `marqueeText([])` → `""`;
  - `marqueeText([" Taper "])` → `"Taper"` (trimmed).
- [ ] **Step 2:** run `npx vitest run src/lib/format.test.ts`. Expected: FAIL (not exported).
- [ ] **Step 3:** implement `marqueeText` (trim, filter empty, join with `" · "`).
- [ ] **Step 4:** run it. Expected: PASS.
- [ ] **Step 5: Write the failing e2e test** `"marquee is decorative and still under reduced motion"`:
  - `page.emulateMedia({ reducedMotion: "reduce" })`, then `goto("/")`;
  - `page.locator("[data-marquee]")` has `aria-hidden="true"`;
  - the computed `animation-name` of `[data-marquee-track]` is `"none"`.
- [ ] **Step 6: Implement `Marquee`.**
  - Await `getServices()` and compute `marqueeText`. Return null when it is empty.
  - Render `<div data-marquee aria-hidden="true" className="overflow-hidden border-y border-primary/25 bg-band py-3">` with a track `data-marquee-track` containing the text twice (`font-heading text-sm tracking-[0.2em] text-primary/90 whitespace-nowrap pr-8`).
  - Animate with a `@keyframes marquee { to { transform: translateX(-50%) } }` defined in `globals.css` and applied as `motion-safe:animate-[marquee_40s_linear_infinite]`, so it is `none` under reduced motion.
- [ ] **Step 7: Restyle `Services`.**
  - Section `bg-background py-16`, content `max-w-[1100px]`. At `md`, a 2-column grid: photo left, list right.
  - Label `THE MENU` in the Task 3 label style, above the h2 "Prices" (`font-heading text-3xl`).
  - `next/image` of `/images/brand/placeholder-menu.webp` at 1800×1200 with `alt=""`, `sizes="(min-width: 768px) 50vw, 100vw"` and `className="aspect-[3/2] object-cover"`.
  - Rows: `border-b border-primary/20 py-4`. Name `min-w-0 text-[1.0625rem]`, duration below in `text-xs text-muted-foreground`, price `shrink-0 font-voice text-2xl text-primary`. Remove the dotted leader.
  - Price text stays exactly `formatPrice(...)`, because the e2e test matches `"£14"`.
- [ ] **Step 8:** in `page.tsx`, put `<Marquee />` between `<Hero />` and `<Services />`.
- [ ] **Step 9:** run `npx playwright test e2e/home.spec.ts --workers=1`, `npx vitest run` and `npx tsc --noEmit`. Expected: all PASS.
- [ ] **Step 10: Commit** with the message "feat(home): service-name marquee and editorial price menu".

### Task 5: Shop intro, barber card, Visit us, footer

**Files:**
- Modify: `shop.config.ts` (`intro`, `barber`)
- Create: `src/components/marketing/ShopIntro.tsx`, `src/components/marketing/BarberCard.tsx`, `src/components/marketing/BarberCard.test.tsx`
- Modify: `src/components/Hours.tsx`, `src/components/SiteFooter.tsx`, `src/app/(public)/page.tsx`
- Test: `e2e/home.spec.ts`

**Interfaces:**
- Produces:
  - `shopConfig.intro: string`;
  - `shopConfig.barber: Barber | null`;
  - `export type Barber = { name: string; photo: string; width: number; height: number; alt: string }` (exported from `shop.config.ts`);
  - `export function BarberCard({ barber }: { barber?: Barber | null }): JSX.Element | null`, defaulting to `shopConfig.barber`.

- [ ] **Step 1: Write the failing unit test** `BarberCard.test.tsx`, using `renderToStaticMarkup`:
  - `<BarberCard barber={null} />` → `""`;
  - with `{ name: "Test Name", photo: "/x.webp", width: 800, height: 1000, alt: "Test Name at the chair" }`, the HTML contains `Test Name` and `alt="Test Name at the chair"`;
  - `shopConfig.barber` is `null` (the demo default).
- [ ] **Step 2:** run `npx vitest run src/components/marketing/BarberCard.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Add the config.**
  - `intro: "A Euro-Afro barbershop on Upperthorpe Road. Fades, tapers, beards and designs. Walk in, or book your chair online."`, with the comment `// draft: owner to approve`.
  - `barber: null as Barber | null`, with the comment `// set only with the owner's approved name and photo`.
- [ ] **Step 4: Implement `BarberCard`.**
  - Return null when there is no barber.
  - Otherwise render a `<section aria-labelledby="barber-h">` with a 4:5 `next/image` (`sizes="(min-width: 768px) 33vw, 100vw"`) and the name as `h2#barber-h font-heading` over a bottom gradient.
  - Run the test: PASS.
- [ ] **Step 5: Write the failing e2e test** `"visit-us offers directions and call"`: in `#hours`, the link named `Directions` has `href` equal to `shopConfig.mapsUrl`, the link named `Call` has `href` `tel:+447535423544`, both have a bounding box height of at least 48, and the heading "Opening hours" is visible.
- [ ] **Step 6: Implement `ShopIntro`** (server component):
  - section `bg-band py-16`;
  - a 4:5 `next/image` of `placeholder-shop.webp` (1200×1500, `alt=""`);
  - label `THE SHOP`, h2 `font-heading` "The shop", `<p>{shopConfig.intro}</p>`;
  - side by side at `md`.
- [ ] **Step 7: Restyle `Hours`.**
  - Label `VISIT` above the h2 "Opening hours"; the hours `dl` keeps today's logic and markup with `border-primary/20` rows.
  - Add `Directions` (`shopConfig.mapsUrl`) and `Call` (`tel:+${intlPhone(shopConfig.phone)}`) links, `min-h-12 rounded-sm`: Directions in gold fill, Call outlined.
  - Add a 3:2 `next/image` of `placeholder-visit.webp` (1800×1200, `alt=""`).
  - Keep `Closures` and the address.
- [ ] **Step 8: Restyle `SiteFooter`:** `bg-band border-t border-primary/20`, wordmark `font-heading`, links `min-h-12` where they are tap targets.
- [ ] **Step 9: Set the page order** in `page.tsx`: Hero, Marquee, Services, ShopIntro, BarberCard, Gallery, Hours, SiteFooter.
- [ ] **Step 10:** run `npx vitest run`, `npx playwright test --workers=1` and `npx tsc --noEmit`. Expected: all PASS.
- [ ] **Step 11: Commit** with the message "feat(home): shop intro, config-gated barber card, visit-us block, warm footer".

### Task 6: Gallery restyle

**Files:**
- Modify: `src/components/Gallery.tsx`
- Test: `e2e/gallery.spec.ts` (existing, unchanged)

- [ ] **Step 1: Restyle.**
  - Section `bg-background py-16`, content `max-w-[1100px]`.
  - Label `THE WORK` above the h2 "Recent work".
  - Grid `grid-cols-2 gap-2 sm:grid-cols-3`. Items: `aspect-[4/5] overflow-hidden border border-primary/20 bg-band`, no rounding.
  - Empty state: `border border-dashed border-primary/30 rounded-sm`, same text.
  - Keep the plain `<img>` and its comment, `alt`, `loading` and `decoding`.
- [ ] **Step 2:** run `npx playwright test e2e/gallery.spec.ts e2e/home.spec.ts --workers=1`. Expected: PASS.
- [ ] **Step 3: Commit** with the message "feat(home): editorial gallery grid".

### Task 7: Admin re-skin and login

**Files:**
- Modify: `src/components/admin/ui.ts`, `src/components/admin/AdminNav.tsx`, `src/components/admin/BookingRow.tsx` (status chip classes only)
- Modify: `src/app/admin/(shell)/layout.tsx`, `src/app/admin/login/page.tsx`
- Test: `e2e/admin-auth.spec.ts`

**Interfaces:**
- Consumes: Task 1 tokens; Task 2 `placeholder-shop.webp`.

- [ ] **Step 1: Write the failing e2e test** `"login page uses the shop theme"`:
  - go to `/admin/login`;
  - the computed `background-color` of `getByRole("button", { name: "Email me a sign-in link" })` is `rgb(201, 164, 76)`;
  - its height is at least 48;
  - the `body` background is `rgb(18, 15, 11)`.
- [ ] **Step 2:** run it. Expected: FAIL (the button is `bg-black`).
- [ ] **Step 3: Restyle the login page.**
  - Top: a 3:2 `next/image` strip of `placeholder-shop.webp` (`alt=""`), then the wordmark `font-heading`, then the h1 "Admin sign in".
  - Input: `min-h-12 rounded-sm border-input bg-card`. Button: `min-h-12 rounded-sm bg-primary text-primary-foreground uppercase tracking-[0.14em] text-sm`.
  - The "Not authorised" screen in `(shell)/layout.tsx` gets the same button style in place of `bg-black text-white`.
- [ ] **Step 4: Re-skin the shell.**
  - `ui.ts`:
    - `btn`: `rounded-xl` → `rounded-sm`;
    - `panel` → `rounded-sm border border-primary/20 bg-card p-4`;
    - `field`: `rounded-xl` → `rounded-sm`.
  - Shell header wordmark: `font-heading`.
  - Each admin page's h1: `font-heading`.
  - `AdminNav`: `border-t border-primary/20`; the current-tab indicator stays `bg-primary`.
- [ ] **Step 5: Status chips** in `BookingRow`: give each status a warm tint (`bg-primary/15 text-primary`, `bg-destructive/15 text-destructive`, `bg-muted text-muted-foreground`). Check every pair at 4.5:1 or better against `surface` with the Task 1 `ratio` helper (add the cases to `theme.test.ts`, using the solid colours they composite to).
- [ ] **Step 6:** run `npx playwright test --workers=1`, `npx vitest run` and `npx tsc --noEmit`. Expected: all PASS, including the admin-refresh tab-bar test.
- [ ] **Step 7:** take 320 and 390 screenshots of `/admin/login`, `/admin`, `/admin/status`, `/admin/settings` and `/admin/gallery`.
- [ ] **Step 8: Commit** with the message "feat(admin): Heritage re-skin and themed login".

### Task 8: Verification, review, handoff (orchestrator)

- [ ] Gates on `feat/redesign`, showing the real output:
  1. `npx tsc --noEmit`
  2. `npm test`
  3. `npx supabase db reset && npx supabase test db`
  4. `npx playwright test --workers=1` (stop any other `next dev` first)
  5. `rm -rf .next && npm run build`
- [ ] Lighthouse after, with the same commands as Task 0 (`lh-after.json`). Add the median results to `docs/perf/2026-11-15-lighthouse.md` and explain any regression of more than 5 points.
- [ ] Screenshot sweep at 320, 375, 390, 430, 768 and 1280 for `/`, `/book`, `/admin/login`, plus a reduced-motion check.
- [ ] `/code-review` on `feat/redesign` vs `build/zizus-barbers`, a fix loop, then `/security-review`.
- [ ] Update `docs/HANDOFF.md` section 0 (new look, placeholder photos, what was not verified, next steps). Tick the photo item in the memory file.
- [ ] Ask the developer before: merging `feat/redesign` into `build/zizus-barbers` (auto-deploys), any `git push`, and uploading the gallery set to `acppxnvjxihdxfabzyam`.
