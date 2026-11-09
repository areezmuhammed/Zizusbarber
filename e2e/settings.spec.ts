import { expect, test, type Browser, type Page } from "@playwright/test";
import { DateTime } from "luxon";
import { API, deleteUsers, H, makeUser } from "./helpers";

// Every row this spec creates carries PREFIX; seeded services and hours are snapshotted and restored afterwards.
const PREFIX = `E2E Set ${Date.now()}`;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const rest = async (path: string, init: RequestInit = {}) => {
  const r = await fetch(`${API}/rest/v1/${path}`, { ...init, headers: { ...H, Prefer: "return=representation", ...init.headers } });
  expect(r.ok, await r.clone().text()).toBe(true);
  return r.status === 204 ? [] : r.json();
};

let seededHours: Record<string, unknown>[] = [];
let seededServices: Record<string, unknown>[] = [];

test.beforeAll(async () => {
  seededHours = await rest("opening_hours?select=weekday,open_local,close_local&barber_id=is.null");
  seededServices = await rest("services?select=id,name,price_pence,duration_min,active,sort");
});

// Every teardown step runs even if an earlier one throws; the first error is re-thrown at the end.
test.afterAll(async () => {
  const like = encodeURIComponent(`${PREFIX}*`);
  const errors: unknown[] = [];
  const step = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      errors.push(e);
    }
  };
  await step(() => rest(`bookings?customer_name=like.${like}`, { method: "DELETE" })); // before services: FK
  await step(() => rest(`closures?reason=like.${like}`, { method: "DELETE" }));
  await step(() => rest(`services?name=like.${like}`, { method: "DELETE" }));
  // upsert the seeded days first, then drop the others, so a failure never leaves the week empty
  await step(() =>
    rest("opening_hours?on_conflict=barber_id,weekday", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(seededHours.map((h) => ({ barber_id: null, ...h }))),
    }),
  );
  await step(() =>
    rest(`opening_hours?barber_id=is.null&weekday=not.in.(${seededHours.map((h) => h.weekday).join(",")})`, { method: "DELETE" }),
  );
  for (const sv of seededServices) await step(() => rest(`services?id=eq.${sv.id}`, { method: "PATCH", body: JSON.stringify(sv) }));
  await step(deleteUsers);
  if (errors.length) throw errors[0];
});

async function signedIn(browser: Browser, label: string, owner: boolean) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, baseURL: "http://localhost:3107" });
  const page = await ctx.newPage();
  await page.goto(await makeUser(label, owner));
  await expect(page).toHaveURL(/\/admin$/);
  return page;
}

// An open Tue-Sat day 2..8 days ahead, inside /book's 14-day window
const today = DateTime.now().setZone("Europe/London").startOf("day");
const target = [2, 3, 4, 5, 6, 7, 8].map((n) => today.plus({ days: n })).find((d) => d.weekday >= 2 && d.weekday <= 6)!;
const targetLabel = target.setLocale("en-GB").toFormat("cccc d LLLL");
const weekday = target.weekday % 7; // Luxon 7 = Sunday -> 0
const london = (iso: string) => DateTime.fromISO(iso, { zone: "Europe/London" }).toFormat("HH:mm");

// Added through the owner's "Add a service" form (a REST insert would bypass the cache invalidation).
async function addService(owner: Page, name: string) {
  await owner.goto("/admin/settings");
  const add = owner.locator("details").filter({ hasText: "Add a service" });
  await add.getByText("Add a service").click();
  await add.getByLabel("Name").fill(name);
  await add.getByLabel("Price (£)").fill("11");
  await add.getByLabel("Minutes").fill("30");
  await add.getByRole("button", { name: "Add service" }).click();
  await expect(add.getByRole("status")).toHaveText("Service added.");
  const [s] = await rest(`services?select=id,price_pence,duration_min,active&name=eq.${encodeURIComponent(name)}`);
  expect(s).toMatchObject({ price_pence: 1100, duration_min: 30, active: true });
  return s.id as string;
}

