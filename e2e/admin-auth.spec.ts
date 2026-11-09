import { expect, test } from "@playwright/test";
import { deleteUsers, makeUser } from "./helpers";

test.afterAll(deleteUsers);

test("unauthenticated /admin redirects to login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole("heading", { name: "Admin sign in" })).toBeVisible();
});

test("login form gives a generic response for unknown addresses", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(`nobody-${Date.now()}@example.test`);
  await page.getByRole("button", { name: /sign-in link/ }).click();
  await expect(page.getByRole("status")).toContainText("Check your email");
});

test("owner signs in and reaches the dashboard", async ({ page }) => {
  await page.goto(await makeUser("owner", true));
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("signed-in non-owner is refused", async ({ page }) => {
  await page.goto(await makeUser("guest", false));
  await expect(page.getByRole("heading", { name: "Not authorised" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Today" })).toHaveCount(0);
});

// [raw query value as sent on the wire, the decoded `next` the callback must receive]
const unsafe: [string, string][] = [
  ["https://evil.example", "https://evil.example"],
  ["/\\evil.example", "/\\evil.example"],
  ["/%5Cevil.example", "/\\evil.example"],
  ["/admin/../x", "/admin/../x"],
  ["/admin/%2e%2e/x", "/admin/../x"],
  ["%2F%2Fevil.example", "//evil.example"],
  ["//evil.example", "//evil.example"],
];
unsafe.forEach(([wire, decoded], i) => {
  test(`callback ignores unsafe next ${wire}`, async ({ page }) => {
    const link = (await makeUser(`redir${i}`, true)).replace("next=/admin", `next=${wire}`);
    // proves the case is real: the callback will see exactly this next value
    expect(new URL(link, "http://x").searchParams.get("next")).toBe(decoded);
    await page.goto(link);
    await expect(page).toHaveURL(/^http:\/\/localhost:3107\/admin$/);
  });
});
