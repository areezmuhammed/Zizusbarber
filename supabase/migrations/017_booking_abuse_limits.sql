-- Abuse limits for the public (anon key) create_booking. The anon key is public, so a script can call the RPC
-- directly and skip the Vercel firewall. Two attacks remained after 016:
--   a) rotating fake UK mobiles fill the diary, each booking texting a random member of the public;
--   b) one phone: book -> confirmation text goes out -> cancel (or "delete my data") -> book again, forever.
-- Fix: every PUBLIC booking is logged in public_booking_log (md5 of the phone + time, kept 24h) and create_booking
-- rejects a public booking when
--   - that phone already has 5 public bookings created in the last 24h, any status ('too_many_bookings'), or
--   - the shop already has 20 public bookings created in the last hour ('busy').
-- A separate log rather than counting bookings rows: cancelling, "delete my data" (which replaces the phone) and
-- deleting rows must not free the allowance. The owner's bookings are never logged, so they never count.
-- Everything else in create_booking is exactly as in 016.

create table public_booking_log (
  phone_hash text not null,                       -- md5(stored +44 phone): no raw number kept
  created_at timestamptz not null default now()
);
create index public_booking_log_created_at on public_booking_log (created_at);
create index public_booking_log_phone_hash on public_booking_log (phone_hash, created_at);
alter table public_booking_log enable row level security; -- no policies: only security definer code reads it
revoke all on public_booking_log from anon, authenticated;

create or replace function create_booking(p_service uuid, p_start timestamptz, p_name text, p_phone text, p_email text)
returns table(id uuid, cancel_token text)
language plpgsql security definer set search_path = '' as
$$
declare
  -- Public booking limits (017). Real volume is a few online bookings an hour, so these only stop scripts.
  -- To raise them: a new migration that create-or-replaces this function with bigger numbers.
  c_phone_per_day constant int := 5;   -- bookings created per phone in 24h, cancelled included
  c_shop_per_hour constant int := 20;  -- public bookings created shop-wide in the last hour
  v_dur int;
  v_barber uuid;
  v_end timestamptz;
  v_ls timestamp;
  v_le timestamp;
  v_open time;
  v_close time;
  v_closure public.closures;
  v_id uuid;
  v_tok uuid;
  v_grace interval := interval '0';
  v_owner boolean := public.is_owner();
  v_phone text := btrim(p_phone);
  v_email text := coalesce(btrim(p_email), '');
begin
  if coalesce(btrim(p_name), '') = '' or coalesce(v_phone, '') = '' then
    raise exception 'invalid';
  end if;
  -- UK numbers only, stored as +44 then the national number (src/lib/booking-form.ts normalisePhone)
  if v_phone !~ '^\+44[1235789]\d{8,9}$' then raise exception 'invalid'; end if;
  -- same caps as validateDetails
  if char_length(btrim(p_name)) > 100 or char_length(v_email) > 254
     or (v_email <> '' and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$') then
    raise exception 'invalid';
  end if;
  select duration_min into v_dur from public.services s where s.id = p_service and s.active;
  if v_dur is null then raise exception 'invalid'; end if;
  -- owner walk-ins may start now (up to 5 minutes ago); customers must book a future time
  if v_owner then v_grace := interval '5 minutes'; end if;
  if p_start is null or p_start <= now() - v_grace then raise exception 'past'; end if;
  -- the public can book at most 90 days ahead
  if not v_owner and p_start > now() + interval '90 days' then raise exception 'too_far'; end if;
  select b.id into v_barber from public.barbers b where b.active order by b.name limit 1;
  if v_barber is null then raise exception 'invalid'; end if;

  v_end := p_start + make_interval(mins => v_dur);
  v_ls := p_start at time zone 'Europe/London';
  v_le := v_end at time zone 'Europe/London';

  select * into v_closure from public.closures c where c.date = v_ls::date limit 1;
  if found then
    v_open := v_closure.open_local;   -- null = closed all day
    v_close := v_closure.close_local;
  else
    select min(h.open_local), max(h.close_local) into v_open, v_close
    from public.opening_hours h
    where h.weekday = extract(dow from v_ls) and (h.barber_id is null or h.barber_id = v_barber);
  end if;
  if v_open is null or v_close is null or v_le::date <> v_ls::date
     or v_ls::time < v_open or v_le::time > v_close then
    raise exception 'outside_hours';
  end if;

  if not v_owner then
    -- One global lock serialises every public booking, so concurrent calls cannot all slip under a cap (it also
    -- covers the per-phone checks that had their own lock in 016). Coarse on purpose: one chair, a handful of
    -- bookings an hour, and the lock is held only for this short transaction.
    perform pg_advisory_xact_lock(hashtext('create_booking:public'));
    delete from public.public_booking_log l where l.created_at < now() - interval '24 hours'; -- 24h retention
    -- at most 3 upcoming bookings per phone (016)
    if (select count(*) from public.bookings b
        where b.phone = v_phone and b.status in ('pending', 'confirmed') and b.start_at > now()) >= 3 then
      raise exception 'too_many_bookings';
    end if;
    if (select count(*) from public.public_booking_log l
        where l.phone_hash = md5(v_phone) and l.created_at > now() - interval '24 hours') >= c_phone_per_day then
      raise exception 'too_many_bookings';
    end if;
    if (select count(*) from public.public_booking_log l
        where l.created_at > now() - interval '1 hour') >= c_shop_per_hour then
      raise exception 'busy';
    end if;
  end if;

  begin
    insert into public.bookings as b (barber_id, service_id, customer_name, phone, email, start_at, end_at, status)
    values (v_barber, p_service, btrim(p_name), v_phone, v_email, p_start, v_end, 'confirmed')
    returning b.id, b.cancel_token into v_id, v_tok;
  exception when exclusion_violation then
    raise exception 'slot_taken';
  end;
  -- only bookings that were made (and so get a confirmation) use up the allowance
  if not v_owner then insert into public.public_booking_log (phone_hash) values (md5(v_phone)); end if;
  return query select v_id, v_tok::text;
end
$$;
