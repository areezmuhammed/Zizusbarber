"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { addBooking } from "@/app/admin/bookings";
import type { AdminService, DayBooking } from "@/lib/admin-data";
import { BookingRow } from "./BookingRow";
import { EditSheet } from "./EditSheet";
import { Sheet } from "./Sheet";
import { btn, field } from "./ui";

const ADD_ERRORS: Record<string, string> = {
  invalid: "Check the name and UK phone number, and pick a start time.",
  taken: "That time overlaps another booking. Pick another time.",
  rejected: "That time is outside opening hours or already past.",
  forbidden: "Only the shop owner can add bookings.",
};

export function DayView({ date, bookings, services, defaultTime }: {
  date: string; bookings: DayBooking[]; services: AdminService[]; defaultTime: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const open = bookings.find((b) => b.id === openId) ?? null; // re-read after each refresh

  return (
    <>
      <button type="button" onClick={() => setAdding(true)} className={`${btn} w-full gap-2 bg-primary text-primary-foreground`}>
        <Plus aria-hidden className="size-5" /> Add booking
      </button>

      {bookings.length ? (
        <ul aria-label="Bookings" className="mt-2">
          {bookings.map((b) => (
            <BookingRow key={b.id} b={b} onOpen={() => setOpenId(b.id)} />
          ))}
        </ul>
      ) : (
        <p className="mt-8 text-center text-muted-foreground">No bookings this day. Add walk-ins and phone bookings above.</p>
      )}

      <EditSheet booking={open} onClose={() => setOpenId(null)} />
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add booking">
        <AddForm date={date} services={services} defaultTime={defaultTime} onDone={() => setAdding(false)} />
      </Sheet>
    </>
  );
}

function AddForm({ date, services, defaultTime, onDone }: {
  date: string; services: AdminService[]; defaultTime: string; onDone: () => void;
}) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError("");
    start(async () => {
      const r = await addBooking({
        serviceId: f.get("serviceId"), date, time: f.get("time"), name: f.get("name"), phone: f.get("phone"),
      });
      if ("error" in r) setError(ADD_ERRORS[r.error] ?? "That booking could not be saved. Try again.");
      else onDone();
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <label className="text-sm">
        Service
        <select name="serviceId" required className={field}>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{`${s.name} (${s.duration_min} min)`}</option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Start time
        <input name="time" type="time" step={300} required defaultValue={defaultTime} className={`${field} tabular-nums`} />
      </label>
      <label className="text-sm">
        Name
        <input name="name" required maxLength={100} autoComplete="off" className={field} />
      </label>
      <label className="text-sm">
        Phone
        <input name="phone" type="tel" required maxLength={30} autoComplete="off" className={field} />
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button type="submit" disabled={pending} className={`${btn} bg-primary text-primary-foreground`}>
        {pending ? "Saving…" : "Save booking"}
      </button>
    </form>
  );
}
