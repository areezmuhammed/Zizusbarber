"use client"; // error boundaries must be Client Components

import { ErrorScreen } from "@/components/ErrorScreen";
import { shopConfig } from "../../shop.config";

// Replaces the root layout when it fails, so it brings its own <html>/<body> and theme.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en-GB" style={{ colorScheme: "dark", background: shopConfig.theme.bg }}>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <title>{`Something went wrong | ${shopConfig.name}`}</title>
        <ErrorScreen retry={retry} />
      </body>
    </html>
  );
}
