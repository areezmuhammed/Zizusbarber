# Photo register

Every photo below is an **AI-generated placeholder** (Codex imagegen, 15 November 2026) for the private demo only. Replace each with the owner's real photo before launch (`docs/launch-checklist.md`, "Photos"). Never present them as the shop's real work. Keep the same file name and pixel size when swapping, or update the `width`/`height` where the file is used.

## Brand photos (`public/images/brand/`, used by the home page and admin login)

| File | Slot | Size |
|---|---|---|
| `placeholder-hero-mobile.webp` | Home hero, phones (4:5) | 1120×1400 |
| `placeholder-hero-desktop.webp` | Home hero, 768px and wider (16:9) | 1664×936 |
| `placeholder-menu.webp` | Prices section (3:2) | 1536×1024 |
| `placeholder-shop.webp` | "The shop" section and admin login strip (4:5) | 1120×1400 |
| `placeholder-visit.webp` | Visit us section (3:2), door with no signage | 1536×1024 |

## Gallery set (`docs/photos/gallery/`, not served directly)

`placeholder-gallery-1.webp` to `placeholder-gallery-6.webp`, 1120×1400 (4:5): fades, a taper, a beard line-up, a hair design, a curly top, a buzz cut. The "Recent work" gallery reads from the database, so these are uploaded through `/admin/gallery`: freely on the local stack; on the demo Supabase project only with the developer's yes. They are AI-generated, so they must be deleted from the gallery before launch.
