import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function isSafeNext(next: string) {
  if (!/^\/admin(\/[\w\-./]*)?$/.test(next) || next.includes("//")) return false;
  return !next.split("/").some((seg) => seg === ".." || seg === ".");
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") ?? "/admin";
  // Only same-site /admin paths; "//evil" and "/admin.evil" style values fall back.
  const safe = isSafeNext(next) ? next : "/admin";
  const supabase = await createClient();
  const code = searchParams.get("code");
  const hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : hash && type
      ? await supabase.auth.verifyOtp({ token_hash: hash, type })
      : { error: new Error("missing credentials") };
  const res = NextResponse.redirect(`${origin}${error ? "/admin/login" : safe}`);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
