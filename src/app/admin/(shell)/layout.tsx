import { LogOut } from "lucide-react";
import { signOut } from "../actions";
import { AdminNav } from "@/components/admin/AdminNav";
import { NotOwnerError, requireOwner } from "@/lib/auth";

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
        <h1 className="font-heading text-2xl">Not authorised</h1>
        <p>This account is not an owner of this shop.</p>
        <form action={signOut}>
          <button className="min-h-12 rounded-sm bg-primary px-4 text-sm uppercase tracking-[0.14em] text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Sign out</button>
        </form>
      </main>
    );
  }
  return (
    <div className="mx-auto min-h-screen max-w-2xl">
      <header className="flex items-center justify-between gap-3 px-4 pt-3">
        <p className="font-heading text-2xl leading-none">
          Zizu&apos;s <span className="hidden text-base text-muted-foreground min-[380px]:inline">for the shop</span>
        </p>
        <form action={signOut}>
          <button className="-mr-2 inline-flex min-h-12 whitespace-nowrap items-center gap-2 rounded-sm px-3 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">
            <LogOut aria-hidden className="size-4" />
            Sign out
          </button>
        </form>
      </header>
      <div className="p-4 pb-[calc(6rem+env(safe-area-inset-bottom))]">{children}</div>
      <AdminNav />
    </div>
  );
}
