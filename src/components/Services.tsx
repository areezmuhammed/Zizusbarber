import Image from "next/image";
import { formatPrice } from "@/lib/format";
import { getServices } from "@/lib/shop-data";

export async function Services() {
  const services = await getServices();
  return (
    <section id="services" aria-labelledby="services-h" className="bg-background px-5 py-16">
      <div className="mx-auto grid max-w-[1100px] gap-10 md:grid-cols-2 md:items-center md:gap-14">
        <Image
          src="/images/brand/placeholder-menu.webp"
          alt=""
          width={1536}
          height={1024}
          sizes="(min-width: 768px) 50vw, 100vw"
          className="aspect-[3/2] w-full object-cover"
        />
        <div>
          <p className="text-[11px] tracking-[0.3em] text-primary uppercase">The menu</p>
          <h2 id="services-h" className="mt-3 font-heading text-3xl">
            Prices
          </h2>
          <ul className="mt-6">
            {services.map((s) => (
              <li key={s.id} className="flex items-baseline justify-between gap-4 border-b border-primary/20 py-4">
                <div className="min-w-0 text-[1.0625rem]">
                  <span>{s.name}</span>
                  <p className="text-xs text-muted-foreground">{s.duration_min} min</p>
                </div>
                <span className="shrink-0 font-voice text-2xl text-primary">{formatPrice(s.price_pence)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
