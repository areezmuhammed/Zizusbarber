import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { Cormorant_Garamond, JetBrains_Mono, Manrope, Marcellus } from "next/font/google";
import { shopConfig } from "../../shop.config";
import "./globals.css";

const serif = Marcellus({ variable: "--font-serif", subsets: ["latin"], weight: "400" });
const voice = Cormorant_Garamond({ variable: "--font-voice-face", subsets: ["latin"], weight: "500", style: "italic" });
const sans = Manrope({ variable: "--font-sans", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono-face", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || shopConfig.url),
  title: `${shopConfig.name} | ${shopConfig.tagline}`,
  description: `${shopConfig.tagline}. Book online at ${shopConfig.address}, or call ${shopConfig.phone}.`,
  openGraph: { type: "website", siteName: shopConfig.name, locale: "en_GB" }, // image: app/opengraph-image.tsx
  twitter: { card: "summary_large_image" },
};

// Every shadcn token maps to the shop theme; there is no light palette.
const t = shopConfig.theme;
const line = `color-mix(in oklab, ${t.text} 14%, transparent)`;
const raised = `color-mix(in oklab, ${t.text} 8%, ${t.surface})`;
const themeVars = {
  "--background": t.bg,
  "--band": t.band,
  "--foreground": t.text,
  "--card": t.surface,
  "--card-foreground": t.text,
  "--popover": t.surface,
  "--popover-foreground": t.text,
  "--primary": t.accent,
  "--primary-foreground": t.bg,
  "--secondary": raised,
  "--secondary-foreground": t.text,
  "--muted": t.surface,
  "--muted-foreground": t.muted,
  "--accent": raised,
  "--accent-foreground": t.text,
  "--destructive": t.destructive,
  "--border": line,
  "--input": `color-mix(in oklab, ${t.text} 20%, transparent)`,
  "--ring": t.accent,
  "--chart-1": t.accent,
  "--chart-2": t.text,
  "--chart-3": t.muted,
  "--chart-4": `color-mix(in oklab, ${t.accent} 60%, ${t.bg})`,
  "--chart-5": `color-mix(in oklab, ${t.muted} 60%, ${t.bg})`,
  "--sidebar": t.surface,
  "--sidebar-foreground": t.text,
  "--sidebar-primary": t.accent,
  "--sidebar-primary-foreground": t.bg,
  "--sidebar-accent": raised,
  "--sidebar-accent-foreground": t.text,
  "--sidebar-border": line,
  "--sidebar-ring": t.accent,
  colorScheme: "dark",
} as CSSProperties;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`dark ${serif.variable} ${voice.variable} ${sans.variable} ${mono.variable} antialiased`} style={themeVars}>
      <body className="min-h-dvh overflow-x-clip">
        {/* No <Analytics /> here: it would record /booking/<token> and /admin paths. Public pages render it. */}
        {children}
      </body>
    </html>
  );
}
