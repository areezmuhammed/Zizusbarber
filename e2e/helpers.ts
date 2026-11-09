import { expect } from "@playwright/test";

export const API = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
export const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const stamp = Date.now();
const created: string[] = [];

// Creates a throwaway confirmed user (optionally an owner) and returns a one-time sign-in link. No stored credentials.
export async function makeUser(label: string, owner: boolean) {
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

// deleting the auth user cascades to owners
export async function deleteUsers() {
  for (const id of created.splice(0)) await fetch(`${API}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: H });
}
