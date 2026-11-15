import { expect, test } from "@playwright/test";
import { shopConfig } from "../shop.config";

test("home renders services from the database", async ({ page, request }) => {
  const res = await request.get(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/services?select=name&active=eq.true`,
    { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! } },
  );
  const services: { name: string }[] = await res.json();
  expect(services.length).toBeGreaterThan(0);
  await page.goto("/");
  const list = page.locator("#services");
  for (const s of services) await expect(list.getByText(s.name, { exact: true })).toBeVisible();
  await expect(list.getByText("£14", { exact: true })).toBeVisible();
});

test("sticky Book bar is visible at 375px", async ({ page }) => {
  await page.goto("/");
  const bar = page.getByRole("navigation", { name: "Quick actions" });
  await expect(bar.getByRole("link", { name: "Book" })).toBeVisible();
  await expect(bar.getByRole("link", { name: "Book" })).toHaveAttribute("href", "/book");
  await page.mouse.wheel(0, 3000);
  await expect(bar).toBeInViewport();
});

test("no horizontal scroll at 320–1280 on / and /book", async ({ page }) => {
  for (const width of [320, 375, 390, 430, 768, 1280]) {
    for (const path of ["/", "/book"]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${path} @${width}`).toBeLessThanOrEqual(0);
    }
  }
});

test("HairSalon JSON-LD present without aggregateRating", async ({ page }) => {
  await page.goto("/");
  const raw = await page.locator('script[type="application/ld+json"]').allTextContents();
  const salon = raw.map((r) => JSON.parse(r)).find((j) => j["@type"] === "HairSalon");
  expect(salon).toBeTruthy();
  expect(salon.name).toBe("Zizu's Barbers");
  expect(salon.telephone).toBe("+447535423544");
  expect(salon.address.streetAddress).toBe("135 Upperthorpe Rd");
  expect(salon.address.postalCode).toBe("S6 3EB");
  expect(salon.openingHoursSpecification.length).toBeGreaterThan(0);
  expect(JSON.stringify(raw)).not.toContain("aggregateRating");
});

test("hero shows the brand, the art-directed photo and a reachable Book button", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(/zizu's barbers/i);
  const img = page.locator("header picture img");
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.currentSrc)).toContain("placeholder-hero-mobile");
  await expect(page.getByRole("link", { name: "Book an appointment" })).toHaveAttribute("href", "/book");
  const address = await page.getByRole("link", { name: /Upperthorpe Rd/ }).boundingBox();
  expect(address!.height).toBeGreaterThanOrEqual(48);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.reload();
  await expect.poll(() => page.locator("header picture img").evaluate((i: HTMLImageElement) => i.currentSrc)).toContain("placeholder-hero-desktop");
});

test("hero Book button sits above the sticky bar on a 375x667 screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");
  const book = await page.getByRole("link", { name: "Book an appointment" }).boundingBox();
  const bar = await page.getByRole("navigation", { name: "Quick actions" }).boundingBox();
  expect(book!.y + book!.height).toBeLessThanOrEqual(bar!.y);
});

test("hero has no layout shift", async ({ page }) => {
  await page.goto("/", { waitUntil: "load" });
  await page.locator("header picture img").evaluate((img: HTMLImageElement) => (img.complete ? null : img.decode()));
  const cls = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let sum = 0;
        const po = new PerformanceObserver((l) => {
          for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) sum += e.value;
        });
        po.observe({ type: "layout-shift", buffered: true });
        setTimeout(() => resolve(sum), 500);
      }),
  );
  expect(cls).toBeLessThan(0.1);
});

test("marquee is decorative and still under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("[data-marquee]")).toHaveAttribute("aria-hidden", "true");
  const name = await page.locator("[data-marquee-track]").evaluate((el) => getComputedStyle(el).animationName);
  expect(name).toBe("none");
});

test("visit-us offers directions and call", async ({ page }) => {
  await page.goto("/");
  const hours = page.locator("#hours");
  await expect(hours.getByRole("heading", { name: "Opening hours" })).toBeVisible();
  const directions = hours.getByRole("link", { name: "Directions" });
  const call = hours.getByRole("link", { name: "Call" });
  await expect(directions).toHaveAttribute("href", shopConfig.mapsUrl);
  await expect(call).toHaveAttribute("href", "tel:+447535423544");
  await expect(hours).toContainText(shopConfig.phone);
  for (const l of [directions, call]) expect((await l.boundingBox())!.height).toBeGreaterThanOrEqual(48);
});

test("footer carries the Instagram link", async ({ page }) => {
  await page.goto("/");
  const ig = page.locator("footer").getByRole("link", { name: "Instagram" });
  await expect(ig).toHaveAttribute("href", shopConfig.sameAs[0]);
  expect((await ig.boundingBox())!.height).toBeGreaterThanOrEqual(48);
});
