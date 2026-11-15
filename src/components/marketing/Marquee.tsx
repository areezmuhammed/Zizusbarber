import { marqueeText } from "@/lib/format";
import { getServices } from "@/lib/shop-data";

export async function Marquee() {
  const text = marqueeText((await getServices()).map((s) => s.name));
  if (!text) return null;
  // The track holds the text twice, so translating -50% loops seamlessly.
  return (
    <div data-marquee aria-hidden="true" className="overflow-hidden border-y border-primary/25 bg-band py-3">
      <div data-marquee-track className="flex w-max motion-safe:animate-[marquee_40s_linear_infinite]">
        {[0, 1].map((i) => (
          <span key={i} className="font-heading text-sm tracking-[0.2em] whitespace-nowrap text-primary/90 pr-8">
            {`${text} · ${text}`}
            <span className="pl-8">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}
