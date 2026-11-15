# Reference analysis: originalbarbershop.nyc (15 November 2026)

The developer likes this site's visuals and wants Zizu's public site to feel like it. This is **inspiration only**: do not copy its text, photos, logo, video, brand name or layout one-to-one. Zizu's must stay its own brand (Sheffield, Euro-Afro styling). Measured in the built-in browser at desktop width; the mobile layout was **not** checked.

## Why it feels better than our current site

It is **not lighter** than ours. Its backgrounds are near-black too (`#100E0B`, `#090807`, `#0C0B09`). The difference is that it is **warm** and **photo-led**:

| | originalbarbershop.nyc | Zizu's today |
|---|---|---|
| Background | warm brown-black `#100E0B` / `#090807`, never neutral | neutral near-black, reads cold ("depressing") |
| Text | warm cream `#F3EAD8` | ivory/white |
| Accent | mustard gold `#BC9F1F` (buttons, small labels) | brass `primary` |
| Hero | full-viewport (832px of 832px) photo with a muted looping video on top, `object-fit: cover`, a bottom-to-top dark gradient plus a radial vignette so text stays readable | type only, no image |
| Photography | everywhere: hero, story section (interior photo next to text), barber portraits, photo-topped service cards, a 6-photo interior gallery, an embedded short film | only the small "Recent work" grid |
| Display type | Cinzel (classical Roman capitals), 96px h1, wide tracking; two-tone h1 (cream line, gold line) | Cormorant-style serif, mixed case |
| Body type | Outfit (geometric sans), 16px; Cormorant Garamond italic for taglines | DM-Sans-like sans |
| Small labels | tiny tracked gold capitals above headings ("THE WORK", "THE CHAIRS") | none |
| Motion | one looping marquee strip of words between hero and story; hero video; otherwise calm | small fade-in on hero |
| Sections | Hero, marquee, Our Story, short film, Master Barbers (portrait cards), Services (photo cards with price and duration, Book button each), quote, Reviews, Gallery, FAQ, after-hours event, footer | Hero, Prices, Gallery, Hours, footer |
| Booking | gold "BOOK NOW" in the fixed top nav and in the hero, plus per-service Book buttons | hero button plus the sticky bottom bar |

## What to take for Zizu's (proposal, needs the developer's approval)

1. **Warm the palette**, keeping it dark: brown-black base, cream text, gold accent. Check contrast is still at least 4.5:1.
2. **A full-bleed photographic hero** with gradient and vignette overlays, the Zizu's wordmark on top, Book and Call buttons, and address/phone/"walk in or book" underneath. Video is optional and only if a real shop clip exists; respect reduced motion and data saving.
3. **Photo-led sections**: a story block with a shop photo, service cards with an image, price and duration plus a Book button (data still from `getServices()`), a larger gallery fed by the owner's admin uploads, and a barber card only with the owner's approved name and photo.
4. **Type**: one display face with character for headings (Cinzel-like Roman capitals, or another choice the design pass makes) plus a clean sans; small gold labels used sparingly, not above every heading.
5. **One motion idea**, for example a marquee strip ("Cut · Fade · Beard · Upperthorpe"). No scroll hijacking.
6. **Keep what already works**: live status badge, sticky Book/Call/WhatsApp bar on mobile, real hours from the database, booking flow untouched.

## Hard caveats

- Their strength is **real photographs and a real film of the real shop**. Zizu's demo uses six **AI-generated** photos (fine for a private demo only, never as "Recent work" on the live site). The redesign needs the owner's real photos before launch.
- No invented testimonials, ratings, barber bios or "est." dates. Reviews, FAQ answers and story text need the owner's real facts.
- Fonts must be self-hosted through `next/font` (Google Fonts are free to use); no new animation libraries unless the plan justifies one.
