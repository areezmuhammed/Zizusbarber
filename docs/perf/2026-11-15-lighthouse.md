# Lighthouse mobile: before and after the warm redesign

Method: `npm run build`, `npx next start -p 3200` against the local Supabase stack, then `npx lighthouse@12 http://localhost:3200/ --only-categories=performance --form-factor=mobile --chrome-flags="--headless=new"` three times (Playwright's Chromium via `CHROME_PATH`). Median of three. Local machine, so compare only before vs after, not against production.

| Run | Commit | Performance | LCP | CLS | TBT |
|---|---|---|---|---|---|
| Before (feat/redesign after admin-refresh merge) | b6edbbe | 89 | 3.4 s | 0 | 150 ms |

Raw runs before: 88 / 3.8 s / 0 / 90 ms; 90 / 3.4 s / 0 / 150 ms; 89 / 3.4 s / 0 / 170 ms.
