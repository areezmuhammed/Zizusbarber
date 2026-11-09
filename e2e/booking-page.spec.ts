import { expect, test } from "@playwright/test";

const API = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const PREFIX = "E2E Page";

async function cleanup() {
  const res = await fetch(`${API}/rest/v1/bookings?customer_name=like.${encodeURIComponent(PREFIX)}*`, { method: "DELETE", headers: admin });
  expect(res.ok).toBe(true);
}
test.beforeAll(cleanup);
test.afterAll(cleanup);

// Direct service-role insert so the start can be any instant (cutoff tests need near-term ones).
async function insert(name: string, start: Date) {
  const sv = await (await fetch(`${API}/rest/v1/services?select=id&name=eq.Hair%20Cut`, { headers: admin })).json();
  const res = await fetch(`${API}/rest/v1/bookings`, {
    method: "POST",
    headers: { ...admin, Prefer: "return=representation" },
    body: JSON.stringify({
      barber_id: "00000000-0000-0000-0000-000000000001", service_id: sv[0].id, customer_name: name, phone: "+447700900123",
      email: "", start_at: start.toISOString(), end_at: new Date(+start + 30 * 60000).toISOString(), status: "confirmed",
    }),
  });
  expect(res.ok).toBe(true);
  const [row] = await res.json();
  return row as { id: string; cancel_token: string };
}
const days = (n: number) => new Date(Date.now() + n * 86400000 + Math.floor(Math.random() * 3600000));

test("shows booking details, then cancels with a confirm step", async ({ page }) => {
  const { cancel_token } = await insert(`${PREFIX} Ann ${Date.now()}`, days(10));
  await page.goto(`/booking/${cancel_token}`);
  const card = page.getByRole("region", { name: "Your booking" });
  await expect(card).toContainText("Hair Cut");
  await expect(card).toContainText("£14");
  await expect(card).toContainText("135 Upperthorpe Rd");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByRole("link", { name: "Add to calendar" })).toHaveAttribute("href", `/booking/${cancel_token}/calendar.ics`);

  await page.getByRole("button", { name: "Cancel appointment" }).click();
  await page.getByRole("button", { name: "Keep it" }).click();
  await expect(page.getByRole("button", { name: "Cancel appointment" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel appointment" }).click();
  await page.getByRole("button", { name: "Yes, cancel it" }).click();
  await expect(page.getByText("This appointment has been cancelled.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel appointment" })).toHaveCount(0);
});

test("inside 24h says to call", async ({ page }) => {
  const { cancel_token } = await insert(`${PREFIX} Late ${Date.now()}`, new Date(Date.now() + 3 * 3600000));
  await page.goto(`/booking/${cancel_token}`);
  await page.getByRole("button", { name: "Cancel appointment" }).click();
  await page.getByRole("button", { name: "Yes, cancel it" }).click();
  await expect(page.getByText("Too late to cancel online, please call 07535 423544")).toBeVisible();
});

test("invalid and unknown tokens are 404", async ({ page }) => {
  for (const t of ["not-a-uuid", "00000000-0000-0000-0000-00000000ffff"]) {
    const res = await page.goto(`/booking/${t}`);
    expect(res?.status()).toBe(404);
  }
});

test("banner appears after the shop moves the booking", async ({ page }) => {
  const start = days(12);
  const { id, cancel_token } = await insert(`${PREFIX} Moved ${Date.now()}`, start);
  await page.goto(`/booking/${cancel_token}`);
  await expect(page.getByText("was moved by the shop")).toHaveCount(0);
  const iso = (d: Date) => d.toISOString();
  const res = await fetch(`${API}/rest/v1/booking_changes`, {
    method: "POST",
    headers: admin,
    body: JSON.stringify({
      booking_id: id, old_start: iso(new Date(+start - 1200000)), old_end: iso(new Date(+start + 600000)),
      new_start: iso(start), new_end: iso(new Date(+start + 1800000)), reason: "test",
    }),
  });
  expect(res.ok).toBe(true);
  await page.goto(`/booking/${cancel_token}`);
  await expect(page.getByText(/Your appointment was moved by the shop to \w{3} \d+ \w{3}, \d\d:\d\d/)).toBeVisible();
});

test(".ics route returns calendar with UTC times", async ({ request }) => {
  const start = new Date("2030-06-04T13:20:00Z"); // 14:20 BST
  const { cancel_token } = await insert(`${PREFIX} Ics ${Date.now()}`, start);
  const res = await request.get(`/booking/${cancel_token}/calendar.ics`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/calendar");
  const body = await res.text();
  expect(body).toContain("DTSTART:20300604T132000Z");
  expect(body).toContain(`UID:${cancel_token}@`);
  expect((await request.get("/booking/nope/calendar.ics")).status()).toBe(404);
});

test("page shows London time for BST and GMT bookings", async ({ page }) => {
  for (const [iso, text] of [["2030-06-18T13:20:00Z", "Tue 18 Jun, 14:20"], ["2030-12-17T14:20:00Z", "Tue 17 Dec, 14:20"]] as const) {
    const { cancel_token } = await insert(`${PREFIX} Tz ${iso}`, new Date(iso));
    await page.goto(`/booking/${cancel_token}`);
    await expect(page.getByRole("region", { name: "Your booking" })).toContainText(text);
  }
});