// Opens /book for a service; returns the day labels offered.
async function bookDays(page: Page, serviceLabel: string | RegExp) {
  await page.goto("/book");
  await page.getByRole("button", { name: serviceLabel }).click();
  const days = page.getByRole("group", { name: "Days" }).getByRole("button");
  await expect(days.first()).toBeVisible();
  return days.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
}

// London start times offered for the target day.
async function slots(page: Page, serviceLabel: string | RegExp) {
  await bookDays(page, serviceLabel);
  await page.getByRole("group", { name: "Days" }).getByRole("button", { name: targetLabel }).click();
  const group = page.getByRole("group", { name: "Available times" });
  await expect(group.getByRole("button").first()).toBeVisible();
  return (await group.getByRole("button").evaluateAll((els) => els.map((e) => e.getAttribute("data-start")!))).map(london);
}

const serviceItem = (page: Page, name: string) =>
  page.getByRole("list", { name: "Services" }).getByRole("listitem").filter({ hasText: name });

test("editing a service's price and duration shows at once on home and in /book slots", async ({ page, browser }) => {
  const name = `${PREFIX} Cut`;
  const owner = await signedIn(browser, "setsvc", true);
  await addService(owner, name);
  // prime the public caches with the old values
  await page.goto("/");
  await expect(page.locator("#services")).toContainText(name);
  const before = await slots(page, `${name}, £11, 30 min`);

  await owner.goto("/admin/settings");
  const item = serviceItem(owner, name);
  await item.getByText(`Edit ${name}`).click();
  await item.getByLabel("Price (£)").fill("12.50");
  await item.getByLabel("Minutes").fill("60");
  await item.getByRole("button", { name: "Save service" }).click();
  await expect(item.getByRole("status").first()).toHaveText("Saved.");
  const [row] = await rest(`services?select=price_pence,duration_min&name=eq.${encodeURIComponent(name)}`);
  expect(row).toEqual({ price_pence: 1250, duration_min: 60 });

  await page.goto("/");
  const svc = page.locator("#services li").filter({ hasText: name });
  await expect(svc).toContainText("£12.50");
  await expect(svc).toContainText("60 min");
  const after = await slots(page, `${name}, £12.50, 60 min`);
  // the last start moves 30 minutes earlier: the longer service must still end by closing time
  const minus30 = DateTime.fromFormat(before.at(-1)!, "HH:mm").minus({ minutes: 30 }).toFormat("HH:mm");
  expect(after.at(-1)).toBe(minus30);

  // reorder: moving it up puts it before the service that was above it
  await owner.getByRole("button", { name: `Move ${name} up` }).click();
  await expect(owner.getByRole("status").filter({ hasText: "Order saved." })).toBeVisible();
  const order: { name: string }[] = await rest("services?select=name&order=sort");
  expect(order.at(-1)!.name).not.toBe(name);
  expect(order.at(-2)!.name).toBe(name);

  // two-step delete (no bookings reference it): first tap asks, cancel keeps it, "Yes, delete" removes it
  const svcRows = () => rest(`services?select=id&name=eq.${encodeURIComponent(name)}`);
  const item2 = serviceItem(owner, name); // its edit panel is still open from above
  const confirm = item2.getByRole("group", { name: `Confirm delete ${name}` });
  await item2.getByRole("button", { name: `Delete ${name}` }).click();
  await expect(confirm).toBeVisible();
  expect(await svcRows()).toHaveLength(1);
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(item2.getByRole("button", { name: `Delete ${name}` })).toBeVisible();
  expect(await svcRows()).toHaveLength(1);
  await item2.getByRole("button", { name: `Delete ${name}` }).click();
  await confirm.getByRole("button", { name: "Yes, delete" }).click();
  await expect(serviceItem(owner, name)).toHaveCount(0);
  expect(await svcRows()).toHaveLength(0);
  await owner.context().close();
});

