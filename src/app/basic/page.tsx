import type { Metadata } from "next";
import { Gallery } from "@/components/Gallery";
import { Hero } from "@/components/Hero";
import { Hours } from "@/components/Hours";
import { BarberCard } from "@/components/marketing/BarberCard";
import { Marquee } from "@/components/marketing/Marquee";
import { ShopIntro } from "@/components/marketing/ShopIntro";
import { Services } from "@/components/Services";
import { SiteFooter } from "@/components/SiteFooter";
import { StickyBar } from "@/components/StickyBar";
import { shopConfig } from "../../../shop.config";

export const metadata: Metadata = { title: { absolute: `${shopConfig.name} (Basic)` } };

// The home page without online booking or live status.
export default function BasicHome() {
  return (
    <>
      <main className="pb-24">
        <Hero basic />
        <Marquee />
        <Services />
        <ShopIntro />
        <BarberCard />
        <Gallery />
        <Hours />
        <SiteFooter />
      </main>
      <StickyBar basic />
    </>
  );
}
