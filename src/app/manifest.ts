import type { MetadataRoute } from "next";
import { shopConfig } from "../../shop.config";

// Icons in public/ are generated placeholders (docs/launch-checklist.md).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: shopConfig.name,
    short_name: "Zizu's",
    description: `${shopConfig.tagline}. Book online.`,
    start_url: "/",
    display: "standalone",
    background_color: shopConfig.theme.bg,
    theme_color: shopConfig.theme.bg,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
