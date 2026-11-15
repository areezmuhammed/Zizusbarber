# Zizu's Barbers: frontend design research and implementation plan

Saved 15 November 2026. Source: the developer's own frontend research (pasted into the session), kept here verbatim in substance. Status: **decided direction, no code written yet.** Reference images are in `references/`.

## 1. Decisions made

| Question | Decision |
|---|---|
| Photos available | Some (build around ONE excellent photograph first; do not depend on a large library) |
| Design direction | Luxury **editorial**: midnight black, brass gold, ivory; dramatic photography and typography |
| Animation ambition | **Balanced**: CSS first, GSAP only for genuinely complex sequences, no WebGL in the first release |
| Business priority | **Balanced**: visual appeal must not hide prices, live status, location or the booking action |
| Locked | Next.js (existing app), luxury editorial, CSS-first motion, native scrolling |

Repo at the time of writing: `areezmuhammed/Zizusbarber`, branch `build/zizus-barbers`, commit `956f598` (the build described in `docs/superpowers/`).

Important constraint: the launch checklist (`docs/launch-checklist.md`) is independent of the redesign. Privacy, messaging, deployment and abuse-protection items remain launch blockers however good the animations are.

## 2. Delivery sequence

| PR | Scope |
|---|---|
| **1** | Photographic hero and mobile visual foundation (build first) |
| 2 | Editorial service menu and subtle scroll reveals |
| 3 | Gallery optimisation and improved presentation |
| 4 | Booking micro-interactions and mobile polish |
| 5 | Shop story, location and conversion refinement |
| 6 | Optional cinematic animation experiment (discard if it does not clearly beat the CSS version) |

## 3. PR 1: signature photographic hero

**Art direction.** A dark photographic composition, large expressive "Zizu's" typography, restrained gold accents and one clear booking button. It should feel like an independent premium grooming brand, not a generic booking-SaaS template.

**What the repo supports today.**
- `Hero.tsx` is server-rendered: StatusBadge, main heading, address, appointment link.
- Homepage order: Hero → Services → Gallery → Hours → Footer, with a fixed `StickyBar` (Book / Call / WhatsApp).
- The owner's gallery admin can upload, reorder, describe and delete photos, but there is **no hero-image selection feature** (the original spec mentioned one; it was not built). So PR 1 uses a **curated local image asset**; admin-managed hero images are a later, separate enhancement (needs a schema decision).

**Files.**

| File | Change |
|---|---|
| `src/components/Hero.tsx` | Restructure into a responsive composition; keep server rendering, real status and booking URL |
| `src/components/marketing/HeroVisual.tsx` | New presentational image component, responsive positioning, image fallback |
| `src/app/globals.css` | A few hero-specific styles and reduced-motion handling |
| `shop.config.ts` | Optionally a central hero asset path; keep brand tokens |
| `public/images/brand/` | Approved, compressed hero photography |
| `e2e/home.spec.ts` | Assertions for hero content, image layout, mobile CTA |
| `docs/` | Record image dimensions, crop and performance constraints |

Do NOT touch in PR 1: `BookingSheet.tsx`, Supabase schema, admin auth, notification handling.

**Mobile behaviour.**
- Heading and booking action visible immediately; the photo may take the main visual area but must not push booking controls out of reach.
- Fixed Book/Call/WhatsApp bar stays; test overlap with bottom safe areas and short viewports.
- If text overlays the image, contrast must stay accessible for every supported crop. Prefer a static gradient over blur or shaders.

**Animation.**
- Entrance: subtle opacity plus about 8-12 px vertical translate, 400-600 ms.
- No character-by-character text, no scroll hijacking, no pinned hero, no forced smooth scrolling.
- `prefers-reduced-motion`: show the final state immediately.

**Images.**
- Next.js `Image`, several responsive variants with a mobile-focused crop; practical target about 100-160 KB for the typical mobile hero response (a target, not a guarantee).
- Preload the real LCP image; size the container explicitly to avoid CLS.

