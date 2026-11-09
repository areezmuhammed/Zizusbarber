import type { MetadataRoute } from "next";
import { shopConfig } from "../../shop.config";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: shopConfig.url, changeFrequency: "weekly", priority: 1 }];
}
