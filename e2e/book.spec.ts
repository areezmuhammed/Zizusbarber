import { expect, test, type Page } from "@playwright/test";

const API = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };
const PREFIX = "E2E Book";

// Test bookings are found and removed by name, so a failed run never leaves slots blocked.
async function cleanup() {
  const res = await fetch(`${API}/rest/v1/bookings?customer_name=like.${encodeURIComponent(PREFIX)}*`, {
    method: "DELETE",
    headers: admin,
  });
  expect(res.ok).toBe(true);
}
test.beforeAll(cleanup);
test.afterAll(cleanup);

const summary = (page: Page) => page.getByRole("complementary", { name: "Your booking" });

async function expectPriceAndDuration(page: Page) {
  await expect(summary(page)).toContainText("£14");
  await expect(summary(page)).toContainText("30 min");
}

// Walks to the confirm step on the given date chip; returns the chosen slot's ISO start.
async function toConfirm(page: Page, chip: number, name: string) {
  await page.goto("/book");
  const haircut = page.getByRole("button", { name: /^Hair Cut, £14, 30 min$/ });
  await expect(haircut).toBeVisible();
  await haircut.click();

  await expect(page.getByRole("heading", { name: "Pick a day and time" })).toBeFocused();
  await expectPriceAndDuration(page);
  await page.getByRole("group", { name: "Days" }).getByRole("button").nth(chip).click();
  const slot = page.getByRole("group", { name: "Available times" }).getByRole("button").first();
  await expect(slot).toBeVisible();
  const start = (await slot.getAttribute("data-start"))!;
  await slot.click();

  await expect(page.getByRole("heading", { name: "Your details" })).toBeFocused();
  await expectPriceAndDuration(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Enter your name")).toBeVisible();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Phone").fill("12345");
  await page.getByLabel("Email (optional)").fill("not-an-email");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Enter a UK phone number")).toBeVisible();
  await expect(page.getByText("Enter a valid email or leave it blank")).toBeVisible();
  await page.getByLabel("Phone").fill("07700 900123");
  await page.getByLabel("Email (optional)").fill("");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Check and confirm" })).toBeFocused();
  await expectPriceAndDuration(page);
  return start;
}

test("books service, date, time and details, and stores the booking", async ({ page }) => {
  await page.goto("/book");
  const list = page.getByRole("list", { name: "Services" });
  await expect(list).toContainText("£14");
  await expect(list).toContainText("30 min");

  const name = `${PREFIX} ${Date.now()}`;
  const start = await toConfirm(page, 1, name);
  await expect(page.getByText(name)).toBeVisible();
  await page.getByRole("button", { name: "Confirm booking" }).click();

  await expect(page).toHaveURL(/\/booking\/[0-9a-f-]{36}$/);
  const res = await fetch(
    `${API}/rest/v1/bookings?select=start_at,phone&customer_name=eq.${encodeURIComponent(name)}`,
    { headers: admin },
  );
  const rows: { start_at: string; phone: string }[] = await res.json();
  expect(rows).toHaveLength(1);
  expect(new Date(rows[0].start_at).toISOString()).toBe(start);
  expect(rows[0].phone).toBe("+447700900123");
});

test("a slot taken meanwhile shows the message and refreshes times, keeping details", async ({ page }) => {
  const name = `${PREFIX} taken ${Date.now()}`;
  const start = await toConfirm(page, 2, name);

  const svc = await fetch(`${API}/rest/v1/services?select=id&name=eq.Hair%20Cut`, { headers: { apikey: ANON } });
  const [{ id }] = await svc.json();
  const rival = await fetch(`${API}/rest/v1/rpc/create_booking`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ p_service: id, p_start: start, p_name: `${PREFIX} rival`, p_phone: "07700900000", p_email: "" }),
  });
  expect(rival.ok).toBe(true);

  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByText("That slot was just taken")).toBeVisible();
  const times = page.getByRole("group", { name: "Available times" });
  await expect(times.getByRole("button").first()).toBeVisible();
  await expect(times.locator(`[data-start="${start}"]`)).toHaveCount(0);
  await expectPriceAndDuration(page);

  await times.getByRole("button").first().click();
  await expect(page.getByLabel("Name")).toHaveValue(name);
  await expect(page.getByLabel("Phone")).toHaveValue("07700 900123");
});

test("no horizontal scroll on the booking page", async ({ page }) => {
  await page.goto("/book");
  await expect(page.getByRole("list", { name: "Services" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
