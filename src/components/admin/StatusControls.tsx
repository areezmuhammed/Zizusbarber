"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { bumpCount, saveStatus } from "@/app/admin/status";
import type { Closure } from "@/lib/booking-form";
import { effectiveStatus, londonDate } from "@/lib/open-now";
import type { Hours, Status } from "@/lib/shop-data";
import { MAX_NOTE } from "@/lib/status-form";
import { useNow } from "@/lib/use-now";
import { btn, field, panel } from "./ui";

const STATES = [
  ["auto", "Automatic"],
  ["open", "Open"],
  ["busy", "Busy"],
  ["closed", "Closed"],
] as const;
const COUNTERS = [
  ["in_shop", "In shop"],
  ["waiting", "Waiting"],
] as const;
// own classes rather than btn: btn's rounded-xl would fight rounded-sm
const step =
  "grid size-16 shrink-0 place-items-center rounded-sm border bg-background disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const LABEL = { open: "Open", busy: "Busy", closed: "Closed" } as const;

export function StatusControls({ initial, hours, closures, now }: { initial: Status; hours: Hours[]; closures: Closure[]; now: number }) {
  const [s, setS] = useState(initial);
  const at = useNow(now);
  const auto = effectiveStatus({ ...s, manual_date: null }, hours, closures, at);
  const chosen = s.manual_date === londonDate(at) ? s.state : "auto";
  const [note, setNote] = useState(initial.note ?? "");
  const [err, setErr] = useState("");

  async function run(p: ReturnType<typeof bumpCount>) {
    const r = await p;
    if ("error" in r) return setErr(r.error === "forbidden" ? "Not allowed." : "Could not save. Try again.");
    setErr("");
    setS(r.status);
  }
  // buttons stay enabled while a request is pending: every tap is its own delta in SQL
  const bump = (key: "in_shop" | "waiting", delta: 1 | -1) => run(bumpCount({ field: key, delta }));
  // a state tap sends only the state, "Save note" only the note: neither can overwrite the other with a stale copy
  const saveState = (state: Status["state"] | "auto") => run(saveStatus({ state }));

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-heading text-3xl leading-tight">Shop status</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <span aria-hidden className="relative flex size-2.5">
            <span className="absolute inset-0 rounded-full bg-primary motion-safe:animate-ping motion-safe:opacity-60" />
            <span className="relative size-2.5 rounded-full bg-primary" />
          </span>
          Changes show on your website straight away
        </p>
      </div>
      <fieldset className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <legend className="sr-only">Shop state</legend>
        {STATES.map(([v, label]) => (
          <label
            key={v}
            className={`${btn} border has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${chosen === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
          >
            <input type="radio" name="state" value={v} checked={chosen === v} onChange={() => saveState(v)} className="sr-only" />
            {label}
          </label>
        ))}
        <p data-testid="state-hint" className="col-span-full text-sm text-muted-foreground">
          {chosen === "auto"
            ? `Following your opening hours: ${LABEL[auto.state]} now${auto.next ? `, ${auto.next}` : ""}.`
            : "Your choice shows until midnight, then the site goes back to your opening hours."}
        </p>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        {COUNTERS.map(([key, label]) => (
          <div key={key} role="group" aria-labelledby={`c-${key}`} className={`${panel} grid gap-3`}>
            <span id={`c-${key}`} className="text-lg">{label}</span>
            <div className="flex items-center justify-between gap-3">
              <button type="button" aria-label={`${label} minus one`} onClick={() => bump(key, -1)} className={`${step} border-border`}>
                <Minus aria-hidden className="size-7" />
              </button>
              <output aria-live="polite" data-testid={`count-${key}`} className="min-w-[2ch] text-center font-heading text-7xl leading-none tabular-nums lining-nums">
                {s[key]}
              </output>
              <button type="button" aria-label={`${label} plus one`} onClick={() => bump(key, 1)} className={`${step} border-primary/60 text-primary`}>
                <Plus aria-hidden className="size-7" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(saveStatus({ note }));
        }}
      >
        <label className="block text-sm text-muted-foreground">
          Note (optional)
          <input value={note} maxLength={MAX_NOTE} onChange={(e) => setNote(e.target.value)} className={field} />
        </label>
        <button className={`${btn} mt-3 w-full bg-primary text-primary-foreground`}>Save note</button>
      </form>
      <p role="alert" className="min-h-6 text-sm text-destructive">{err}</p>
    </div>
  );
}
