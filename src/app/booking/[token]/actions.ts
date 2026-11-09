"use server";

import { revalidatePath } from "next/cache";
import {
  cancelBookingByToken, eraseCustomerByToken, stopRemindersByToken, type CancelResult, type EraseResult,
} from "@/lib/customer-booking";

export async function cancelBooking(token: string): Promise<CancelResult> {
  const result = await cancelBookingByToken(String(token));
  revalidatePath(`/booking/${token}`);
  return result;
}

// No revalidate: the token is rotated, so a re-render would 404; the client shows its own done state instead.
export async function deleteMyData(token: string): Promise<EraseResult> {
  try {
    return await eraseCustomerByToken(String(token));
  } catch {
    return { ok: false, reason: "failed" }; // shown as "could not delete", never the error page
  }
}

export async function stopReminders(token: string): Promise<{ ok: boolean }> {
  try {
    const r = await stopRemindersByToken(String(token));
    if (r.ok) revalidatePath(`/booking/${token}`);
    return r;
  } catch {
    return { ok: false };
  }
}
