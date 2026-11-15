"use client";

import { useState, useTransition } from "react";
import { changeLength, setReminders, setStatus, type Affected, type LengthResult } from "@/app/admin/bookings";
import type { DayBooking } from "@/lib/admin-data";
import { STATUS_LABEL } from "./BookingRow";
import { Sheet } from "./Sheet";
import { btn, field, firstName, panel, range } from "./ui";

const ERRORS: Record<string, string> = {
  forbidden: "Only the shop owner can change bookings.",
  not_found: "This booking was changed or cancelled elsewhere. Close and check the list.",
  taken: "That would overlap another booking. Nothing was changed.",
};
const errorText = (e: string) => ERRORS[e] ?? "That could not be saved. Try again.";

const people = (list: Affected[]) => (
  <ul className="mt-2 grid gap-1">
    {list.map((a) => (
      <li key={a.id} className="tabular-nums">{`${firstName(a.name)} ${range(a.start, a.end)}`}</li>
    ))}
  </ul>
);

export function EditSheet({ booking, onClose }: { booking: DayBooking | null; onClose: () => void }) {
  return (
    <Sheet
      open={!!booking}
      onClose={onClose}
      title={booking ? <>{booking.name}<span className="mt-1 block font-sans text-sm text-muted-foreground">{booking.service}, {range(booking.start, booking.end)}, {STATUS_LABEL[booking.status]}</span></> : ""}
    >
      {booking && <Actions key={booking.id} b={booking} onClose={onClose} />}
    </Sheet>
  );
}

function Actions({ b, onClose }: { b: DayBooking; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Exclude<LengthResult, { error: string }> | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [length, setLength] = useState(String(Math.round((Date.parse(b.end) - Date.parse(b.start)) / 60_000)));
  const [remindersOff, setRemindersOff] = useState(b.remindersOff);
  const active = b.status !== "done" && b.status !== "no_show";

  function status(s: "arrived" | "done" | "no_show" | "cancelled") {
    setError("");
    start(async () => {
      const r = await setStatus({ id: b.id, status: s });
      if ("error" in r) setError(errorText(r.error));
      else onClose();
    });
  }

  function reminders(off: boolean) {
    setError("");
    start(async () => {
      const r = await setReminders({ id: b.id, off });
      if ("error" in r) setError(errorText(r.error));
      else setRemindersOff(off);
    });
  }

  function resize(mode: "add" | "set", minutes: number) {
    setError("");
    setResult(null);
    start(async () => {
      const r = await changeLength({ id: b.id, mode, minutes });
      if ("error" in r) setError(errorText(r.error));
      else setResult(r);
    });
  }

  if (!active)
    return <p className="text-muted-foreground">This booking is finished. Nothing more to do.</p>;

  return (
    <div className="grid gap-6">
      <section aria-label="Status" className="grid grid-cols-3 gap-2">
        {b.status !== "arrived" && (
          <button type="button" disabled={pending} onClick={() => status("arrived")} className={`${btn} bg-primary text-primary-foreground`}>
            Arrived
          </button>
        )}
        <button type="button" disabled={pending} onClick={() => status("done")} className={`${btn} bg-secondary`}>
          Done
        </button>
        <button type="button" disabled={pending} onClick={() => status("no_show")} className={`${btn} bg-secondary`}>
          No-show
        </button>
      </section>

      <section aria-labelledby="len" className={`${panel} grid gap-3`}>
        <h3 id="len" className="font-heading text-xl leading-tight">
          Running over?
          <span className="mt-1 block font-sans text-sm text-muted-foreground">Later bookings move up to make room.</span>
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {[5, 10, 15].map((m) => (
            <button key={m} type="button" disabled={pending} onClick={() => resize("add", m)} className={`${btn} border border-primary/60 font-mono text-primary`}>
              +{m} min
            </button>
          ))}
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(length);
            if (!Number.isInteger(n) || n < 1 || n > 240) return setError("Enter a length from 1 to 240 minutes.");
            resize("set", n);
          }}
        >
          <label className="flex-1 text-sm">
            Length in minutes
            <input type="number" inputMode="numeric" min={1} max={240} required value={length} onChange={(e) => setLength(e.target.value)} className={field} />
          </label>
          <button type="submit" disabled={pending} className={`${btn} border border-border`}>Set length</button>
        </form>
        {result?.ok === true && (
          <div role="status" className="rounded-xl bg-secondary p-3 text-sm">
            Now {range(b.start, result.end)}.{" "}
            {result.moved.length
              ? <>Moved {result.moved.length} {result.moved.length === 1 ? "booking" : "bookings"}, customers see the new time:{people(result.moved)}</>
              : "No other bookings moved."}
          </div>
        )}
        {result?.ok === false && (
          <div role="alert" className="rounded-xl border border-destructive p-3 text-sm">
            Not changed. These bookings would run past closing time, so move or cancel one first:{people(result.conflicts)}
          </div>
        )}
      </section>

      <section aria-label="Reminders" className="grid gap-2">
        <button
          type="button"
          aria-pressed={remindersOff}
          disabled={pending}
          onClick={() => reminders(!remindersOff)}
          className={`${btn} w-full border border-border aria-pressed:border-primary aria-pressed:text-primary`}
        >
          Stop reminders
        </button>
        <p className="text-sm text-muted-foreground">
          {remindersOff
            ? "Reminders are off for this booking. The customer still hears if it changes or is cancelled."
            : "The customer gets reminder messages before this booking."}
        </p>
      </section>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <section aria-label="Cancel">
        {confirming ? (
          <div className="grid gap-2">
            <p className="text-sm">Cancel {firstName(b.name)}&rsquo;s booking? The time becomes free to book.</p>
            <button type="button" disabled={pending} onClick={() => status("cancelled")} className={`${btn} bg-destructive text-white`}>
              Yes, cancel booking
            </button>
            <button type="button" disabled={pending} onClick={() => setConfirming(false)} className={`${btn} border border-border`}>
              Keep it
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className={`${btn} w-full border border-destructive/60 text-destructive`}>
            Cancel booking
          </button>
        )}
      </section>
    </div>
  );
}
