import { dayHours, type Closure } from "./booking-form";
import type { Hours, Status } from "./shop-data";
import { londonToUtc, utcToLondon } from "./time";

export type Effective = { state: Status["state"]; auto: boolean; next: string | null };

export const londonDate = (now: Date) => utcToLondon(now).toISODate()!;

// What the public sees: the owner's choice on the day it was made, otherwise opening hours (closures included).
export function effectiveStatus(row: Pick<Status, "state" | "manual_date">, hours: Hours[], closures: Closure[], now: Date): Effective {
  const today = londonDate(now);
  if (row.manual_date === today) return { state: row.state, auto: false, next: null };

  const h = dayHours(today, hours, closures);
  const open = h && londonToUtc(today, h.open);
  const close = h && londonToUtc(today, h.close);
  if (open && close && now >= open && now < close) return { state: "open", auto: true, next: `closes ${h.close}` };
  if (open && now < open) return { state: "closed", auto: true, next: `opens ${h.open}` };

  const start = utcToLondon(now).startOf("day");
  for (let i = 1; i <= 14; i++) {
    const day = start.plus({ days: i });
    const d = dayHours(day.toISODate()!, hours, closures);
    if (d) return { state: "closed", auto: true, next: `opens ${i === 1 ? "tomorrow" : day.toFormat("ccc")} ${d.open}` };
  }
  return { state: "closed", auto: true, next: null };
}
