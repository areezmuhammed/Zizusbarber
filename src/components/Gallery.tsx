import { getGallery } from "@/lib/shop-data";

export async function Gallery() {
  const photos = await getGallery();
  return (
    <section id="gallery" aria-labelledby="gallery-h" className="bg-background px-5 py-16">
      <div className="mx-auto max-w-[1100px]">
        <p className="text-[11px] tracking-[0.3em] text-primary uppercase">The work</p>
        <h2 id="gallery-h" className="mt-3 font-heading text-3xl">
          Recent work
        </h2>
        {photos.length === 0 ? (
          <p className="mt-8 rounded-sm border border-dashed border-primary/30 px-5 py-10 text-center text-muted-foreground">
            No photos yet. Fresh cuts from the chair will show up here soon.
          </p>
        ) : (
          <ul className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((p) => (
              <li key={p.id} className="aspect-[4/5] overflow-hidden border border-primary/20 bg-band">
                {/* plain img: the Storage host differs per deployment, so next/image remotePatterns would need per-shop config */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.alt} loading="lazy" decoding="async" className="size-full object-cover" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
