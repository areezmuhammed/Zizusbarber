import Link from "next/link";
import { connection } from "next/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayView } from "@/components/admin/DayView";
import { getDay } from "@/lib/admin-data";
import { parseDay } from "@/lib/admin-form";
import { utcToLondon } from "@/lib/time";

const nav =
  "grid size-12 place-items-center rounded-full border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export default async function Today({ searchParams }: { searchParams: Promise<{ date?: string | string[] }> }) {
  const { date: raw } = await searchParams;
  await connection(); // "today" is per request, never prerendered
  const now = utcToLondon(new Date());
  const today = now.toISODate()!;
  const date = parseDay(raw) ?? today;
  const { bookings, services } = await getDay(date); // checks the owner first

  const day = utcToLondon(new Date(`${date}T12:00:00Z`)).setLocale("en-GB");
  const isToday = date === today;
  // walk-ins today default to the next 5-minute mark; other days to 10:00
  const next = now.plus({ minutes: 5 - (now.minute % 5) });
  const defaultTime = isToday && next.toISODate() === today ? next.toFormat("HH:mm") : "10:00";

  return (
    <div className="grid gap-4">
      <header className="flex items-center gap-3">
        <Link href={`/admin?date=${day.minus({ days: 1 }).toISODate()}`} aria-label="Previous day" className={nav}>
          <ChevronLeft aria-hidden className="size-5" />
        </Link>
        <div className="flex-1 text-center">
          <h1 className="font-heading text-3xl leading-tight lining-nums">{isToday ? "Today" : day.toFormat("ccc d LLL yyyy")}</h1>
          {isToday ? (
            <p className="text-sm text-muted-foreground">{day.toFormat("cccc d LLLL")}</p>
          ) : (
            <Link href="/admin" className="inline-flex min-h-12 items-center px-2 text-sm text-primary underline-offset-4 hover:underline">
              Go to today
            </Link>
          )}
        </div>
        <Link href={`/admin?date=${day.plus({ days: 1 }).toISODate()}`} aria-label="Next day" className={nav}>
          <ChevronRight aria-hidden className="size-5" />
        </Link>
      </header>
      <DayView key={date} date={date} bookings={bookings} services={services} defaultTime={defaultTime} />
    </div>
  );
}
