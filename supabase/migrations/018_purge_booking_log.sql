-- 018: make the "kept 24 hours" promise true even when nobody books. create_booking still purges opportunistically;
-- this daily job (pg_cron enabled in 012) deletes anything older than 24 hours regardless.
create function public.purge_public_booking_log()
returns int
language plpgsql security definer set search_path = '' as
$$
declare n int;
begin
  delete from public.public_booking_log where created_at < now() - interval '24 hours';
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.purge_public_booking_log() from public, anon, authenticated;
grant execute on function public.purge_public_booking_log() to service_role;

-- Hourly at :05. cron.schedule with an existing job name replaces it, so this is idempotent.
select cron.schedule('purge-public-booking-log', '5 * * * *', $job$select public.purge_public_booking_log()$job$);
