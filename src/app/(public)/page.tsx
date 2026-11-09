import { Gallery } from "@/components/Gallery";
import { Hero } from "@/components/Hero";
import { DAYS, Hours } from "@/components/Hours";
import { Services } from "@/components/Services";
import { StickyBar } from "@/components/StickyBar";
import { hhmm, intlPhone } from "@/lib/format";
import { getHours } from "@/lib/shop-data";
import { shopConfig } from "../../../shop.config";

// shortcut: parses "street, Town POSTCODE"; move to structured config fields if a shop's address doesn't fit
const [, street, town, postalCode] = shopConfig.address.match(/^(.*), (.*) (\S+ \S+)$/) ?? [];

// Lives on the home page, not the root layout, so other routes never depend on the DB. No ratings: none are real.
async function SalonJsonLd() {
  const hours = await getHours();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HairSalon",
    name: shopConfig.name,
    url: shopConfig.url,
    telephone: `+${intlPhone(shopConfig.phone)}`,
    address: { "@type": "PostalAddress", streetAddress: street, addressLocality: town, postalCode, addressCountry: "GB" },
    openingHoursSpecification: hours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${DAYS[h.weekday]}`,
      opens: hhmm(h.open_local),
      closes: hhmm(h.close_local),
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
    />
  );
}

export default function Home() {
  return (
    <>
      <SalonJsonLd />
      <main className="pb-24">
        <Hero />
        <Services />
        <Gallery />
        <Hours />
        <footer className="px-5 pb-8 text-center text-xs text-muted-foreground">&copy; {shopConfig.name}</footer>
      </main>
      <StickyBar />
    </>
  );
}
