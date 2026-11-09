import { connection } from "next/server";
import { Settings } from "@/components/admin/Settings";
import { getSettings } from "@/lib/admin-data";
import { utcToLondon } from "@/lib/time";

export default async function SettingsPage() {
  await connection(); // "today" is per request
  const today = utcToLondon(new Date()).toISODate()!;
  const data = await getSettings(today); // checks the owner first
  return <Settings {...data} today={today} />;
}
