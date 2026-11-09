import { getGallery } from "@/lib/shop-data";

export async function Gallery() {
  const photos = await getGallery();
  return (
    <section id="gallery" aria-labelledby="gallery-h" className="bg-card px-5 py-14">
      <div className="mx-auto max-w-2xl">
        <h2 id="gallery-h" className="font-heading text-4xl font-semibold">
          Recent work
        </h2>
        {photos.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-border px-5 py-10 text-center text-muted-foreground">
            No photos yet. Fresh cuts from the chair will show up here soon.
          </p>
        ) : (
          <ul className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((p) => (
              <li key={p.id} className="aspect-[4/5] overflow-hidden rounded-md bg-background">
                {/* plain img: the Storage host differs per deployment, so next/image remotePatterns would need per-shop config */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.alt} loading="lazy" className="size-full object-cover" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
