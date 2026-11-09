"use client";
import { useActionState } from "react";
import { sendLink } from "../actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(sendLink, { sent: false });
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-4">
      <h1 className="text-2xl font-bold">Admin sign in</h1>
      {state.sent ? (
        <p role="status">If that address belongs to an owner, a sign-in link is on its way. Check your email.</p>
      ) : (
        <form action={action} className="flex flex-col gap-3">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="rounded border p-3" />
          <button type="submit" disabled={pending} className="rounded bg-black p-3 text-white">
            Email me a sign-in link
          </button>
        </form>
      )}
    </main>
  );
}
