import { createClient as createSupabase } from "@supabase/supabase-js";

// Browser code only needs anonymous access (live status, signed-URL photo uploads). Auth is off so page scripts never
// rewrite the sign-in cookie: iOS Safari caps script-written cookies at 7 days, which signed the owner out. The server
// (proxy.ts) alone sets the session cookie, with a 400-day lifetime.
export function createClient() {
  return createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
