import { connection } from "next/server";
import { londonDate } from "@/lib/open-now";
import { getClosures, getHours, getStatus } from "@/lib/shop-data";
import { LiveStatus } from "./LiveStatus";

export async function StatusBadge() {
  await connection(); // open or closed depends on the request's time
  const now = new Date().getTime();
  const [s, hours, closures] = await Promise.all([getStatus(), getHours(), getClosures(londonDate(new Date(now)))]);
  return s ? <LiveStatus initial={s} hours={hours} closures={closures} now={now} /> : null;
}

export function StatusBadgeFallback() {
  return <span className="block h-[38px] w-40 rounded-sm border border-border bg-card" aria-hidden />;
}
