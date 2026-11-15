import Image from "next/image";
import { shopConfig } from "../../../shop.config";

export function ShopIntro() {
  return (
    <section aria-labelledby="shop-h" className="bg-band px-5 py-16">
      <div className="mx-auto grid max-w-[1100px] gap-10 md:grid-cols-2 md:items-center md:gap-14">
        <Image
          src="/images/brand/placeholder-shop.webp"
          alt=""
          width={1120}
          height={1400}
          sizes="(min-width: 768px) 50vw, 100vw"
          className="aspect-[4/5] w-full object-cover"
        />
        <div>
          <p aria-hidden="true" className="text-[11px] tracking-[0.3em] text-primary uppercase">The shop</p>
          <h2 id="shop-h" className="mt-3 font-heading text-3xl">
            The shop
          </h2>
          <p className="mt-6 max-w-prose font-voice text-2xl leading-snug">{shopConfig.intro}</p>
        </div>
      </div>
    </section>
  );
}
