import { CalendarPlus, Phone } from "lucide-react";
import type { DayBooking } from "@/lib/admin-data";
import { nationalPhone } from "@/lib/format";
import { firstName, time } from "./ui";

export const STATUS_LABEL: Record<DayBooking["status"], string> = {
  pending: "Pending",
  confirmed: "Booked",
  arrived: "Arrived",
  done: "Done",
  no_show: "No-show",
};

const CHIP: Record<DayBooking["status"], string> = {
  pending: "border border-dashed border-muted-foreground bg-muted text-muted-foreground",
  confirmed: "bg-primary/15 text-primary",
  arrived: "bg-primary text-primary-foreground",
  done: "bg-muted text-muted-foreground",
  no_show: "border border-destructive bg-destructive/10 text-destructive",
};

export function BookingRow({ b, onOpen }: { b: DayBooking; onOpen: () => void }) {
  const first = firstName(b.name);
  const finished = b.status === "done" || b.status === "no_show";
  const phone = nationalPhone(b.phone);
  return (
    <li
      className={`rounded-sm border px-4 ${
        finished
          ? "border-border/60 bg-card"
          : b.status === "arrived"
            ? "border-primary/70 bg-card shadow-[inset_4px_0_0_var(--color-primary)]"
            : "border-border bg-card"
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${first}, ${b.service}, ${time(b.start)} to ${time(b.end)}, ${STATUS_LABEL[b.status]}`}
        className="grid w-full grid-cols-[4.75rem_1fr_auto] items-start gap-x-3 pt-4 pb-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className={`font-heading text-[2rem] leading-none tabular-nums lining-nums ${finished ? "text-muted-foreground" : ""}`}>
          {time(b.start)}
          <span className="mt-1 block font-sans text-xs normal-case tracking-normal text-muted-foreground">to {time(b.end)}</span>
        </span>
        <span className="min-w-0 pt-0.5">
          <span className={`block truncate text-lg font-medium ${finished ? "text-muted-foreground" : ""}`}>{first}</span>
          <span className="block truncate text-sm text-muted-foreground">{b.service}</span>
        </span>
        <span className={`mt-1 rounded-sm px-2.5 py-1 text-xs font-medium ${CHIP[b.status]}`}>{STATUS_LABEL[b.status]}</span>
      </button>
      <div className="mb-2 ml-[5.5rem] flex flex-wrap gap-x-4">
        <a
          href={`tel:${b.phone}`}
          aria-label={`Call ${first} on ${phone}`}
          className="inline-flex min-h-12 items-center gap-2 rounded-sm pr-3 text-sm tabular-nums text-primary focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Phone aria-hidden className="size-4" />
          {phone}
        </a>
        {/* After a time change, tapping again sends a newer copy of the same event */}
        <a
          href={`/admin/bookings/${b.id}/calendar.ics`}
          aria-label={`Add ${first}'s booking to calendar`}
          className="inline-flex min-h-12 items-center gap-2 rounded-sm pr-3 text-sm text-primary focus-visible:outline-2 focus-visible:outline-primary"
        >
          <CalendarPlus aria-hidden className="size-4" />
          Calendar
        </a>
      </div>
    </li>
  );
}
