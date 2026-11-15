"use client";

import { useState, useTransition } from "react";
import { stopReminders } from "@/app/booking/[token]/actions";
import { shopConfig } from "../../shop.config";

export function StopReminders({ token, off }: { token: string; off: boolean }) {
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  if (off)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Reminder messages are off for this booking. We will still tell you if it changes or is cancelled.
      </p>
    );
  if (failed)
    return <p role="alert" className="text-sm text-destructive">That did not work. Call {shopConfig.phone} to stop reminders.</p>;
  return (
    <button
      type="button"
      disabled={pending}
      // success revalidates the page, which re-renders with off=true
      onClick={() => start(async () => setFailed(!(await stopReminders(token)).ok))}
      className="flex min-h-12 w-full items-center justify-center rounded-sm border border-border px-5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {pending ? "Stopping…" : "Stop reminder messages"}
    </button>
  );
}
