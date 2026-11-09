import { getStatus } from "@/lib/shop-data";
import { LiveStatus } from "./LiveStatus";

export async function StatusBadge() {
  const s = await getStatus();
  return s ? <LiveStatus initial={s} /> : null;
}

export function StatusBadgeFallback() {
  return <span className="block h-[38px] w-40 rounded-full border border-border bg-card" aria-hidden />;
}
