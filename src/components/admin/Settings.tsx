"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { DateTime } from "luxon";
import { useState, useTransition } from "react";
import { addClosure, deleteClosure, deleteService, moveService, saveHours, saveService, type SettingsResult } from "@/app/admin/settings";
import type { SettingsClosure, SettingsHours, SettingsService } from "@/lib/admin-data";
import { formatPrice, hhmm } from "@/lib/format";
import { MAX_NAME, MAX_REASON } from "@/lib/settings-form";
import { btn, field } from "./ui";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEK = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const ERRORS: Record<string, string> = {
  forbidden: "Only the shop owner can change settings.",
  in_use: "This service has bookings, so it can't be deleted. Untick “Show on the website” to hide it instead.",
  exists: "That date already has a closure. Delete it first to change it.",
  failed: "Could not save. Try again.",
};
const primary = `${btn} bg-primary text-primary-foreground`;
const quiet = `${btn} border border-border bg-card`;
const label = "block text-sm text-muted-foreground";
const h2 = "font-heading text-2xl";

// One pending flag and one message per form; `invalid` gets the form's own hint.
function useSave(invalid: string) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (p: () => Promise<SettingsResult>, okText: string, after?: () => void) =>
    start(async () => {
      const r = await p();
      if ("error" in r) return setMsg({ ok: false, text: r.error === "invalid" ? invalid : ERRORS[r.error] });
      setMsg({ ok: true, text: okText });
      after?.();
    });
  const out = (
    <p role="status" className={`min-h-6 text-sm ${msg?.ok ? "text-primary" : "text-destructive"}`}>
      {msg?.text}
    </p>
  );
  return { pending, run, out };
}

export function Settings({ services, hours, closures, today }: {
  services: SettingsService[]; hours: SettingsHours[]; closures: SettingsClosure[]; today: string;
}) {
  return (
    <div className="grid gap-10">
      <h1 className="font-heading text-3xl leading-tight">Settings</h1>
      <Services services={services} />
      <Hours hours={hours} />
      <Closures closures={closures} today={today} />
    </div>
  );
}

function Services({ services }: { services: SettingsService[] }) {
  const { pending, run, out } = useSave("Could not move that service.");
  return (
    <section aria-labelledby="svc-h" className="grid gap-3">
      <h2 id="svc-h" className={h2}>Services</h2>
      <p className="text-sm text-muted-foreground">Order here is the order on the website. Hidden services can’t be booked.</p>
      <ul aria-label="Services" className="grid gap-2">
        {services.map((s, i) => (
          <li key={s.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg">{s.name}</p>
                <p className="font-mono text-sm text-muted-foreground lining-nums">
                  {formatPrice(s.price_pence)}, {s.duration_min} min{s.active ? "" : ", hidden"}
                </p>
              </div>
              <button type="button" aria-label={`Move ${s.name} up`} disabled={pending || i === 0}
                onClick={() => run(() => moveService({ id: s.id, dir: -1 }), "Order saved.")} className={`${quiet} size-12 px-0`}>
                <ChevronUp aria-hidden className="size-5" />
              </button>
              <button type="button" aria-label={`Move ${s.name} down`} disabled={pending || i === services.length - 1}
                onClick={() => run(() => moveService({ id: s.id, dir: 1 }), "Order saved.")} className={`${quiet} size-12 px-0`}>
                <ChevronDown aria-hidden className="size-5" />
              </button>
            </div>
            <details className="mt-2">
              <summary className="flex min-h-12 cursor-pointer items-center text-primary">Edit {s.name}</summary>
              <ServiceForm s={s} />
            </details>
          </li>
        ))}
      </ul>
      {out}
      <details className="rounded-xl border border-dashed border-border p-3">
        <summary className="flex min-h-12 cursor-pointer items-center text-primary">Add a service</summary>
        <ServiceForm />
      </details>
    </section>
  );
}

function ServiceForm({ s }: { s?: SettingsService }) {
  const { pending, run, out } = useSave(
    `Check the details: a name up to ${MAX_NAME} characters, a price in pounds like 14 or 14.50, and 5 to 240 minutes.`,
  );
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const input = {
      id: s?.id,
      name: String(f.get("name")),
      price: String(f.get("price")),
      duration: Number(f.get("duration")),
      active: f.get("active") === "on",
    };
    run(() => saveService(input), s ? "Saved." : "Service added.", () => s || form.reset());
  }
  return (
    <form onSubmit={submit} className="mt-2 grid gap-3">
      <label className={label}>
        Name
        <input name="name" required maxLength={MAX_NAME} defaultValue={s?.name} className={field} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          Price (£)
          <input name="price" required inputMode="decimal" pattern="£?\d{1,4}(\.\d{1,2})?" placeholder="14.50"
            defaultValue={s ? (s.price_pence / 100).toFixed(s.price_pence % 100 ? 2 : 0) : ""} className={`${field} font-mono`} />
        </label>
        <label className={label}>
          Minutes
          <input name="duration" type="number" required min={5} max={240} step={1} inputMode="numeric"
            defaultValue={s?.duration_min ?? 30} className={`${field} font-mono`} />
        </label>
      </div>
      <label className="flex min-h-12 items-center gap-3">
        <input name="active" type="checkbox" defaultChecked={s?.active ?? true} className="size-6 accent-primary" />
        Show on the website
      </label>
      <button disabled={pending} className={primary}>{s ? "Save service" : "Add service"}</button>
      {s && (
        <button type="button" disabled={pending} onClick={() => run(() => deleteService(s.id), "Deleted.")}
          className={`${quiet} text-destructive`}>
          Delete service
        </button>
      )}
      {out}
    </form>
  );
}

