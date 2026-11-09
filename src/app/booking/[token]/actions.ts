"use server";

import { revalidatePath } from "next/cache";
import { cancelBookingByToken, type CancelResult } from "@/lib/customer-booking";

export async function cancelBooking(token: string): Promise<CancelResult> {
  const result = await cancelBookingByToken(String(token));
  revalidatePath(`/booking/${token}`);
  return result;
}
