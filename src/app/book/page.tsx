import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { BookingSheet } from "@/components/BookingSheet";
import { openDays } from "@/lib/booking-form";
import { getClosures, getHours, getServices } from "@/lib/shop-data";
import { utcToLondon } from "@/lib/time";
import { shopConfig } from "../../../shop.config";

export const metadata: Metadata = { title: `Book | ${shopConfig.name}` };

const DAYS_SHOWN = 14;

async function Booking() {
  await connection(); // "today" must be the request's day, not the build's
  const now = new Date();
  const [services, hours, closures] = await Promise.all([
    getServices(),
    getHours(),
    getClosures(utcToLondon(now).toISODate()!),
  ]);
  return <BookingSheet services={services} days={openDays(now, DAYS_SHOWN, hours, closures)} />;
}

export default function BookPage() {
  return (
    <main className="flex min-h-dvh flex-col">
      <Link
        href="/"
        className="flex min-h-12 items-center self-start px-5 font-heading text-xl focus-visible:outline-2 focus-visible:outline-primary"
      >
        {shopConfig.name}
      </Link>
      <Suspense fallback={<p className="p-5 text-muted-foreground">Loading services…</p>}>
        <Booking />
      </Suspense>
    </main>
  );
}