test("hiding a service removes it from home and /book; a service with bookings can't be deleted", async ({ page, browser }) => {
  const name = `${PREFIX} Hide`;
  const owner = await signedIn(browser, "sethide", true);
  const id = await addService(owner, name);
  await page.goto("/");
  await expect(page.locator("#services")).toContainText(name);
  await page.goto("/book");
  await expect(page.getByRole("list", { name: "Services" })).toContainText(name);

  // a booking references it, so delete is refused and the booking keeps its times
  const start = target.set({ hour: 10 }).toUTC();
  const [b] = await rest("bookings", {
    method: "POST",
    body: JSON.stringify({
      barber_id: "00000000-0000-0000-0000-000000000001", service_id: id, customer_name: `${PREFIX} B`, phone: "1",
      email: "", start_at: start.toISO(), end_at: start.plus({ minutes: 30 }).toISO(), status: "done",
    }),
  });

  await owner.goto("/admin/settings");
  const item = serviceItem(owner, name);
  await item.getByText(`Edit ${name}`).click();
  await item.getByRole("button", { name: `Delete ${name}` }).click();
  await item.getByRole("group", { name: `Confirm delete ${name}` }).getByRole("button", { name: "Yes, delete" }).click();
  await expect(item.getByRole("status").first()).toContainText("can't be deleted");
  await item.getByLabel("Show on the website").uncheck();
  await item.getByLabel("Minutes").fill("45");
  await item.getByRole("button", { name: "Save service" }).click();
  await expect(item.getByRole("status").first()).toHaveText("Saved.");
  await expect(item).toContainText("hidden");
  const [kept] = await rest(`bookings?select=end_at&id=eq.${b.id}`);
  expect(Date.parse(kept.end_at)).toBe(start.plus({ minutes: 30 }).toMillis());

  await page.goto("/");
  await expect(page.locator("#services")).toBeVisible();
  await expect(page.locator("#services")).not.toContainText(name);
  await page.goto("/book");
  await expect(page.getByRole("list", { name: "Services" })).toContainText("Hair Cut");
  await expect(page.getByRole("list", { name: "Services" })).not.toContainText(name);

  await rest(`bookings?id=eq.${b.id}`, { method: "DELETE" });
  await owner.context().close();
});

