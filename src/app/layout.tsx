import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans, JetBrains_Mono } from "next/font/google";
import { DAYS } from "@/components/Hours";
import { hhmm } from "@/lib/format";
import { getHours } from "@/lib/shop-data";
import { shopConfig } from "../../shop.config";
import "./globals.css";

const serif = Cormorant_Garamond({ variable: "--font-serif", subsets: ["latin"], weight: ["500", "600"] });
const sans = DM_Sans({ variable: "--font-sans", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono-face", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(shopConfig.url),
  title: `${shopConfig.name} | ${shopConfig.tagline}`,
  description: `${shopConfig.tagline}. Book online at ${shopConfig.address}, or call ${shopConfig.phone}.`,
};

const t = shopConfig.theme;
const themeVars = {
  "--background": t.bg,
  "--foreground": t.text,
  "--card": t.surface,
  "--card-foreground": t.text,
  "--primary": t.accent,
  "--primary-foreground": t.bg,
  "--muted": t.surface,
  "--muted-foreground": t.muted,
  "--border": `color-mix(in oklab, ${t.text} 14%, transparent)`,
  "--ring": t.accent,
} as CSSProperties;

// shortcut: parses "street, Town POSTCODE"; move to structured config fields if a shop's address doesn't fit
const [, street, town, postalCode] = shopConfig.address.match(/^(.*), (.*) (\S+ \S+)$/) ?? [];

async function salonJsonLd() {
  const hours = await getHours();
  return {
    "@context": "https://schema.org",
    "@type": "HairSalon",
    name: shopConfig.name,
    url: shopConfig.url,
    telephone: shopConfig.phone,
    address: { "@type": "PostalAddress", streetAddress: street, addressLocality: town, postalCode, addressCountry: "GB" },
    openingHoursSpecification: hours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${DAYS[h.weekday]}`,
      opens: hhmm(h.open_local),
      closes: hhmm(h.close_local),
    })),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const jsonLd = await salonJsonLd();
  return (
    <html lang="en-GB" className={`${serif.variable} ${sans.variable} ${mono.variable} antialiased`} style={themeVars}>
      <body className="min-h-dvh overflow-x-clip">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
        {children}
      </body>
    </html>
  );
}
