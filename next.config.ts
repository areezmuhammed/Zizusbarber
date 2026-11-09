import type { NextConfig } from "next";
import { redirects } from "./src/lib/redirects";

const nextConfig: NextConfig = {
  // www/non-www canonicalisation is done at the host (docs/launch-checklist.md)
  redirects: async () => redirects(),
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
