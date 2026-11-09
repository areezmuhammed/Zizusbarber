"use client";

import { useState, useTransition } from "react";
import { deleteMyData } from "@/app/booking/[token]/actions";
import { shopConfig } from "../../shop.config";

const btn =
  "flex min-h-12 w-full items-center justify-center rounded-full px-5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

// Two-step erase: the first press only explains, the second deletes.
export function DeleteMyData({ token }: { token: string }) {
  const [step, setStep] = useState<"idle" | "confirm" | "done" | "failed">("idle");
  const [pending, start] = useTransition();

  function erase() {
    start(async () => setStep((await deleteMyData(token)).ok ? "done" : "failed"));
  }

  if (step === "done")
    return (
      <p role="status" className="rounded-xl border border-border bg-card p-4 text-sm">
        Your details have been deleted. Any upcoming appointments are cancelled and this link no longer works.
      </p>
    );
  if (step === "failed")
    return <p role="alert" className="text-sm text-destructive">This link no longer works. Call {shopConfig.phone} for help.</p>;
  if (step === "idle")
    return (
      <button type="button" onClick={() => setStep("confirm")} className={`${btn} text-muted-foreground underline underline-offset-4`}>
        Delete my data
      </button>
    );
  return (
    <div role="group" aria-label="Confirm deleting your data" className="grid gap-2 rounded-xl border border-border p-4">
      <p className="text-sm">
        This removes your name, phone number and email from all your bookings with us and cancels any upcoming
        appointments. It cannot be undone.
      </p>
      <button type="button" onClick={erase} disabled={pending} className={`${btn} bg-destructive text-white`}>
        {pending ? "Deleting…" : "Yes, delete my data"}
      </button>
      <button type="button" onClick={() => setStep("idle")} disabled={pending} className={`${btn} border border-border`}>
        Keep my data
      </button>
    </div>
  );
}
