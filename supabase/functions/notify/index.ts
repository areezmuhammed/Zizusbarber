// Runs due customer notifications once (called by pg_cron every 5 minutes; see docs/notifications.md).
// Thin Deno wrapper: all logic lives in src/lib/notify (one source of truth, unit-tested with Vitest).
import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { runNotifications, supabaseNotifyDb } from "../../../src/lib/notify/core.ts";
import { missingProviderEnv, providersFromEnv } from "../../../src/lib/notify/providers.ts";
import { shopConfig } from "../../../shop.config.ts";

const env = Deno.env.toObject();

// constant-time: compare SHA-256 digests (equal length) with no early exit
async function same(a: string, b: string) {
  const h = async (s: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  const [x, y] = await Promise.all([h(a), h(b)]);
  return x.reduce((d, v, i) => d | (v ^ y[i]), 0) === 0;
}

// The public can't trigger sends: only the shared CRON_SECRET header or the service-role key itself.
async function allowed(req: Request) {
  const header = req.headers.get("x-cron-secret");
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return (!!env.CRON_SECRET && header != null && (await same(header, env.CRON_SECRET))) ||
    (!!env.SUPABASE_SERVICE_ROLE_KEY && bearer != null && (await same(bearer, env.SUPABASE_SERVICE_ROLE_KEY)));
}

Deno.serve(async (req) => {
  if (!(await allowed(req))) return Response.json({ error: "unauthorized" }, { status: 401 });
  // Fail closed BEFORE claiming any row: nothing is lost, the first run after the secrets are set sends it all.
  const missing = missingProviderEnv(env);
  if (missing.length) {
    console.error(`notify: not configured, missing secrets: ${missing.join(", ")}`);
    return Response.json({ error: "not_configured", missing }, { status: 503 });
  }
  const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { email, sms } = providersFromEnv(env);
  try {
    const summary = await runNotifications({
      db: supabaseNotifyDb(db), email, sms, now: new Date(),
      shop: { name: shopConfig.name, phone: shopConfig.phone, siteUrl: env.SITE_URL },
    });
    return Response.json(summary);
  } catch (e) {
    console.error("notify failed", e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
});
