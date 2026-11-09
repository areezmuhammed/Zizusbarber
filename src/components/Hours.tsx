import { hhmm, intlPhone } from "@/lib/format";
import { getHours } from "@/lib/shop-data";
import { shopConfig } from "../../shop.config";

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEK = [1, 2, 3, 4, 5, 6, 0]; // UK weeks start on Monday

export async function Hours() {
  const hours = await getHours();
  return (
    <section id="hours" aria-labelledby="hours-h" className="px-5 py-14">
      <div className="mx-auto max-w-2xl">
        <h2 id="hours-h" className="font-heading text-4xl font-semibold">
          Opening hours
        </h2>
        <dl className="mt-8">
          {WEEK.map((d) => {
            const slots = hours.filter((h) => h.weekday === d);
            return (
              <div key={d} className="flex justify-between gap-4 border-b border-border py-3">
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
        <address className="mt-10 not-italic leading-relaxed">
          <span className="block font-heading text-2xl">{shopConfig.name}</span>
          <span className="block text-muted-foreground">{shopConfig.address}</span>
          <a href={`tel:+${intlPhone(shopConfig.phone)}`} className="inline-block py-3 font-mono text-primary">
            {shopConfig.phone}
          </a>
        </address>
      </div>
    </section>
  );
}
