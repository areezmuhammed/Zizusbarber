// Local dev: run due notifications once against the local DB, logging instead of sending (never calls a provider).
// npm run notify:once   (reads .env.local for the local URL and service role key)
import { createClient } from "@supabase/supabase-js";
import { runNotifications, supabaseNotifyDb } from "../src/lib/notify/core.ts";
import { consoleEmail, consoleSms } from "../src/lib/notify/providers.ts";
import { shopConfig } from "../shop.config.ts";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const summary = await runNotifications({
  db: supabaseNotifyDb(db), email: consoleEmail, sms: consoleSms, now: new Date(),
  shop: { name: shopConfig.name, phone: shopConfig.phone, siteUrl: process.env.SITE_URL ?? "http://localhost:3000" },
});
console.log(summary);
