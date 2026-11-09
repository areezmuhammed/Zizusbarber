import type { MetadataRoute } from "next";
import { shopConfig } from "../../shop.config";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" }, sitemap: `${shopConfig.url}/sitemap.xml` };
}
