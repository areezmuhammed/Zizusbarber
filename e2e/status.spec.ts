import { expect, test, type Browser } from "@playwright/test";
import { API, deleteUsers, H, makeUser } from "./helpers";

const setRow = async (patch: object) => {
  const r = await fetch(`${API}/rest/v1/shop_status?id=eq.true`, { method: "PATCH", headers: H, body: JSON.stringify(patch) });
  expect(r.ok).toBe(true);
};
const reset = () => setRow({ state: "open", in_shop: 0, waiting: 0, note: null });
const getRow = async () => ((await (await fetch(`${API}/rest/v1/shop_status?select=*`, { headers: H })).json()) as Record<string, unknown>[])[0];

test.beforeEach(reset);
test.afterAll(async () => {
  await setRow({ state: "closed", in_shop: 0, waiting: 0, note: null });
  await deleteUsers();
});

async function signedIn(browser: Browser, label: string, owner: boolean) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, baseURL: "http://localhost:3107" });
  const page = await ctx.newPage();
  await page.goto(await makeUser(label, owner));
  await expect(page).toHaveURL(/\/admin$/);
  return page;
}

test("owner +1 in shop shows on an already-open public page without reload", async ({ page, browser }) => {
  await page.goto("/");
  const badge = page.getByTestId("status-badge");
  await expect(badge).toContainText("0 in shop, 0 waiting");

  const owner = await signedIn(browser, "statusown", true);
  await owner.goto("/admin/status");
  await expect(owner.getByTestId("count-in_shop")).toHaveText("0");
  for (const n of ["Today", "Status"]) {
    expect((await owner.getByRole("link", { name: n }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  // arrow keys move between states (native radios)
  await owner.getByRole("radio", { name: "Open" }).focus();
  await owner.keyboard.press("ArrowRight");
  await expect(owner.getByRole("radio", { name: "Busy" })).toBeChecked();
  await expect.poll(async () => (await getRow()).state).toBe("busy");
  await owner.getByText("Open", { exact: true }).first().click();
  // a 48px+ target
  const plus = owner.getByRole("button", { name: "In shop plus one" });
  expect((await plus.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  await plus.click();
  await expect(owner.getByTestId("count-in_shop")).toHaveText("1");

  await expect(badge).toContainText("1 in shop, 0 waiting", { timeout: 10_000 });
  expect((await getRow()).in_shop).toBe(1);

  // minus never goes below 0
  await owner.getByRole("button", { name: "Waiting minus one" }).click();
  await expect(owner.getByTestId("count-waiting")).toHaveText("0");
  expect((await getRow()).waiting).toBe(0);

  // state + note
  await owner.getByText("Busy", { exact: true }).click();
  await owner.getByLabel("Note (optional)").fill("Back at 3");
  await owner.getByText("Open", { exact: true }).first().click(); // a state tap must not save the unsaved draft
  await expect(owner.getByRole("radio", { name: "Open" })).toBeChecked();
  expect((await getRow()).note).toBeNull();
  await owner.getByText("Busy", { exact: true }).click();
  await owner.getByRole("button", { name: "Save note" }).click();
  await expect(badge).toContainText("Busy", { timeout: 10_000 });
  await expect(badge).toContainText("Back at 3");
  await owner.getByText("Closed", { exact: true }).click();
  await expect(badge).not.toContainText("in shop", { timeout: 10_000 });
  await owner.context().close();
});

test("rapid taps each apply their own delta", async ({ browser }) => {
  const owner = await signedIn(browser, "statusrapid", true);
  await owner.goto("/admin/status");
  const plus = owner.getByRole("button", { name: "Waiting plus one" });
  for (let i = 0; i < 5; i++) await plus.click({ delay: 0, noWaitAfter: true });
  await expect.poll(async () => (await getRow()).waiting).toBe(5);
  await owner.context().close();
});

// Real browser websocket to Realtime is closed by the test (page.routeWebSocket), so only polling can update the badge.
test("badge falls back to 30s polling when the realtime subscription fails", async ({ page }) => {
  test.setTimeout(90_000);
  await page.routeWebSocket(/realtime/, (ws) => ws.close({ code: 1011, reason: "blocked by test" }));
  await page.goto("/");
  const badge = page.getByTestId("status-badge");
  await expect(badge).toContainText("0 in shop, 0 waiting");
  await setRow({ in_shop: 4 });
  await expect(badge).toContainText("4 in shop, 0 waiting", { timeout: 45_000 });
});

test("a non-owner cannot call the status actions", async ({ browser }) => {
  const owner = await signedIn(browser, "statusact", true);
  await owner.goto("/admin/status");
  // capture the real server-action id from the owner's own click
  const [req] = await Promise.all([
    owner.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]),
    owner.getByRole("button", { name: "In shop plus one" }).click(),
  ]);
  const action = req.headers()["next-action"];
  await expect(owner.getByTestId("count-in_shop")).toHaveText("1");

  const other = await signedIn(browser, "statusother", false).catch(async () => null);
  // a non-owner is signed in but refused by the shell; replay the action with their cookies
  const ctx = other ? other.context() : null;
  expect(ctx).not.toBeNull();
  const res = await ctx!.request.post("/admin/status", {
    headers: { "next-action": action, "content-type": "text/plain;charset=UTF-8", accept: "text/x-component" },
    data: JSON.stringify([{ field: "in_shop", delta: 1 }]),
  });
  expect(await res.text()).toContain("forbidden");
  expect((await getRow()).in_shop).toBe(1);

  // anonymous caller is bounced to login, count unchanged
  const anon = await browser.newContext({ baseURL: "http://localhost:3107" });
  const r2 = await anon.request.post("/admin/status", {
    headers: { "next-action": action, "content-type": "text/plain;charset=UTF-8", accept: "text/x-component" },
    data: JSON.stringify([{ field: "in_shop", delta: 1 }]),
    maxRedirects: 0,
  });
  expect(await r2.text()).not.toContain('"ok":true');
  expect((await getRow()).in_shop).toBe(1);
  await anon.close();
  await owner.context().close();
  await ctx!.close();
});
