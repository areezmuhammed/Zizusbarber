import { formatPrice } from "@/lib/format";
import { getServices } from "@/lib/shop-data";

export async function Services() {
  const services = await getServices();
  return (
    <section id="services" aria-labelledby="services-h" className="px-5 py-14">
      <div className="mx-auto max-w-2xl">
        <h2 id="services-h" className="font-heading text-4xl font-semibold">
          Prices
        </h2>
        <ul className="mt-8">
          {services.map((s) => (
            <li key={s.id} className="border-b border-border py-4 first:border-t">
              <div className="flex items-baseline gap-3">
                <span className="text-[1.0625rem]">{s.name}</span>
                <span className="mb-1 min-w-4 flex-1 border-b border-dotted border-primary/40" aria-hidden />
                <span className="font-mono text-lg text-primary">{formatPrice(s.price_pence)}</span>
              </div>
              <span className="font-mono text-xs text-muted-foreground">{s.duration_min} min</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
