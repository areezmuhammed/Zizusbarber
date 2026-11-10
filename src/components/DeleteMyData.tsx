"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { deleteMyData } from "@/app/booking/[token]/actions";
import { intlPhone } from "@/lib/format";
import { shopConfig } from "../../shop.config";

const btn =
  "flex min-h-12 w-full items-center justify-center rounded-full px-5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

type Step = "idle" | "confirm" | "done" | "failed";

// Two-step erase: the first press only explains, the second deletes. Focus follows each step.
export function DeleteMyData({ token }: { token: string }) {
  const [step, setStep] = useState<Step>("idle");
  const [pending, start] = useTransition();
  const focus = useRef<HTMLElement | null>(null);
  const moved = useRef(false);

  useEffect(() => {
    if (moved.current) focus.current?.focus();
    moved.current = true;
  }, [step]);

  function erase() {
    start(async () => setStep((await deleteMyData(token)).ok ? "done" : "failed"));
  }

  const ref = (el: HTMLElement | null) => {
    focus.current = el;
  };

  if (step === "done")
    return (
      <p ref={ref} tabIndex={-1} role="status" className="rounded-xl border border-border bg-card p-4 text-sm outline-none">
        Your details have been deleted from this booking. If it was upcoming it is cancelled, and this link no longer
        works. To delete everything else we hold about you, call {shopConfig.phone} or email {shopConfig.email}.
      </p>
    );
  if (step === "failed")
    return (
      <p ref={ref} tabIndex={-1} role="alert" className="text-sm text-destructive outline-none">
        Your details could not be deleted. Call {shopConfig.phone} and we will do it for you.
      </p>
    );
  if (step === "idle")
    return (
      <button ref={ref} type="button" onClick={() => setStep("confirm")} className={`${btn} text-muted-foreground underline underline-offset-4`}>
        Delete my data
      </button>
    );
  return (
    <div role="group" aria-label="Confirm deleting your data" className="grid gap-2 rounded-xl border border-border p-4">
      <p className="text-sm">
        This removes your name, phone number and email from this booking and cancels it if it is still upcoming. It
        cannot be undone. Other bookings are not changed: to delete everything we hold about you, call{" "}
        <a href={`tel:+${intlPhone(shopConfig.phone)}`} className="text-primary underline underline-offset-4">
          {shopConfig.phone}
        </a>{" "}
        or email{" "}
        <a href={`mailto:${shopConfig.email}`} className="text-primary underline underline-offset-4">
          {shopConfig.email}
        </a>
        .
      </p>
      <button type="button" onClick={erase} disabled={pending} className={`${btn} bg-destructive text-background`}>
        {pending ? "Deleting…" : "Yes, delete my data"}
      </button>
      <button ref={ref} type="button" onClick={() => setStep("idle")} disabled={pending} className={`${btn} border border-border`}>
        Keep my data
      </button>
    </div>
  );
}
