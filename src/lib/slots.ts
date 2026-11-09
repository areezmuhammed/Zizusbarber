import { londonToUtc } from "./time";

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function generateSlots(input: {
  date: string;
  openLocal: string;
  closeLocal: string;
  durationMin: number;
  stepMin: number;
  busy: { start: Date; end: Date }[];
  closed: boolean;
  now: Date;
}): Date[] {
  if (input.closed) return [];
  const out: Date[] = []; // stepping distinct local times never repeats an instant, so no dedupe needed
  const close = toMin(input.closeLocal);
  // Step local wall-clock minutes (not fixed ms) so DST days stay correct.
  for (let m = toMin(input.openLocal); m + input.durationMin <= close; m += input.stepMin) {
    const start = londonToUtc(input.date, hhmm(m));
    if (!start || start < input.now) continue;
    const end = new Date(start.getTime() + input.durationMin * 60000);
    if (input.busy.some((b) => start < b.end && b.start < end)) continue;
    out.push(start);
  }
  return out;
}
