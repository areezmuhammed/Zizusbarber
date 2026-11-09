import { Gallery } from "@/components/Gallery";
import { Hero } from "@/components/Hero";
import { Hours } from "@/components/Hours";
import { Services } from "@/components/Services";
import { StickyBar } from "@/components/StickyBar";
import { shopConfig } from "../../../shop.config";

export default function Home() {
  return (
    <>
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
