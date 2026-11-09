-- Calls the notify Edge Function every 5 minutes (Task 15). No secrets here: the function URL and the shared
-- CRON_SECRET are read from Supabase Vault at run time (see docs/notifications.md). Until both Vault secrets
-- exist the job does nothing, so local stacks and fresh projects never call anything.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule('notify-every-5-min', '*/5 * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'notify_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'notify_url')
    and exists (select 1 from vault.decrypted_secrets where name = 'cron_secret')
$job$);
