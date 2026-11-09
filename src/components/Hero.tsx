import Link from "next/link";
import { Suspense } from "react";
import { shopConfig } from "../../shop.config";
import { StatusBadge, StatusBadgeFallback } from "./StatusBadge";

export function Hero() {
  return (
    <header className="relative overflow-hidden px-5 pt-10 pb-14">
      <div
        className="pointer-events-none absolute inset-y-0 right-5 w-px bg-gradient-to-b from-transparent via-primary/60 to-transparent"
        aria-hidden
      />
      <div className="mx-auto max-w-2xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700">
        <Suspense fallback={<StatusBadgeFallback />}>
          <StatusBadge />
        </Suspense>
        <h1 className="mt-8 font-heading text-[clamp(3.75rem,19vw,7.5rem)] leading-[0.86] font-semibold tracking-[-0.02em]">
          <span className="block">Zizu&apos;s</span>
          <span className="block pl-[0.6em]">Barbers</span>
        </h1>
        <p className="mt-6 max-w-[22ch] text-lg leading-snug text-foreground/90">{shopConfig.tagline}</p>
        <a
          href={shopConfig.mapsUrl}
          className="mt-2 inline-block py-3 text-sm text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
        >
          {shopConfig.address}
        </a>
        <div className="mt-6">
          <Link
            href="/book"
            className="inline-flex min-h-12 items-center rounded-full bg-primary px-7 font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Book an appointment
          </Link>
        </div>
      </div>
    </header>
  );
}
