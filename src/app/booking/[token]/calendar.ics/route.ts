import { notFound } from "next/navigation";
import { buildIcs, getBookingByToken } from "@/lib/customer-booking";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const booking = await getBookingByToken(token);
  if (!booking) notFound();
  return new Response(buildIcs(token, booking), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="appointment.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
