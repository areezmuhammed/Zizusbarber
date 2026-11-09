import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CancelBooking } from "@/components/CancelBooking";
import { DeleteMyData } from "@/components/DeleteMyData";
import { StopReminders } from "@/components/StopReminders";
import { getBookingByToken } from "@/lib/customer-booking";
import { formatPrice } from "@/lib/format";
import { utcToLondon } from "@/lib/time";
import { shopConfig } from "../../../../shop.config";

export const instant = false; // blocking on purpose: an unknown token must answer with a real 404 status

export const metadata: Metadata = { title: `Your booking | ${shopConfig.name}`, robots: { index: false, follow: false } };

const when = (iso: string) => utcToLondon(new Date(iso)).toFormat("ccc d LLL, HH:mm");
const STATUS: Record<string, string> = {
  pending: "Confirmed", confirmed: "Confirmed", arrived: "Arrived", done: "Completed", no_show: "Missed", cancelled: "Cancelled",
};

export default async function BookingPage({ params }: { params: Promise<{ token: string }> }) {
  await connection(); // per-customer, never cached
  const { token } = await params;
  const b = await getBookingByToken(token);
  if (!b) notFound();
  // only start-time moves; a length-only change (extend_booking's row for its own target) is not a "move"
  const change = b.changes.filter((c) => Date.parse(c.new_start) !== Date.parse(c.old_start)).at(-1);
  const cancellable = b.status === "confirmed" || b.status === "pending";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-5 pb-10">
      <Link
        href="/"
        className="flex min-h-12 items-center self-start font-heading text-xl focus-visible:outline-2 focus-visible:outline-primary"
      >
        {shopConfig.name}
      </Link>
      <h1 className="font-heading text-3xl">Hi {b.first_name}</h1>
      {change && b.status !== "cancelled" && (
        <p role="status" className="rounded-xl border border-primary bg-card p-4 text-sm">
          Your appointment was moved by the shop to {when(change.new_start)}
        </p>
      )}
      <section aria-label="Your booking" className="grid gap-3 rounded-xl bg-card p-5">
        <p className="text-sm text-muted-foreground">{STATUS[b.status] ?? b.status}</p>
        <p className="text-xl">{b.service_name}</p>
        <p>{when(b.start_at)}</p>
        <p className="text-muted-foreground">
          {formatPrice(b.price_pence)} · {b.duration_min} min
        </p>
        <p className="text-muted-foreground">{shopConfig.address}</p>
      </section>
      {b.status === "cancelled" && <p role="status">This appointment has been cancelled.</p>}
      {cancellable && (
        <>
          <a
            href={`/booking/${token}/calendar.ics`}
            className="flex min-h-12 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Add to calendar
          </a>
          <StopReminders token={token} off={b.reminders_off} />
          <CancelBooking token={token} />
        </>
      )}
      <section aria-label="Your data" className="mt-6 grid gap-2 border-t border-border pt-5">
        <p className="text-sm text-muted-foreground">
          See how we use your details in our <Link href="/privacy" className="underline underline-offset-4">privacy notice</Link>.
        </p>
        <DeleteMyData token={token} />
      </section>
    </main>
  );
}
