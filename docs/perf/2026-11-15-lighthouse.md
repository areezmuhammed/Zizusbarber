# Lighthouse mobile: before and after the warm redesign

Method: `npm run build`, `npx next start -p 3200` against the local Supabase stack, then `npx lighthouse@12 http://localhost:3200/ --only-categories=performance --form-factor=mobile --chrome-flags="--headless=new"` three times (Playwright's Chromium via `CHROME_PATH`). Median of three. Local machine, so compare only before vs after, not against production.

| Run | Commit | Performance | LCP | CLS | TBT |
|---|---|---|---|---|---|
| Before (feat/redesign after admin-refresh merge) | b6edbbe | 89 | 3.4 s | 0 | 150 ms |

Raw runs before: 88 / 3.8 s / 0 / 90 ms; 90 / 3.4 s / 0 / 150 ms; 89 / 3.4 s / 0 / 170 ms.
| After (warm redesign, final) | 6f85260 | 87 | 3.8 s | 0 | 120 ms |

Raw runs after: 85 / 4.2 s / 0 / 100 ms; 88 / 3.8 s / 0 / 120 ms; 87 / 3.8 s / 0 / 150 ms.

Notes:
- Before the final fix wave (a856c3d) the median was 79 / 4.6 s: `getImageProps` defaults to `loading="lazy"`, so the hero
  photo (the LCP element) loaded late. `HeroVisual` now sets `loading: "eager"` with `fetchPriority="high"`, and an e2e
  test asserts the hero image is not lazy.
- The remaining ~0.4 s LCP cost is the full-bleed hero photo (the old hero was text). CLS stays 0. Real owner photos
  should be exported at the same pixel sizes (`docs/photos.md`) so this does not grow.
