"use client";

import { useState } from "react";
import { hhmm } from "@/lib/format";
import type { Hours, Photo, Service } from "@/lib/shop-data";
import { btn, field, panel } from "./ui";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEK = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const h2 = "font-heading text-2xl";

// Demo of the Basic package's owner page. State lives in this component only: nothing is ever saved.
export function BasicAdmin({ services: s0, hours: h0, photos: p0 }: { services: Service[]; hours: Hours[]; photos: Photo[] }) {
  const [services, setServices] = useState(s0);
  const [hours, setHours] = useState(h0.map((h) => ({ ...h, open_local: hhmm(h.open_local), close_local: hhmm(h.close_local) })));
  const [photos, setPhotos] = useState(p0);

  return (
    <main className="mx-auto grid max-w-2xl gap-10 px-4 pt-6 pb-16">
      <div>
        <h1 className="font-heading text-3xl leading-tight">Your shop</h1>
        <p role="note" className="mt-3 rounded-sm border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
          Demo: changes aren&apos;t saved. Refresh to start again.
        </p>
      </div>

      <section aria-labelledby="prices-h" className="grid gap-3">
        <h2 id="prices-h" className={h2}>Prices</h2>
        {services.map((s, i) => (
          <label key={s.id} className={`${panel} flex items-center justify-between gap-4`}>
            <span className="min-w-0">{s.name}</span>
            <span className="flex shrink-0 items-center gap-1">
              £
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.5}
                value={s.price_pence / 100}
                onChange={(e) =>
                  setServices(services.map((x, j) => (j === i ? { ...x, price_pence: Math.round(Number(e.target.value) * 100) } : x)))
                }
                className={`${field} mt-0 w-24`}
                aria-label={`${s.name} price in pounds`}
              />
            </span>
          </label>
        ))}
      </section>

      <section aria-labelledby="hours-h" className="grid gap-3">
        <h2 id="hours-h" className={h2}>Opening hours</h2>
        {WEEK.map((d) => {
          const slots = hours.map((h, i) => [h, i] as const).filter(([h]) => h.weekday === d);
          return (
            <div key={d} className={`${panel} flex flex-wrap items-center justify-between gap-3`}>
              <span>{DAYS[d]}</span>
              {slots.length === 0 && <span className="text-muted-foreground">Closed</span>}
              {slots.map(([h, i]) => (
                <span key={i} className="flex items-center gap-2">
                  {(["open_local", "close_local"] as const).map((k) => (
                    <input
                      key={k}
                      type="time"
                      value={h[k]}
                      onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))}
                      className={`${field} mt-0 w-28`}
                      aria-label={`${DAYS[d]} ${k === "open_local" ? "opens" : "closes"}`}
                    />
                  ))}
                </span>
              ))}
            </div>
          );
        })}
      </section>

      <section aria-labelledby="gallery-h" className="grid gap-3">
        <h2 id="gallery-h" className={h2}>Gallery</h2>
        {photos.length === 0 && <p className="text-muted-foreground">No photos yet.</p>}
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((p) => (
            <li key={p.id} className="grid gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- same reason as the public Gallery */}
              <img src={p.url} alt={p.alt} loading="lazy" className="aspect-[4/5] w-full object-cover" />
              <button type="button" onClick={() => setPhotos(photos.filter((x) => x.id !== p.id))} className={`${btn} border border-border bg-card`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
