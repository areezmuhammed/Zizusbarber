import Link from "next/link";
import { signOut } from "../actions";
import { NotOwnerError, requireOwner } from "@/lib/auth";

const nav: [string, string?][] = [["Today", "/admin"], ["Status", "/admin/status"], ["Settings"], ["Gallery"]];

export default async function AdminShell({ children }: { children: React.ReactNode }) {
  let refused = false;
  try {
    await requireOwner();
  } catch (e) {
    if (!(e instanceof NotOwnerError)) throw e; // keeps redirect() working
    refused = true;
  }

  if (refused) {
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
        {nav.map(([n, href]) =>
          href ? (
            <Link key={n} href={href} className="rounded px-3 py-2 text-sm">{n}</Link>
          ) : (
            <span key={n} className="rounded px-3 py-2 text-sm">{n}</span>
          ),
        )}
        <form action={signOut} className="ml-auto">
          <button className="rounded border px-3 py-2 text-sm">Sign out</button>
        </form>
      </nav>
      <div className="p-4">{children}</div>
    </div>
  );
}