**Acceptance checklist (PR 1).**
- [ ] Approved, genuine Zizu's photograph used
- [ ] 375 px layout shows the brand and a clear booking action
- [ ] No horizontal overflow at 320, 375, 390, 430 px
- [ ] Live status still uses existing server and realtime data
- [ ] Book, Call, WhatsApp destinations correct
- [ ] No new global animation dependency
- [ ] No layout shift from the hero image
- [ ] Reduced-motion shows all content immediately
- [ ] Homepage and booking regression tests pass
- [ ] Performance compared against the original baseline

**Performance gate.** Targets: mobile Lighthouse 90+, LCP under 2.5 s, INP under 200 ms, CLS under 0.1. There is no measured production baseline yet, so compare PR 1 against the same build environment and device profile before claiming any improvement. Merge condition: clear visual improvement, no functional regression, no material performance regression; any target exception needs a written justification.

## 4. Later PRs

**PR 2: editorial services and scroll animation.** Files: `Services.tsx`, new `marketing/ServiceReveal.tsx`, `globals.css`. Generous spacing, thin gold dividers, prominent names, aligned prices, subtle staggered reveal (CSS or Intersection Observer), native scroll, each section animates once. Keep `Services.tsx` a Server Component unless visibility detection truly needs a client one. If using CSS scroll timelines, wrap in `@supports` and keep static content for unsupported browsers; never hide service names by default without JavaScript. Data stays `getServices()`. Accept only if names, prices and durations stay accurate and admin edits still appear without a developer.

**PR 3: gallery optimisation.** Files: `Gallery.tsx`, `src/lib/shop-data.ts` if needed, new presentation components. Editorial two-column mobile grid, controlled ratios, gentle reveal, no continuous motion. Main technical work: stop serving the same full-size Storage URL at every viewport; evaluate Supabase image transformations vs Next.js image optimisation, and **confirm availability and cost on the actual Supabase plan** first. Preserve the owner's order from `GalleryManager.tsx`. A before/after component is conditional on genuine paired photos and must not need a migration.

**PR 4: booking micro-interactions.** Files: `BookingSheet.tsx`, booking presentation components, tests. 150-200 ms step transitions, clear selected/loading/confirmation states; keep heading focus, keyboard input and error announcements. **Animation must never control booking state**: it observes states, it does not redefine them. Beware exit animations that delay React unmounting or the deliberate focus move to the new step's heading. No backend changes.

**PR 5: shop story, location, conversion.** Files: `Hours.tsx`, `SiteFooter.tsx`, new `marketing/ShopStory.tsx`. Genuine shop photos, concise intro, clear hours (from the existing database, no second hard-coded list), Book/Call/Directions prominent. Use the existing Maps URL instead of an interactive embed. Any barber bio needs an approved name, photo and factual text; no invented testimonials, ratings or claims.

**PR 6: optional cinematic prototype.** GSAP photographic sequence (a few stills telling the craft of a cut), not Three.js. Must look clearly better than the CSS equivalent, keep native scroll, work on real phones and degrade gracefully. If not, discard it.

## 5. Dependency decisions

| Dependency | PR 1 | Later |
|---|---|---|
| Next.js, React, Tailwind | keep | core |
| `tw-animate-css` | keep (installed) | |
| `gsap`, `@gsap/react` | do not install | PR 6 or a proven complex sequence |
| `motion` | do not install | consider in PR 4 |
| `lenis` | do not install | not recommended |
| `three` / R3F | do not install | experiment only |
| Rive / Lottie | do not install | only for a commissioned illustration |
| HyperFrames | separate | promo-video project |

## 6. Testing and regression

Extend the existing Vitest and Playwright suites; do not add another framework.

| Gate | Check |
|---|---|
| Build | `npm run build` |
| Static | `npm run lint`, `npx tsc --noEmit` |
| Unit | `npm test` |
| E2E | relevant Playwright specs (`--workers=1`, local Supabase running) |
| Accessibility | axe where feasible plus manual keyboard testing |
| Visual | mobile screenshots vs baseline |
| Performance | consistent Lighthouse CI settings plus selected real-device checks |

