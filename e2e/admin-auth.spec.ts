import { expect, test } from "@playwright/test";

const API = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const stamp = Date.now();
const created: string[] = [];

async function makeUser(label: string, owner: boolean) {
  const email = `test-${label}-${stamp}@example.test`;
  const res = await fetch(`${API}/auth/v1/admin/users`, {
    method: "POST", headers: H, body: JSON.stringify({ email, email_confirm: true }),
  });
  const user = await res.json();
  expect(res.ok).toBe(true);
  created.push(user.id);
  if (owner) {
    const r = await fetch(`${API}/rest/v1/owners`, { method: "POST", headers: H, body: JSON.stringify({ user_id: user.id }) });
    expect(r.ok).toBe(true);
  }
  const link = await fetch(`${API}/auth/v1/admin/generate_link`, {
    method: "POST", headers: H, body: JSON.stringify({ type: "magiclink", email }),
  });
  const { hashed_token } = await link.json();
  return `/auth/callback?token_hash=${hashed_token}&type=magiclink&next=/admin`;
}

test.afterAll(async () => {
  // deleting the auth user cascades to owners
  for (const id of created) await fetch(`${API}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: H });
});

test("unauthenticated /admin redirects to login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole("heading", { name: "Admin sign in" })).toBeVisible();
});

test("login form gives a generic response for unknown addresses", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(`nobody-${stamp}@example.test`);
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

for (const bad of ["https://evil.example", "/\evil.example", "/admin/../x", "%2F%2Fevil.example", "//evil.example"]) {
  test(`callback ignores unsafe next ${bad}`, async ({ page }) => {
    const link = (await makeUser(`redir${bad.length}${bad.charCodeAt(1)}`, true)).replace("next=/admin", `next=${bad.replace("\\", "%5C")}`);
    await page.goto(link);
    await expect(page).toHaveURL(/^http:\/\/localhost:3107\/admin$/);
  });
}
