"use client";
import Image from "next/image";
import { useActionState } from "react";
import { sendLink } from "../actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(sendLink, { sent: false });
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-4">
      <Image
        src="/images/brand/placeholder-shop.webp"
        alt=""
        width={1120}
        height={1400}
        sizes="(min-width: 640px) 384px, 100vw"
        loading="eager"
        className="aspect-[3/2] w-full rounded-sm object-cover"
      />
      <p className="font-heading text-2xl leading-none">Zizu&apos;s</p>
      <h1 className="text-2xl font-bold">Admin sign in</h1>
      {state.sent ? (
        <p role="status">If that address belongs to an owner, a sign-in link is on its way. Check your email.</p>
      ) : (
        <form action={action} className="flex flex-col gap-3">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="min-h-12 rounded-sm border border-input bg-card px-3 text-base focus-visible:outline-2 focus-visible:outline-primary" />
          <button type="submit" disabled={pending} className="min-h-12 rounded-sm bg-primary px-4 text-sm uppercase tracking-[0.14em] text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50">
            Email me a sign-in link
          </button>
        </form>
      )}
    </main>
  );
}