Viewport matrix: iPhone Safari 375-390 (hero, sticky CTA, safe areas); small iPhone ~320 (wrapping, overflow); Android Chrome 360-412 (touch, image delivery); 430 (crop); tablet 768; desktop 1280 (line length). Include reduced-motion and slow-network runs. Repeat on a real iPhone and Android before launch: screenshots cannot show delayed taps or GPU jank.

## 7. Suggested structure

```
src/components/
  Hero.tsx  Services.tsx  Gallery.tsx  Hours.tsx  StickyBar.tsx  BookingSheet.tsx
  marketing/
    HeroVisual.tsx      # PR 1
    ServiceReveal.tsx   # PR 2
    GalleryCard.tsx     # PR 3
    BeforeAfter.tsx     # optional, PR 3
    ShopStory.tsx       # PR 5
public/images/brand/    # approved hero assets
e2e/ home.spec.ts gallery.spec.ts booking-page.spec.ts motion-mobile.spec.ts (new)
```

Do not build a general animation framework or design system for five marketing sections.

## 8. PR 1 hand-off brief (for an implementation session)

**Objective.** Mobile-first photographic homepage hero for the existing Next.js app. Dark luxury editorial, genuine haircut photography, existing brass-gold and ivory palette, restrained CSS motion.

**Before coding:** verify HEAD, read `AGENTS.md` (Next.js 16 conventions; consult `node_modules/next/dist/docs`); inspect `Hero.tsx`, `StickyBar.tsx`, `StatusBadge.tsx`, `globals.css`, `layout.tsx`, `shop.config.ts` and homepage tests; establish the current performance baseline; confirm which approved image is used; confirm current functional and accessibility requirements.

**Scope.** Only the homepage hero and its directly related presentation; keep tokens, copy (unless approved), live status and booking navigation; responsive image component with explicit aspect ratio, optimised loading, static fallback; CSS animation with reduced-motion handling; correct layouts at 320, 375, 390, 430, 768, 1280 px; add or extend tests.

**Exclusions.** No booking logic, Supabase schema or auth changes; no owner gallery-management changes; no GSAP, Lenis, Three.js or Motion without an approved technical reason; no autoplay video or WebGL; no invented testimonials, ratings, bios or claims; no changes to notification processing or booking security.

**Deliverables.** Implementation summary; files changed and why; before/after mobile screenshots; build and test results; performance comparison with baseline; known limitations; proposed PR 2 follow-up. Keep the PR isolated and revertable.

## 9. Open inputs still needed

1. **Which real Zizu's photograph is approved**, and whether it may be used publicly.
2. Whether the owner wants to change the hero from the admin later (recommended: separate enhancement).
3. A reachable preview build, so before/after performance can be compared.
4. Whether the existing tagline ("Premium Euro-Afro Styling in Sheffield") stays unchanged (preserve until approved).

## 10. Priority order

Locked: Next.js, luxury editorial, CSS-first motion, native scrolling. Next: pick the real hero photo and measure the baseline. Then: implement and validate PR 1. Afterwards: let real visual, performance and booking results decide how ambitious later PRs get.

## 11. Reference images (`references/`)

| File | What it shows |
|---|---|
| `01-dribbble-dark-yellow-barber-app.webp` | Dribbble dark app mock-up: black surfaces, yellow accent, calendar and time chips (booking UX reference) |
| `02-editorial-service-reveal-gold-on-black.png` | "Blade & Craft" service cards: gold on black, large numerals, serif headings (PR 2 reference) |
| `03-signature-hero-photographic-concepts.webp` | Photographic hero concepts, with the "Signature Hero" write-up (PR 1 reference) |
| `04-stack-tiers-recommendation.png` | The three stack tiers; Tier 1 "lightweight premium" is the release target |
