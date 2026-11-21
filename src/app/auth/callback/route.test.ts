import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn(), verifyOtp: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));

import { GET } from "./route";

const origin = "http://localhost:3107";

beforeEach(() => vi.resetAllMocks());

it("exchanges a PKCE code and preserves a safe admin destination", async () => {
  auth.exchangeCodeForSession.mockResolvedValue({ error: null });
  const response = await GET(new NextRequest(`${origin}/auth/callback?code=test-code&next=/admin/gallery`));
  expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("test-code");
  expect(auth.verifyOtp).not.toHaveBeenCalled();
  expect(response.headers.get("location")).toBe(`${origin}/admin/gallery`);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});

it("sends a failed code exchange back to login", async () => {
  auth.exchangeCodeForSession.mockResolvedValue({ error: new Error("Expired code") });
  const response = await GET(new NextRequest(`${origin}/auth/callback?code=expired&next=/admin/gallery`));
  expect(response.headers.get("location")).toBe(`${origin}/admin/login`);
});

it("verifies a token hash and preserves a safe admin destination", async () => {
  auth.verifyOtp.mockResolvedValue({ error: null });
  const response = await GET(new NextRequest(`${origin}/auth/callback?token_hash=test-hash&type=magiclink&next=/admin/status`));
  expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "test-hash", type: "magiclink" });
  expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  expect(response.headers.get("location")).toBe(`${origin}/admin/status`);
});
