"use client";

import { useState, useTransition } from "react";
import { cancelBooking } from "@/app/booking/[token]/actions";
import { shopConfig } from "../../shop.config";

const btn =
  "flex min-h-12 w-full items-center justify-center rounded-sm px-5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function CancelBooking({ token }: { token: string }) {
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function cancel() {
    start(async () => {
      const r = await cancelBooking(token);
      if (r.ok) return; // the action revalidates; the page re-renders as cancelled
      setConfirming(false);
      setFailure(
        r.reason === "too_late"
          ? `Too late to cancel online, please call ${shopConfig.phone}`
          : "This booking can no longer be cancelled online.",
      );
    });
  }

  if (failure) return <p role="alert" className="text-sm text-destructive">{failure}</p>;
  if (!confirming)
    return (
      <button type="button" onClick={() => setConfirming(true)} className={`${btn} border border-border`}>
        Cancel appointment
      </button>
    );
  return (
    <div role="group" aria-label="Confirm cancellation" className="grid gap-2">
      <p className="text-sm">Cancel this appointment?</p>
      <button type="button" onClick={cancel} disabled={pending} className={`${btn} bg-destructive text-background`}>
        {pending ? "Cancelling…" : "Yes, cancel it"}
      </button>
      <button type="button" onClick={() => setConfirming(false)} disabled={pending} className={`${btn} border border-border`}>
        Keep it
      </button>
    </div>
  );
}
