import { DAYS } from "@/components/Hours";
import { formatPrice, hhmm, intlPhone } from "./format";
import type { Hours, Service } from "./shop-data";
import { shopConfig } from "../../shop.config";

// e.g. "£5-£20"; undefined when there are no services
export function priceRange(services: Pick<Service, "price_pence">[]): string | undefined {
  if (!services.length) return undefined;
  const p = services.map((s) => s.price_pence);
  const [lo, hi] = [Math.min(...p), Math.max(...p)];
  return lo === hi ? formatPrice(lo) : `${formatPrice(lo)}-${formatPrice(hi)}`;
}

// shortcut: parses "street, Town POSTCODE"; move to structured config fields if a shop's address doesn't fit
const [, street, town, postalCode] = shopConfig.address.match(/^(.*), (.*) (\S+ \S+)$/) ?? [];

// No ratings: none are real.
export function buildSalonJsonLd(hours: Hours[], services: Pick<Service, "price_pence">[]) {
  return {
    "@context": "https://schema.org",
    "@type": "HairSalon",
    name: shopConfig.name,
    url: shopConfig.url,
    image: `${shopConfig.url}/opengraph-image`,
    telephone: `+${intlPhone(shopConfig.phone)}`,
    priceRange: priceRange(services),
    hasMap: shopConfig.mapsUrl,
    sameAs: shopConfig.sameAs,
    address: { "@type": "PostalAddress", streetAddress: street, addressLocality: town, postalCode, addressCountry: "GB" },
    openingHoursSpecification: hours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${DAYS[h.weekday]}`,
      opens: hhmm(h.open_local),
      closes: hhmm(h.close_local),
    })),
  };
}
