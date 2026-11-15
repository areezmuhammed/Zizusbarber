import Image from "next/image";
import { shopConfig, type Barber } from "../../../shop.config";

export function BarberCard({ barber = shopConfig.barber }: { barber?: Barber | null }) {
  if (!barber) return null;
  return (
    <section aria-labelledby="barber-h" className="bg-background px-5 py-16">
      <div className="relative mx-auto aspect-[4/5] max-w-sm overflow-hidden md:max-w-[33%]">
        <Image
          src={barber.photo}
          alt={barber.alt}
          width={barber.width}
          height={barber.height}
          sizes="(min-width: 768px) 33vw, 100vw"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-5 pt-16">
          <h2 id="barber-h" className="font-heading text-2xl">
            {barber.name}
          </h2>
        </div>
      </div>
    </section>
  );
}