function Hours({ hours }: { hours: SettingsHours[] }) {
  return (
    <section aria-labelledby="hrs-h" className="grid gap-3">
      <h2 id="hrs-h" className={h2}>Opening hours</h2>
      <p className="text-sm text-muted-foreground">UK local time. Changes apply to new bookings; existing ones stay put.</p>
      {WEEK.map((d) => {
        const h = hours.find((x) => x.weekday === d);
        return <DayHours key={d} weekday={d} h={h} />;
      })}
    </section>
  );
}

function DayHours({ weekday, h }: { weekday: number; h?: SettingsHours }) {
  const [open, setOpen] = useState(!!h);
  const { pending, run, out } = useSave("Closing time must be after opening time, on a 5-minute mark.");
  const day = DAYS[weekday];
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(() => saveHours({ weekday, closed: !open, open: f.get("open"), close: f.get("close") }), `${day} saved.`);
  }
  return (
    <form onSubmit={submit} aria-label={day} className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-lg">{day}</span>
        <label className="flex min-h-12 items-center gap-3">
          <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} className="size-6 accent-primary" />
          Open
        </label>
      </div>
      {open && (
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            Opens
            <input name="open" type="time" step={300} required defaultValue={h ? hhmm(h.open_local) : "09:30"} className={`${field} font-mono`} />
          </label>
          <label className={label}>
            Closes
            <input name="close" type="time" step={300} required defaultValue={h ? hhmm(h.close_local) : "20:00"} className={`${field} font-mono`} />
          </label>
        </div>
      )}
      <button disabled={pending} className={`${quiet} mt-3 w-full`}>Save {day}</button>
      {out}
    </form>
  );
}

function Closures({ closures, today }: { closures: SettingsClosure[]; today: string }) {
  const [special, setSpecial] = useState(false);
  const add = useSave(`Pick today or a later date, a reason up to ${MAX_REASON} characters, and closing after opening.`);
  const del = useSave("Could not delete that closure.");
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const input = { date: f.get("date"), reason: String(f.get("reason") ?? ""), closed: !special, open: f.get("open"), close: f.get("close") };
    add.run(() => addClosure(input), "Closure added.", () => form.reset());
  }
  return (
    <section aria-labelledby="cls-h" className="grid gap-3">
      <h2 id="cls-h" className={h2}>Closures and holidays</h2>
      <p className="text-sm text-muted-foreground">No online bookings on a closed day. Bank holidays are not added for you.</p>
      {closures.length ? (
        <ul aria-label="Upcoming closures" className="grid gap-2">
          {closures.map((c) => {
            const when = DateTime.fromISO(c.date).setLocale("en-GB").toFormat("ccc d LLL yyyy");
            return (
              <li key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <div className="min-w-0 flex-1">
                  <p className="lining-nums">{when}</p>
                  <p className="text-sm text-muted-foreground">
                    {c.open_local && c.close_local ? `Open ${hhmm(c.open_local)}–${hhmm(c.close_local)}` : "Closed all day"}
                    {c.reason ? `, ${c.reason}` : ""}
                  </p>
                </div>
                <button type="button" disabled={del.pending} aria-label={`Delete closure on ${when}`}
                  onClick={() => del.run(() => deleteClosure(c.id), "Closure deleted.")} className={`${quiet} text-destructive`}>
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted-foreground">No closures coming up.</p>
      )}
      {del.out}
      <form onSubmit={submit} aria-label="Add a closure" className="grid gap-3 rounded-xl border border-dashed border-border p-3">
        <label className={label}>
          Date
          <input name="date" type="date" required min={today} className={`${field} font-mono`} />
        </label>
        <label className={label}>
          Reason (optional)
          <input name="reason" maxLength={MAX_REASON} placeholder="Christmas Day" className={field} />
        </label>
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="sr-only">Hours that day</legend>
          {([[false, "Closed all day"], [true, "Special hours"]] as const).map(([v, text]) => (
            <label key={text} className={`${btn} border text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${special === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
              <input type="radio" name="kind" checked={special === v} onChange={() => setSpecial(v)} className="sr-only" />
              {text}
            </label>
          ))}
        </fieldset>
        {special && (
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              Opens
              <input name="open" type="time" step={300} required defaultValue="10:00" className={`${field} font-mono`} />
            </label>
            <label className={label}>
              Closes
              <input name="close" type="time" step={300} required defaultValue="16:00" className={`${field} font-mono`} />
            </label>
          </div>
        )}
        <button disabled={add.pending} className={primary}>Add closure</button>
        {add.out}
      </form>
    </section>
  );
}
