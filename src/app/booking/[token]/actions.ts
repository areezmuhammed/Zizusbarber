"use server";

import { revalidatePath } from "next/cache";
import { cancelBookingByToken, eraseCustomerByToken, type CancelResult, type EraseResult } from "@/lib/customer-booking";

export async function cancelBooking(token: string): Promise<CancelResult> {
  const result = await cancelBookingByToken(String(token));
  revalidatePath(`/booking/${token}`);
  return result;
}

// No revalidate: the token is rotated, so a re-render would 404; the client shows its own done state instead.
export async function deleteMyData(token: string): Promise<EraseResult> {
  return eraseCustomerByToken(String(token));
}
