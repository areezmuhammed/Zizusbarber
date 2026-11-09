export const formatPrice = (pence: number) =>
  `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: pence % 100 ? 2 : 0 })}`;

// UK national number to E.164 digits without "+", e.g. "07535 423544" -> "447535423544"
export const intlPhone = (phone: string) => phone.replace(/\D/g, "").replace(/^0/, "44");

// DB `time` values are London wall-clock ("09:30:00"); show as "09:30"
export const hhmm = (t: string) => t.slice(0, 5);
