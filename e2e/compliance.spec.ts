import { expect, test } from "@playwright/test";

const API = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const PHONE = `+4477009${String(Date.now()).slice(-5)}`; // unique per run

const ids: string[] = [];

async function cleanup() {
  // by id: erased rows no longer carry the phone
  const q = ids.length ? `id=in.(${ids.join(",")})` : `phone=eq.${encodeURIComponent(PHONE)}`;
  const res = await fetch(`${API}/rest/v1/bookings?${q}`, { method: "DELETE", headers: admin });
  expect(res.ok).toBe(true);
}
test.beforeAll(cleanup);
test.afterAll(cleanup);

async function insert(start: Date) {
  const sv = await (await fetch(`${API}/rest/v1/services?select=id&name=eq.Hair%20Cut`, { headers: admin })).json();
  const res = await fetch(`${API}/rest/v1/bookings`, {
    method: "POST",
    headers: { ...admin, Prefer: "return=representation" },
    body: JSON.stringify({
      barber_id: "00000000-0000-0000-0000-000000000001", service_id: sv[0].id, customer_name: "E2E Erase", phone: PHONE,
      email: "erase@example.test", start_at: start.toISOString(), end_at: new Date(+start + 30 * 60000).toISOString(), status: "confirmed",
    }),
  });
  expect(res.ok).toBe(true);
  const [row] = (await res.json()) as { id: string; cancel_token: string }[];
  ids.push(row.id);
  return row;
}

for (const [path, heading] of [["/privacy", "Privacy notice"], ["/cookies", "Cookie notice"]] as const) {
  test(`${path} renders with headings and footer links`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    expect(await page.getByRole("heading", { level: 2 }).count()).toBeGreaterThan(2);
    const legal = page.getByRole("navigation", { name: "Legal" });
    await expect(legal.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    await expect(legal.getByRole("link", { name: "Cookies" })).toHaveAttribute("href", "/cookies");
    expect(await page.content()).toContain("<!-- DRAFT - not legal advice: review before launch -->");
  });
}

test("home footer links to privacy and cookies", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Legal" }).getByRole("link", { name: "Privacy" })).toBeVisible();
});

test("Delete my data needs a confirm, then the link stops working", async ({ page }) => {
  const day = 86400000;
  const a = await insert(new Date(Date.now() + 20 * day + Math.floor(Math.random() * 3600000)));
  const b = await insert(new Date(Date.now() + 21 * day + Math.floor(Math.random() * 3600000)));
  await page.goto(`/booking/${a.cancel_token}`);
  await page.getByRole("button", { name: "Delete my data" }).click();
  await expect(page.getByRole("button", { name: "Keep my data" })).toBeFocused();
  await page.getByRole("button", { name: "Keep my data" }).click();
  await expect(page.getByRole("button", { name: "Delete my data" })).toBeFocused();
  await page.getByRole("button", { name: "Delete my data" }).click();
  const yes = page.getByRole("button", { name: "Yes, delete my data" });
  expect((await yes.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  await yes.click();
  await expect(page.getByText("Your details have been deleted.")).toBeFocused();

  for (const t of [a.cancel_token, b.cancel_token]) expect((await page.goto(`/booking/${t}`))?.status()).toBe(404);
  const rows = await (await fetch(`${API}/rest/v1/bookings?select=customer_name,phone,email,status,cancelled_by&id=in.(${a.id},${b.id})`, { headers: admin })).json();
  expect(rows).toHaveLength(2);
  for (const r of rows) expect(r).toMatchObject({ customer_name: "Deleted customer", email: "", status: "cancelled", cancelled_by: "customer" });
});

test("Stop reminder messages turns reminders off for that booking", async ({ page }) => {
  const a = await insert(new Date(Date.now() + 22 * 86400000 + Math.floor(Math.random() * 3600000)));
  await page.goto(`/booking/${a.cancel_token}`);
  await page.getByRole("button", { name: "Stop reminder messages" }).click();
  await expect(page.getByText("Reminder messages are off for this booking.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Reminder messages are off for this booking.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Stop reminder messages" })).toHaveCount(0);
  const [row] = await (await fetch(`${API}/rest/v1/bookings?select=reminders_off,status&id=eq.${a.id}`, { headers: admin })).json();
  expect(row).toEqual({ reminders_off: true, status: "confirmed" });
});

test("public pages set no cookies", async ({ page, context }) => {
  for (const p of ["/", "/book", "/privacy"]) await page.goto(p);
  expect(await context.cookies()).toEqual([]);
});

test("booking form explains data use and links to privacy", async ({ page }) => {
  await page.goto("/book");
  await page.getByRole("list", { name: "Services" }).getByRole("button").first().click();
  await page.getByRole("group", { name: "Days" }).getByRole("button").first().click();
  const first = page.getByRole("group", { name: "Available times" }).getByRole("button").first();
  if (!(await first.isVisible({ timeout: 5000 }).catch(() => false))) {
    await page.getByRole("group", { name: "Days" }).getByRole("button").nth(1).click();
  }
  await page.getByRole("group", { name: "Available times" }).getByRole("button").first().click();
  await expect(page.getByText("We use your name, phone and email only to manage your appointment. See our Privacy notice.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacy notice" })).toHaveAttribute("href", "/privacy");
});

