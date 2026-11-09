import type { MetadataRoute } from "next";
import { shopConfig } from "../../shop.config";

// Public pages only: never /admin, /auth or /booking/<token>.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: shopConfig.url, changeFrequency: "weekly", priority: 1 },
    { url: `${shopConfig.url}/book`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${shopConfig.url}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${shopConfig.url}/cookies`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
