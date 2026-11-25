import { expect, test, type Page } from "@playwright/test";
import { DateTime } from "luxon";
import { API, deleteUsers, H, makeUser } from "./helpers";

// Fixed future BST dates, one per scenario so tests never see each other's bookings (Tue, Wed, Thu, Fri).
const STATUS_DAY = "2031-06-03";
const EXTEND_DAY = "2031-06-04";
const CONFLICT_DAY = "2031-06-05";
const ADD_DAY = "2031-06-06";
const TAG = "E2EAdmin"; // surname on every test booking, for cleanup

async function cleanup() {
  const r = await fetch(`${API}/rest/v1/bookings?customer_name=like.*${TAG}`, { method: "DELETE", headers: H });
  expect(r.ok).toBe(true);
}
test.beforeAll(cleanup);
test.afterAll(async () => {
  await cleanup();
  await deleteUsers();
});

const utc = (date: string, time: string) => DateTime.fromISO(`${date}T${time}`, { zone: "Europe/London" }).toUTC();
// timestamptz as PostgREST returns it
const pg = (date: string, time: string) => utc(date, time).toFormat("yyyy-MM-dd'T'HH:mm:ss'+00:00'");

// Service-role insert, bypassing hours, so any instant can be seeded.
async function seed(first: string, date: string, time: string, minutes = 30, phone = "+447700900123") {
  const sv = await (await fetch(`${API}/rest/v1/services?select=id&name=eq.Hair%20Cut`, { headers: H })).json();
  const start = utc(date, time);
  const res = await fetch(`${API}/rest/v1/bookings`, {
    method: "POST",
    headers: { ...H, Prefer: "return=representation" },
    body: JSON.stringify({
      barber_id: "00000000-0000-0000-0000-000000000001", service_id: sv[0].id, customer_name: `${first} ${TAG}`,
      phone, email: "", start_at: start.toISO(), end_at: start.plus({ minutes }).toISO(), status: "confirmed",
    }),
  });
  expect(res.ok).toBe(true);
  return ((await res.json()) as { id: string }[])[0].id;
}

async function row(id: string) {
  const r = await fetch(`${API}/rest/v1/bookings?id=eq.${id}&select=status,start_at,end_at`, { headers: H });
  return ((await r.json()) as { status: string; start_at: string; end_at: string }[])[0];
}

async function signIn(page: Page, path: string) {
  await page.goto(await makeUser(`day${Math.random().toString(36).slice(2, 8)}`, true));
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto(path);
}

const open = (page: Page, first: string) => page.getByRole("button", { name: new RegExp(`^${first}\\b`) }).click();

test("today's list shows seeded bookings in time order with tap-to-call", async ({ page }) => {
  const today = DateTime.now().setZone("Europe/London").toISODate()!;
  await seed("Zed", today, "16:00");
  await seed("Amy", today, "09:00", 30, "+447700900456");
  await signIn(page, "/admin");
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  const list = page.getByRole("list", { name: "Bookings" });
  await expect(list).toContainText("Amy");
  await expect(list).toContainText("09:00");
  await expect(list).toContainText("Hair Cut");
  const text = await list.innerText();
  expect(text.indexOf("Amy")).toBeLessThan(text.indexOf("Zed"));
  await expect(page.getByRole("link", { name: "Call Amy on 07700 900456" })).toHaveAttribute("href", "tel:+447700900456");
});

test("date switcher moves a day at a time and back to today", async ({ page }) => {
  await signIn(page, `/admin?date=${STATUS_DAY}`);
  await expect(page.getByRole("heading", { name: "Tue 3 Jun 2031" })).toBeVisible();
  await page.getByRole("link", { name: "Next day" }).click();
  await expect(page.getByRole("heading", { name: "Wed 4 Jun 2031" })).toBeVisible();
  await page.getByRole("link", { name: "Previous day" }).click();
  await expect(page.getByRole("heading", { name: "Tue 3 Jun 2031" })).toBeVisible();
  await page.getByRole("link", { name: "Previous day" }).click();
  await expect(page.getByRole("heading", { name: "Mon 2 Jun 2031" })).toBeVisible();
  await page.getByRole("link", { name: "Go to today" }).click();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
});

test("mark arrived, done and no-show persist; cancel needs a confirm", async ({ page }) => {
  const a = await seed("Ari", STATUS_DAY, "10:00");
  const d = await seed("Dan", STATUS_DAY, "11:00");
  const n = await seed("Nia", STATUS_DAY, "12:00");
  const c = await seed("Cal", STATUS_DAY, "13:00");
  await signIn(page, `/admin?date=${STATUS_DAY}`);
  const sheet = page.getByRole("dialog");

  await open(page, "Ari");
  await sheet.getByRole("button", { name: "Arrived" }).click();
  await expect(sheet).toBeHidden();
  await open(page, "Dan");
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(sheet).toBeHidden();
  await open(page, "Nia");
  await sheet.getByRole("button", { name: "No-show" }).click();
  await expect(sheet).toBeHidden();

  await open(page, "Cal");
  await sheet.getByRole("button", { name: "Cancel booking" }).click();
  await sheet.getByRole("button", { name: "Keep it" }).click();
  await expect.poll(async () => (await row(c)).status).toBe("confirmed");
  await sheet.getByRole("button", { name: "Cancel booking" }).click();
  await sheet.getByRole("button", { name: "Yes, cancel booking" }).click();
  await expect(sheet).toBeHidden();

  await page.reload();
  await expect(page.getByRole("button", { name: /^Ari\b/ })).toContainText("Arrived");
  await expect(page.getByRole("button", { name: /^Dan\b/ })).toContainText("Done");
  await expect(page.getByRole("button", { name: /^Nia\b/ })).toContainText("No-show");
  await expect(page.getByRole("button", { name: /^Cal\b/ })).toHaveCount(0);
  expect([(await row(a)).status, (await row(d)).status, (await row(n)).status, (await row(c)).status]).toEqual([
    "arrived", "done", "no_show", "cancelled",
  ]);
});

