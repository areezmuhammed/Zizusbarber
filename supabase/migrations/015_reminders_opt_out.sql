-- Task 16 fix round 1.
-- 1. bookings.reminders_off: no reminder_24h / reminder_2h for that booking (confirmation, change and shop-cancel
--    notices still go: they are about the booking itself). Set by the customer (set_reminders_off_by_token) or the owner.
-- 2. Erasure and retention also scrub booking_changes.reason (owner free text that may name the customer).

alter table bookings add column reminders_off boolean not null default false;

create function set_reminders_off_by_token(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = '' as
$$
begin
  update public.bookings set reminders_off = true where cancel_token = p_token;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  return jsonb_build_object('ok', true);
end
$$;
revoke execute on function set_reminders_off_by_token(uuid) from public;
grant execute on function set_reminders_off_by_token(uuid) to anon, authenticated;

-- Same as 007 plus reminders_off (return type changes, so drop and recreate).
drop function get_booking_by_token(uuid);
create function get_booking_by_token(p_token uuid)
returns table(
  service_name text, price_pence integer, duration_min integer,
  start_at timestamptz, end_at timestamptz, status text, first_name text, changes jsonb, reminders_off boolean
)
language sql stable security definer set search_path = '' as
$$
  select s.name, s.price_pence, s.duration_min, b.start_at, b.end_at, b.status,
         split_part(btrim(b.customer_name), ' ', 1),
         coalesce((select jsonb_agg(jsonb_build_object(
                     'old_start', c.old_start, 'old_end', c.old_end,
                     'new_start', c.new_start, 'new_end', c.new_end,
                     'reason', c.reason, 'at', c.at) order by c.at)
                   from public.booking_changes c where c.booking_id = b.id), '[]'::jsonb),
         b.reminders_off
  from public.bookings b join public.services s on s.id = b.service_id
  where b.cancel_token = p_token
$$;
revoke execute on function get_booking_by_token(uuid) from public;
grant execute on function get_booking_by_token(uuid) to anon, authenticated;

-- Same as 014 plus the booking_changes.reason scrub.
create or replace function anonymise_customer_by_token(p_token uuid)
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
  update public.booking_changes set reason = null where booking_id = any(v_ids); -- owner free text may name them

  return jsonb_build_object('ok', true, 'anonymised', cardinality(v_ids));
end
$$;

create or replace function anonymise_old_bookings(p_older_than interval default interval '2 years')
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
  ), reasons as (
    update public.booking_changes c set reason = null from done where c.booking_id = done.id
  )
  select count(*) into n from done;
  return n;
end
$$;
