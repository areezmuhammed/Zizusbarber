import { expect, test } from "@playwright/test";

test("/basic has no booking links and no live status", async ({ page }) => {
  await page.goto("/basic");
  await expect(page.locator("#services")).toBeVisible();
  await expect(page.locator('a[href^="/book"]')).toHaveCount(0);
  await expect(page.getByTestId("status-badge")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Quick actions" }).getByRole("link", { name: "Call" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("/basic/admin loads without sign-in and edits stay local", async ({ page }) => {
  const writes: string[] = [];
  page.on("request", (r) => { if (r.method() !== "GET") writes.push(`${r.method()} ${r.url()}`); });
  await page.goto("/basic/admin");
  await expect(page).toHaveURL(/\/basic\/admin$/);
  await expect(page.getByText("Demo: changes aren't saved")).toBeVisible();
  const price = page.getByRole("spinbutton").first();
  await price.fill("99");
  await expect(price).toHaveValue("99");
  expect(writes).toEqual([]);
});
