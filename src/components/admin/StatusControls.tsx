"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { bumpCount, saveStatus } from "@/app/admin/status";
import type { Status } from "@/lib/shop-data";
import { MAX_NOTE } from "@/lib/status-form";
import { btn, field } from "./ui";

const STATES = [
  ["open", "Open"],
  ["busy", "Busy"],
  ["closed", "Closed"],
] as const;
const COUNTERS = [
  ["in_shop", "In shop"],
  ["waiting", "Waiting"],
] as const;
const step = `${btn} size-16 border border-border bg-card`;

export function StatusControls({ initial }: { initial: Status }) {
  const [s, setS] = useState(initial);
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
  // a state tap re-saves the stored note, never unsaved draft text; "Save note" saves the draft
  const save = (state: Status["state"], n: string) => run(saveStatus({ state, note: n }));

  return (
    <div className="grid gap-6">
      <h1 className="font-heading text-3xl leading-tight">Shop status</h1>
      <fieldset className="grid grid-cols-3 gap-2">
        <legend className="sr-only">Shop state</legend>
        {STATES.map(([v, label]) => (
          <label
            key={v}
            className={`${btn} border has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${s.state === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
          >
            <input type="radio" name="state" value={v} checked={s.state === v} onChange={() => save(v, s.note ?? "")} className="sr-only" />
            {label}
          </label>
        ))}
      </fieldset>
      {COUNTERS.map(([key, label]) => (
        <div key={key} className="flex items-center justify-between gap-3">
          <span id={`c-${key}`} className="text-lg">{label}</span>
          <div className="flex items-center gap-4" role="group" aria-labelledby={`c-${key}`}>
            <button type="button" aria-label={`${label} minus one`} onClick={() => bump(key, -1)} className={step}>
              <Minus aria-hidden className="size-6" />
            </button>
            <output aria-live="polite" data-testid={`count-${key}`} className="w-12 text-center font-mono text-3xl lining-nums">
              {s[key]}
            </output>
            <button type="button" aria-label={`${label} plus one`} onClick={() => bump(key, 1)} className={step}>
              <Plus aria-hidden className="size-6" />
            </button>
          </div>
        </div>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save(s.state, note);
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
