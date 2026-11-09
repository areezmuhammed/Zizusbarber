// Runs due customer notifications once (called by pg_cron every 5 minutes; see docs/notifications.md).
// Thin Deno wrapper: all logic lives in src/lib/notify (one source of truth, unit-tested with Vitest).
import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { runNotifications, supabaseNotifyDb } from "../../../src/lib/notify/core.ts";
import { providersFromEnv } from "../../../src/lib/notify/providers.ts";
import { shopConfig } from "../../../shop.config.ts";

const env = Deno.env.toObject();

// The public can't trigger sends: only the shared CRON_SECRET header or the service-role key itself.
function allowed(req: Request) {
  const secret = env.CRON_SECRET;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return (!!secret && req.headers.get("x-cron-secret") === secret) || (!!env.SUPABASE_SERVICE_ROLE_KEY && bearer === env.SUPABASE_SERVICE_ROLE_KEY);
}

Deno.serve(async (req) => {
  if (!allowed(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { email, sms } = providersFromEnv(env);
  if (email.dryRun || sms.dryRun) console.warn("notify: provider credentials missing, logging instead of sending");
  try {
    const summary = await runNotifications({
      db: supabaseNotifyDb(db), email, sms, now: new Date(),
      shop: { name: shopConfig.name, phone: shopConfig.phone, siteUrl: env.SITE_URL ?? shopConfig.url },
    });
    return Response.json(summary);
  } catch (e) {
    console.error("notify failed", e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
});
