import type { Metadata } from "next";
import { Gallery } from "@/components/Gallery";
import { Hero } from "@/components/Hero";
import { Hours } from "@/components/Hours";
import { Services } from "@/components/Services";
import { SiteFooter } from "@/components/SiteFooter";
import { StickyBar } from "@/components/StickyBar";
import { buildSalonJsonLd } from "@/lib/seo";
import { getHours, getServices } from "@/lib/shop-data";
import { shopConfig } from "../../../shop.config";

const title = `Barber in ${shopConfig.area} | ${shopConfig.name}`;
const description = `Euro-Afro barber in ${shopConfig.area}: haircuts, fades, beards and designs at ${shopConfig.address}. Book online or call ${shopConfig.phone}.`;

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/" }, // og/twitter come from the root layout; redefining them here would drop the og image
};

// Lives on the home page, not the root layout, so other routes never depend on the DB.
async function SalonJsonLd() {
  const [hours, services] = await Promise.all([getHours(), getServices()]);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(buildSalonJsonLd(hours, services)).replace(/</g, "\\u003c") }}
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
        <SiteFooter />
      </main>
      <StickyBar />
    </>
  );
}