test("+10 min extends via extend_booking and lists the moved bookings", async ({ page }) => {
  const t = await seed("Tom", EXTEND_DAY, "10:00");
  const m = await seed("Mo", EXTEND_DAY, "10:30");
  await signIn(page, `/admin?date=${EXTEND_DAY}`);
  await open(page, "Tom");
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "+10 min" }).click();
  const status = sheet.getByRole("status");
  await expect(status).toContainText("Now 10:00–10:40. Moved 1 booking");
  await expect(status).toContainText("Mo 10:40–11:10");
  expect((await row(t)).end_at).toBe(pg(EXTEND_DAY, "10:40"));
  expect((await row(m)).start_at).toBe(pg(EXTEND_DAY, "10:40"));

  // custom length: back to 30 minutes moves nothing
  await sheet.getByLabel("Length in minutes").fill("30");
  await sheet.getByRole("button", { name: "Set length" }).click();
  await expect(status).toContainText("Now 10:00–10:30. No other bookings moved");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /^Tom\b/ })).toContainText("10:00");
  await expect(page.getByRole("button", { name: /^Mo\b/ })).toContainText("10:40");
});

test("a push past closing shows the conflict and changes nothing", async ({ page }) => {
  const t = await seed("Lou", CONFLICT_DAY, "19:00");
  const l = await seed("Kai", CONFLICT_DAY, "19:30");
  await signIn(page, `/admin?date=${CONFLICT_DAY}`);
  await open(page, "Lou");
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "+10 min" }).click();
  const alert = sheet.getByRole("alert");
  await expect(alert).toContainText("Not changed");
  await expect(alert).toContainText("Kai 19:30–20:00");
  expect((await row(t)).end_at).toBe(pg(CONFLICT_DAY, "19:30"));
  expect((await row(l)).start_at).toBe(pg(CONFLICT_DAY, "19:30"));
});

test("add booking creates a booking through create_booking", async ({ page }) => {
  await signIn(page, `/admin?date=${ADD_DAY}`);
  await page.getByRole("button", { name: "Add booking" }).click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Service").selectOption({ label: "Hair Cut (30 min)" });
  await form.getByLabel("Start time").fill("15:00");
  await form.getByLabel("Name").fill(`Walk ${TAG}`);
  await form.getByLabel("Phone").fill("+44 0771234567");
  await form.getByRole("button", { name: "Save booking" }).click();
  await expect(form.getByRole("alert")).toContainText("Check the name and UK phone number");
  await form.getByLabel("Phone").fill("07700 900111");
  await form.getByRole("button", { name: "Save booking" }).click();
  await expect(form).toBeHidden();
  await expect(page.getByRole("button", { name: /^Walk\b/ })).toContainText("15:00");
  const r = await fetch(`${API}/rest/v1/bookings?customer_name=eq.Walk%20${TAG}&select=phone,start_at,status`, { headers: H });
  expect(await r.json()).toEqual([{ phone: "+447700900111", start_at: "2031-06-06T14:00:00+00:00", status: "confirmed" }]);

  // same slot again is refused with a clear message
  await page.getByRole("button", { name: "Add booking" }).click();
  await form.getByLabel("Start time").fill("15:00");
  await form.getByLabel("Name").fill(`Again ${TAG}`);
  await form.getByLabel("Phone").fill("07700 900112");
  await form.getByRole("button", { name: "Save booking" }).click();
  await expect(form.getByRole("alert")).toContainText("overlaps another booking");
});

test("owner adds a booking to their calendar; strangers get nothing", async ({ page, browser }) => {
  const CAL_DAY = "2031-06-10"; // BST: 10:30 London = 09:30Z
  const id = await seed("Cal", CAL_DAY, "10:30");
  await signIn(page, `/admin?date=${CAL_DAY}`);
  const link = page.getByRole("link", { name: "Add Cal's booking to calendar" });
  await expect(link).toHaveAttribute("href", `/admin/bookings/${id}/calendar.ics`);
  const res = await page.request.get(`/admin/bookings/${id}/calendar.ics`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/calendar");
  expect(res.headers()["cache-control"]).toContain("no-store");
  const ics = await res.text();
  expect(ics).toContain(`UID:booking-${id}@zizusbarbers.com`);
  expect(ics).toContain("DTSTART:20310610T093000Z");
  expect(ics).toContain(`SUMMARY:Hair Cut: Cal ${TAG}`);

  // non-owner: refused; signed out: sent to the login page
  const other = await browser.newContext({ baseURL: "http://localhost:3107" });
  const stranger = await other.newPage();
  await stranger.goto(await makeUser(`calx${Math.random().toString(36).slice(2, 8)}`, false));
  expect((await stranger.request.get(`/admin/bookings/${id}/calendar.ics`)).status()).toBe(403);
  await other.close();
  const anon = await browser.newContext({ baseURL: "http://localhost:3107" });
  const r = await anon.request.get(`/admin/bookings/${id}/calendar.ics`, { maxRedirects: 0 });
  expect([302, 303, 307]).toContain(r.status());
  expect(r.headers()["location"]).toContain("/admin/login");
  await anon.close();
});
