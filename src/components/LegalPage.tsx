import type { ReactNode } from "react";
import Link from "next/link";
import { Analytics } from "./Analytics";
import { SiteFooter } from "./SiteFooter";
import { shopConfig } from "../../shop.config";

export const DRAFT = <div hidden dangerouslySetInnerHTML={{ __html: "<!-- DRAFT - not legal advice: review before launch -->" }} />;

// Shared shell for /privacy and /cookies: one readable column (~65ch), serif headings, roomy sans body.
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <>
      {DRAFT}
      <main className="mx-auto max-w-[65ch] px-5 pt-6 pb-14">
        <Link
          href="/"
          className="flex min-h-12 items-center self-start font-heading text-xl focus-visible:outline-2 focus-visible:outline-primary"
        >
          {shopConfig.name}
        </Link>
        <h1 className="mt-8 font-heading text-5xl leading-none font-semibold tracking-[-0.01em]">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated {updated}</p>
        <div className="mt-10 space-y-5 text-[1.0625rem] leading-relaxed text-foreground/90 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-12 [&_h2]:font-heading [&_h2]:text-3xl [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-2">
          {children}
        </div>
      </main>
      <SiteFooter />
      <Analytics />
    </>
  );
}
