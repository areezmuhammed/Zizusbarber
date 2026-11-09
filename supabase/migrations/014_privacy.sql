-- Task 16: UK GDPR erasure and retention. See docs/privacy-ops.md.

-- Right to erasure from the customer's manage link. Anonymises EVERY booking on the same phone as the token's
-- booking. Trade-off: whoever holds a booking link can erase that phone number's bookings; accepted because the
-- link is a bearer credential sent only to that customer (same trust as cancel_booking_by_token).
-- Rows are kept (diary and takings stay intact); only the personal fields go. Future bookings are cancelled as
-- the customer ('customer' = no shop-cancel notice). Every token is rotated so old links stop working.
create function anonymise_customer_by_token(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = '' as
$$
declare
  v_phone text;
  v_ids uuid[];
begin
  select b.phone into v_phone from public.bookings b where b.cancel_token = p_token;
  if v_phone is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;

  select array_agg(b.id) into v_ids from (
    select id from public.bookings where phone = v_phone order by id for update
  ) b;

  update public.bookings set status = 'cancelled', cancelled_by = 'customer'
  where id = any(v_ids) and status in ('pending', 'confirmed') and start_at > now();

  update public.bookings set
    customer_name = 'Deleted customer',
    phone = 'deleted-' || substr(md5(gen_random_uuid()::text), 1, 8), -- random per row: not reversible, not linkable
    email = '',
    cancel_token = gen_random_uuid()
  where id = any(v_ids);

  update public.notifications set error = null where booking_id = any(v_ids); -- provider errors may echo a number

  return jsonb_build_object('ok', true, 'anonymised', cardinality(v_ids));
end
$$;
revoke execute on function anonymise_customer_by_token(uuid) from public;
grant execute on function anonymise_customer_by_token(uuid) to anon, authenticated;

-- Retention: anonymise bookings that ENDED more than p_older_than ago (default = shopConfig.privacy.retentionYears).
-- Service role / pg_cron only. Returns the number of rows anonymised.
create function anonymise_old_bookings(p_older_than interval default interval '2 years')
returns integer
language plpgsql security definer set search_path = '' as
$$
declare
  n integer;
begin
  with old as (
    select id from public.bookings
    where end_at < now() - p_older_than and phone not like 'deleted-%'
    for update
  ), done as (
    update public.bookings b set
      customer_name = 'Deleted customer',
      phone = 'deleted-' || substr(md5(gen_random_uuid()::text), 1, 8),
      email = '',
      cancel_token = gen_random_uuid()
    from old where b.id = old.id
    returning b.id
  ), notes as (
    update public.notifications nt set error = null from done where nt.booking_id = done.id
  )
  select count(*) into n from done;
  return n;
end
$$;
revoke execute on function anonymise_old_bookings(interval) from public, anon, authenticated;
grant execute on function anonymise_old_bookings(interval) to service_role;

-- Daily at 03:15 UTC (pg_cron enabled in 012). No secrets needed.
select cron.schedule('anonymise-old-bookings', '15 3 * * *', $job$select public.anonymise_old_bookings()$job$);
