import { notFound } from "next/navigation";
import { getBookingForCalendar } from "@/lib/admin-data";
import { NotOwnerError } from "@/lib/auth";
import { isUuid } from "@/lib/customer-booking";
import { buildOwnerIcs } from "@/lib/ics";

// Owner-only (the file holds the customer's name and phone). Signed out: requireOwner redirects to the login page.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let booking;
  try {
    booking = isUuid(id) ? await getBookingForCalendar(id) : null;
  } catch (e) {
    if (e instanceof NotOwnerError) return new Response("Forbidden", { status: 403 });
    throw e;
  }
  if (!booking) notFound();
  return new Response(buildOwnerIcs(booking), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // inline: iPhone Safari opens the "Add to Calendar" sheet instead of saving a file
      "Content-Disposition": 'inline; filename="booking.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
