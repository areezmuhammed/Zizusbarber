import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { shopConfig } from "../../shop.config";

export const metadata: Metadata = { title: `Page not found | ${shopConfig.name}`, robots: { index: false } };

const btn =
  "inline-flex min-h-12 items-center justify-center rounded-sm px-7 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export default function NotFound() {
  return (
    <>
      <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col justify-center px-5 py-14">
        <h1 className="font-heading text-5xl leading-none font-semibold">Page not found</h1>
        <p className="mt-4 text-muted-foreground">
          This page does not exist, or the link has expired. If it was a booking link, the booking may have been
          deleted. Call {shopConfig.phone} if you need help.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/book" className={`${btn} bg-primary text-primary-foreground`}>Book an appointment</Link>
          <Link href="/" className={`${btn} border border-border`}>Home</Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
