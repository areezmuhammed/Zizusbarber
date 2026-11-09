import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") ?? "/admin";
  // Only same-site /admin paths; "//evil" and "/admin.evil" style values fall back.
  const safe = /^\/admin(\/[\w\-./]*)?$/.test(next) && !next.includes("//") ? next : "/admin";
  const supabase = await createClient();
  const code = searchParams.get("code");
  const hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : hash && type
      ? await supabase.auth.verifyOtp({ token_hash: hash, type })
      : { error: new Error("missing credentials") };
  return NextResponse.redirect(`${origin}${error ? "/admin/login" : safe}`);
}
