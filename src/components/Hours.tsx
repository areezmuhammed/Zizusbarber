import { DateTime } from "luxon";
import Image from "next/image";
import { connection } from "next/server";
import { Suspense } from "react";
import { hhmm, intlPhone } from "@/lib/format";
import { getClosures, getHours } from "@/lib/shop-data";
import { utcToLondon } from "@/lib/time";
import { shopConfig } from "../../shop.config";

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEK = [1, 2, 3, 4, 5, 6, 0]; // UK weeks start on Monday

export async function Hours() {
  const hours = await getHours();
  return (
    <section id="hours" aria-labelledby="hours-h" className="bg-band px-5 py-16">
      <div className="mx-auto grid max-w-[1100px] gap-10 md:grid-cols-2 md:gap-14">
        <div>
          <p className="text-[11px] tracking-[0.3em] text-primary uppercase">Visit</p>
          <h2 id="hours-h" className="mt-3 font-heading text-3xl">
            Opening hours
          </h2>
          <dl className="mt-6">
            {WEEK.map((d) => {
              const slots = hours.filter((h) => h.weekday === d);
              return (
                <div key={d} className="flex justify-between gap-4 border-b border-primary/20 py-3">
                  <dt>{DAYS[d]}</dt>
                  <dd className={`font-mono text-sm ${slots.length ? "" : "text-muted-foreground"}`}>
                    {slots.length
                      ? slots.map((h) => `${hhmm(h.open_local)}–${hhmm(h.close_local)}`).join(", ")
                      : "Closed"}
                  </dd>
                </div>
              );
            })}
          </dl>
          <p className="mt-3 text-sm text-muted-foreground">Times are UK local time.</p>
          <Suspense>
            <Closures />
          </Suspense>
        </div>
        <div>
          <Image
            src="/images/brand/placeholder-visit.webp"
            alt=""
            width={1536}
            height={1024}
            sizes="(min-width: 768px) 50vw, 100vw"
            className="aspect-[3/2] w-full object-cover"
          />
          <address className="mt-6 not-italic leading-relaxed">
            <span className="block font-heading text-2xl">{shopConfig.name}</span>
            <span className="block text-muted-foreground">{shopConfig.address}</span>
            <span className="block font-mono text-sm">{shopConfig.phone}</span>
          </address>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={shopConfig.mapsUrl}
              className="inline-flex min-h-12 items-center rounded-sm bg-primary px-6 text-sm font-semibold tracking-wide text-primary-foreground uppercase"
            >
              Directions
            </a>
            <a
              href={`tel:+${intlPhone(shopConfig.phone)}`}
              className="inline-flex min-h-12 items-center rounded-sm border border-primary px-6 text-sm font-semibold tracking-wide text-primary uppercase"
            >
              Call
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// Upcoming closures and special hours; "today" is per request, so this streams in after the static shell.
async function Closures() {
  await connection();
  const closures = (await getClosures(utcToLondon(new Date()).toISODate()!)).slice(0, 6);
  if (!closures.length) return null;
  return (
    <div className="mt-8">
      <h3 className="font-heading text-2xl">Holidays and changes</h3>
      <ul aria-label="Upcoming closures" className="mt-3">
        {closures.map((c) => (
          <li key={c.date} className="flex justify-between gap-4 border-b border-primary/20 py-3">
            <span>
              {DateTime.fromISO(c.date).setLocale("en-GB").toFormat("ccc d LLL")}
              {c.reason && <span className="block text-sm text-muted-foreground">{c.reason}</span>}
            </span>
            <span className="font-mono text-sm">
              {c.open_local && c.close_local ? `${hhmm(c.open_local)}–${hhmm(c.close_local)}` : "Closed"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
