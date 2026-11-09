// Layouts do NOT guard server actions or route handlers: call requireOwner() first in each of those too.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export class NotOwnerError extends Error {}

/** Returns the verified owner user; redirects to login if signed out, throws NotOwnerError otherwise (fails closed). */
export async function requireOwner() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser(); // verified with the auth server
  if (!data.user) redirect("/admin/login");
  const { data: isOwner, error } = await supabase.rpc("is_owner");
  if (error || isOwner !== true) throw new NotOwnerError("not an owner");
  return data.user;
}
