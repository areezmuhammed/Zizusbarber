import { redirect } from "next/navigation";
import { signOut } from "../actions";
import { createClient } from "@/lib/supabase/server";

const nav = ["Today", "Status", "Settings", "Gallery"];

export default async function AdminShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser(); // verified with the auth server
  if (!data.user) redirect("/admin/login");
  const { data: isOwner } = await supabase.rpc("is_owner");

  if (!isOwner) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-4">
        <h1 className="text-2xl font-bold">Not authorised</h1>
        <p>This account is not an owner of this shop.</p>
        <form action={signOut}>
          <button className="rounded bg-black p-3 text-white">Sign out</button>
        </form>
      </main>
    );
  }
  return (
    <div className="mx-auto min-h-screen max-w-2xl">
      <nav aria-label="Admin" className="flex flex-wrap items-center gap-2 border-b p-3">
        {nav.map((n) => (
          <span key={n} className="rounded px-3 py-2 text-sm">{n}</span>
        ))}
        <form action={signOut} className="ml-auto">
          <button className="rounded border px-3 py-2 text-sm">Sign out</button>
        </form>
      </nav>
      <div className="p-4">{children}</div>
    </div>
  );
}
