# Customer notifications

Transactional only (PECR): booking confirmation, reminders, change and shop-cancel notices. No marketing, and no
customer-typed text (e.g. the name) is ever put in a message.

## What is sent

| Kind | When (decided on UTC instants) | Channel |
|---|---|---|
| `confirmation` | within 24h of the booking being created | email, or SMS if no email |
| `reminder_24h` | `start - 24h <= now < start - 2h`, only if booked before `start - 24h` | SMS |
| `reminder_2h` | `start - 2h <= now < start`, only if booked before `start - 2h` | email, or SMS if no email |
| `changed` | latest `booking_changes` row not yet notified (moved, or own length changed) | SMS |
| `cancelled_by_shop` | owner cancelled (`bookings.cancelled_by = 'shop'`); customer self-cancel sends nothing | SMS |

Only `pending`/`confirmed` bookings that have not started get anything (plus the shop-cancel notice).
Times are shown in Europe/London, e.g. `Tue 4 Nov, 14:20`, with the manage link `SITE_URL/booking/<token>`.

## How it works

- Logic: `src/lib/notify/core.ts` (pure, no imports) and `src/lib/notify/providers.ts` (Resend, Twilio, console).
  One source of truth, used by Vitest, `npm run notify:once` and the Edge Function `supabase/functions/notify`.
- Idempotency: table `notifications`, unique per (booking, kind, change). A row is CLAIMED (inserted, `pending`)
  before sending, then marked `sent` / `failed` / `skipped`. A failed send is retried on later runs, at most 3
  attempts. A crash between send and mark leaves it `pending`: never sent twice. One provider failure never stops
  the run.
- `skipped`: no provider credentials (logged only), or the phone is not E.164.
- Schedule: `pg_cron` job `notify-every-5-min` (migration `012_notify_cron.sql`) POSTs to the function with an
  `x-cron-secret` header. URL and secret come from Supabase Vault; with no Vault secrets the job does nothing.
- Latency: confirmations go out on the next run (up to 5 minutes). No immediate send from the Next.js app (it
  would need the service role key and provider secrets in Vercel).

## Production setup

1. Provider accounts: Resend (verify the sending domain) and Twilio (UK-capable sender). Confirm prices/limits.
2. Function secrets (never commit values):
   ```sh
   npx supabase secrets set CRON_SECRET=<long random> SITE_URL=https://zizusbarbers.com \
     RESEND_API_KEY=... EMAIL_FROM="Zizu's Barbers <bookings@zizusbarbers.com>" \
     TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_FROM=+44...
   ```
   Without the provider secrets the function only logs messages and marks them `skipped`.
3. Deploy: `npx supabase functions deploy notify` (`verify_jwt = false` is set in `supabase/config.toml`; the
   function checks `x-cron-secret`, or a service-role bearer token, itself and answers 401 otherwise).
4. `npx supabase db push` applies the migrations (pg_cron and pg_net are enabled by `012_notify_cron.sql`).
5. Vault secrets, in the SQL editor (same CRON_SECRET as step 2):
   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/notify', 'notify_url');
   select vault.create_secret('<the CRON_SECRET value>', 'cron_secret');
   ```
6. Check: `select * from cron.job_run_details order by start_time desc limit 5;`,
   `select status_code, content from net._http_response order by id desc limit 5;` and the `notifications` table.

## Local development

- `npm run notify:once`: one run against the local DB with console providers (never sends).
- Edge Function: `npx supabase functions serve notify --env-file <file with CRON_SECRET=...>`, then
  `curl -X POST -H "x-cron-secret: ..." http://127.0.0.1:56321/functions/v1/notify` returns `{sent, failed, skipped}`.
- Tests: `npm test` (`src/lib/notify/*.test.ts`, integration test needs the local stack) and
  `npx supabase test db` (`supabase/tests/notifications.sql`).