test("old site URLs redirect permanently", async ({ page, request }) => {
  const res = await request.get("/gallery", { maxRedirects: 0 });
  expect(res.status()).toBe(301);
  expect(res.headers().location).toBe("/#gallery");
  expect((await request.get("/booking", { maxRedirects: 0 })).headers().location).toBe("/book");
  await page.goto("/gallery");
  expect(new URL(page.url()).pathname).toBe("/");
  expect((await request.get("/book", { maxRedirects: 0 })).status()).toBe(200);
});

test("sitemap and robots", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const p of ["/book", "/privacy", "/cookies"]) expect(sitemap).toContain(`zizusbarbers.com${p}</loc>`);
  expect(sitemap).not.toMatch(/\/(admin|auth|booking\/)/);
  const robots = await (await request.get("/robots.txt")).text();
  for (const p of ["/admin", "/auth", "/booking/"]) expect(robots).toContain(`Disallow: ${p}`);
});

test("manifest is served", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.status()).toBe(200);
  const m = await res.json();
  expect(m.name).toBe("Zizu's Barbers");
  expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  expect((await request.get(m.icons[0].src)).headers()["content-type"]).toBe("image/png");
});

test("home SEO: title, one H1, canonical, absolute og:image, JSON-LD priceRange", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Barber in Upperthorpe, Sheffield S6 | Zizu's Barbers");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /^https?:\/\/[^/]+\/?$/);
  const og = await page.locator('meta[property="og:image"]').first().getAttribute("content");
  expect(og).toMatch(/^https?:\/\/.+\/opengraph-image/);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Upperthorpe.*Euro-Afro|Euro-Afro.*Upperthorpe/);
  const img = await request.get(new URL(og!).pathname);
  expect(img.headers()["content-type"]).toBe("image/png");

  const raw = await page.locator('script[type="application/ld+json"]').allTextContents();
  const salon = raw.map((r) => JSON.parse(r)).find((j) => j["@type"] === "HairSalon");
  expect(salon.priceRange).toMatch(/^£\d+(\.\d\d)?(-£\d+(\.\d\d)?)?$/);
  expect(salon.image).toMatch(/^https:\/\//);
  expect(salon.sameAs).toContain("https://www.instagram.com/zizusbarbers");
  expect(salon.aggregateRating).toBeUndefined();
});

test("branded 404 links home and to booking", async ({ page }) => {
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Book an appointment" })).toHaveAttribute("href", "/book");
});
