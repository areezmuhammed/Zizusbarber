const ZONE = "Europe/London";
const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, hour: "2-digit", minute: "2-digit" });

export const time = (iso: string) => fmt.format(new Date(iso));
export const range = (start: string, end: string) => `${time(start)}–${time(end)}`;
export const firstName = (name: string) => name.trim().split(/\s+/)[0];

export const btn =
  "flex min-h-12 items-center justify-center rounded-xl px-4 text-base font-medium disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
export const field =
  "mt-1.5 block min-h-12 w-full rounded-xl border border-input bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-primary";
