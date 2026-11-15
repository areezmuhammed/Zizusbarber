import Link from "next/link";
import { Suspense } from "react";
import { shopConfig } from "../../shop.config";
import { HeroVisual } from "./marketing/HeroVisual";
import { StatusBadge, StatusBadgeFallback } from "./StatusBadge";

export function Hero() {
  return (
    <header className="relative isolate flex min-h-[85svh] flex-col overflow-hidden bg-band">
      <HeroVisual />
      <div className="relative z-10 flex min-h-[54px] items-center justify-between px-5 pt-4">
        <span className="font-heading text-lg">Zizu&apos;s</span>
        <Suspense fallback={<StatusBadgeFallback />}>
          <StatusBadge />
        </Suspense>
      </div>
      <div className="relative z-10 mx-auto mt-auto w-full max-w-[1100px] px-5 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-16">
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
          <p className="text-[11px] tracking-[0.3em] text-primary uppercase">{shopConfig.area}</p>
          <h1 className="mt-3 font-heading text-[clamp(2.75rem,13vw,5.5rem)] leading-[0.95]">
            <span className="block">Zizu&apos;s</span>{" "}
            <span className="block text-primary">Barbers</span>
          </h1>
          <p className="mt-4 max-w-[24ch] font-voice text-2xl leading-snug text-foreground/90">{shopConfig.tagline}</p>
          <div className="mt-6">
            <Link
              href="/book"
              className="inline-flex min-h-12 items-center rounded-sm bg-primary px-7 text-sm tracking-[0.14em] text-primary-foreground uppercase transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Book an appointment
            </Link>
          </div>
          <a
            href={shopConfig.mapsUrl}
            className="mt-2 inline-block py-3 text-sm text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
          >
            {shopConfig.address}
          </a>
        </div>
      </div>
    </header>
  );
}
