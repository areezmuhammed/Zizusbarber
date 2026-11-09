"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

// Always reports success so the form cannot be used to discover which addresses are owners.
export async function sendLink(_prev: { sent: boolean }, form: FormData) {
  const email = String(form.get("email") ?? "").trim();
  if (email) {
    const supabase = await createClient();
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/callback?next=/admin` },
    });
  }
  return { sent: true };
}
