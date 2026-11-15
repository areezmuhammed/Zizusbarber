import { expect, test } from "@playwright/test";

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
