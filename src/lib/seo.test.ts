import { describe, expect, it } from "vitest";
import { shopConfig } from "../../shop.config";
import { buildSalonJsonLd, priceRange } from "./seo";
import { OLD_URLS, redirects } from "./redirects";

const svc = (price_pence: number) => ({ id: "x", name: "s", price_pence, duration_min: 30 });

describe("priceRange", () => {
  it("spans the cheapest to the dearest service", () => {
    expect(priceRange([svc(1400), svc(500), svc(2000)])).toBe("£5-£20");
    expect(priceRange([svc(750), svc(1250)])).toBe("£7.50-£12.50");
  });
  it("single price and empty list", () => {
    expect(priceRange([svc(800)])).toBe("£8");
    expect(priceRange([])).toBeUndefined();
  });
});

describe("buildSalonJsonLd", () => {
  const ld = buildSalonJsonLd([{ weekday: 2, open_local: "09:30:00", close_local: "20:00:00" }], [svc(500), svc(2000)]);
  it("has priceRange, absolute urls, sameAs and map, never a rating", () => {
    expect(ld.priceRange).toBe("£5-£20");
    expect(ld.url).toBe(shopConfig.url);
    expect(ld.image).toMatch(/^https:\/\/.+\/opengraph-image/);
    expect(ld.sameAs).toContain("https://www.instagram.com/zizusbarbers");
    expect(ld.hasMap).toBe(shopConfig.mapsUrl);
    expect(JSON.stringify(ld)).not.toContain("aggregateRating");
    expect(ld.openingHoursSpecification[0]).toMatchObject({ dayOfWeek: "https://schema.org/Tuesday", opens: "09:30", closes: "20:00" });
    expect(ld.address).toMatchObject({ streetAddress: "135 Upperthorpe Rd", addressLocality: "Sheffield", postalCode: "S6 3EB" });
  });
});

describe("redirects", () => {
  it("are permanent, start with / and never shadow the real booking page", () => {
    const list = redirects();
    expect(list.length).toBe(OLD_URLS.length);
    for (const r of list) {
      expect(r).toEqual({ source: expect.stringMatching(/^\//), destination: expect.stringMatching(/^\//), permanent: true });
      expect(r.source).not.toBe("/book");
      expect(r.source).not.toMatch(/^\/booking\/:/);
    }
    expect(list).toContainEqual({ source: "/gallery", destination: "/#gallery", permanent: true });
    expect(list).toContainEqual({ source: "/booking", destination: "/book", permanent: true });
  });
});