test("a closure removes that day from /book and shows on the home page", async ({ page, browser }) => {
  expect(await bookDays(page, /^Hair Cut, £14, 30 min$/)).toContain(targetLabel);
  await page.goto("/");
  const reason = `${PREFIX} Holiday`;

  const owner = await signedIn(browser, "setclose", true);
  await owner.goto("/admin/settings");
  const form = owner.getByRole("form", { name: "Add a closure" });
  await form.getByLabel("Date").fill(target.toISODate()!);
  await form.getByLabel("Reason (optional)").fill(reason);
  await form.getByRole("button", { name: "Add closure" }).click();
  await expect(form.getByRole("status")).toHaveText("Closure added.");
  await expect(owner.getByRole("list", { name: "Upcoming closures" })).toContainText(reason);

  expect(await bookDays(page, /^Hair Cut, £14, 30 min$/)).not.toContain(targetLabel);
  await page.goto("/");
  const pub = page.getByRole("list", { name: "Upcoming closures" });
  await expect(pub).toContainText(reason);
  await expect(pub).toContainText(target.setLocale("en-GB").toFormat("ccc d LLL"));

  // deleting it brings the day back
  const when = target.setLocale("en-GB").toFormat("ccc d LLL yyyy");
  const closureRows = () => rest(`closures?select=id&reason=eq.${encodeURIComponent(reason)}`);
  const confirm = owner.getByRole("group", { name: `Confirm delete closure on ${when}` });
  await owner.getByRole("button", { name: `Delete closure on ${when}` }).click(); // first tap only asks
  await expect(confirm).toBeVisible();
  for (const b of await confirm.getByRole("button").all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  expect(await closureRows()).toHaveLength(1);
  await confirm.getByRole("button", { name: "Cancel" }).click(); // cancel keeps it
  await expect(confirm).toBeHidden();
  expect(await closureRows()).toHaveLength(1);
  await owner.getByRole("button", { name: `Delete closure on ${when}` }).click();
  await confirm.getByRole("button", { name: "Yes, delete" }).click();
  await expect(owner.getByText("No closures coming up.")).toBeVisible();
  expect(await closureRows()).toHaveLength(0);
  expect(await bookDays(page, /^Hair Cut, £14, 30 min$/)).toContain(targetLabel);
  await owner.context().close();
});

test("changing a day's opening hours changes the slot range and JSON-LD; closing it removes the day", async ({ page, browser }) => {
  const day = DAYS[weekday];
  await page.goto("/");
  const owner = await signedIn(browser, "sethours", true);
  await owner.goto("/admin/settings");
  const link = owner.getByRole("link", { name: "Settings" });
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(48);

  const form = owner.getByRole("form", { name: day });
  await form.getByLabel("Opens").fill("11:00");
  await form.getByLabel("Closes").fill("13:00");
  await form.getByRole("button", { name: `Save ${day}` }).click();
  await expect(form.getByRole("status")).toHaveText(`${day} saved.`);
  const [row] = await rest(`opening_hours?select=open_local,close_local&barber_id=is.null&weekday=eq.${weekday}`);
  expect(row).toEqual({ open_local: "11:00:00", close_local: "13:00:00" }); // stored as local wall-clock

  const times = await slots(page, /^Hair Cut, £14, 30 min$/);
  expect(times[0]).toBe("11:00");
  expect(times.at(-1)).toBe("12:30");

  await page.goto("/");
  await expect(page.locator("#hours")).toContainText("11:00–13:00");
  const raw = await page.locator('script[type="application/ld+json"]').allTextContents();
  const salon = raw.map((r) => JSON.parse(r)).find((j) => j["@type"] === "HairSalon");
  expect(salon.openingHoursSpecification).toContainEqual(
    expect.objectContaining({ dayOfWeek: `https://schema.org/${day}`, opens: "11:00", closes: "13:00" }),
  );

  // invalid: close before open is refused, nothing saved
  await form.getByLabel("Closes").fill("10:00");
  await form.getByRole("button", { name: `Save ${day}` }).click();
  await expect(form.getByRole("status")).toContainText("Closing time must be after opening time");

  await form.getByLabel("Open", { exact: true }).uncheck();
  await form.getByRole("button", { name: `Save ${day}` }).click();
  await expect(form.getByRole("status")).toHaveText(`${day} saved.`);
  expect(await bookDays(page, /^Hair Cut, £14, 30 min$/)).not.toContain(targetLabel);
  await owner.context().close();
});

test("a non-owner or signed-out caller cannot invoke the settings actions", async ({ browser }) => {
  const owner = await signedIn(browser, "setact", true);
  await owner.goto("/admin/settings");
  const day = DAYS[weekday];
  const form = owner.getByRole("form", { name: day });
  const [req] = await Promise.all([
    owner.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]),
    form.getByRole("button", { name: `Save ${day}` }).click(),
  ]);
  const action = req.headers()["next-action"];
  await expect(form.getByRole("status")).toHaveText(`${day} saved.`);
  const before = await rest(`opening_hours?select=open_local,close_local&barber_id=is.null&weekday=eq.${weekday}`);
  const body = JSON.stringify([{ weekday, closed: false, open: "05:00", close: "06:00" }]);
  const headers = { "next-action": action, "content-type": "text/plain;charset=UTF-8", accept: "text/x-component" };

  const other = await signedIn(browser, "setother", false);
  const res = await other.context().request.post("/admin/settings", { headers, data: body });
  expect(await res.text()).toContain("forbidden");

  const anon = await browser.newContext({ baseURL: "http://localhost:3107" });
  const r2 = await anon.request.post("/admin/settings", { headers, data: body, maxRedirects: 0 });
  expect(await r2.text()).not.toContain('"ok":true');

  expect(await rest(`opening_hours?select=open_local,close_local&barber_id=is.null&weekday=eq.${weekday}`)).toEqual(before);
  await anon.close();
  await other.context().close();
  await owner.context().close();
});
