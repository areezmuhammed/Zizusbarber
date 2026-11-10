-- Final review hardening.
-- 1. anonymise_customer_by_token erases ONLY the booking the token belongs to. Phones are unverified, so erasing
--    every booking on the same phone let a stranger book with a victim's number and then wipe (and silently
--    cancel) the victim's bookings. Whole-customer erasure is an owner job after verification (docs/privacy-ops.md).
-- 2. create_booking (anon-callable): UK-only phone in stored +44 form, length/email caps, a 90-day horizon and at
--    most 3 upcoming bookings per phone for the public (owner exempt from the horizon and the cap). Stops SMS
--    pumping to arbitrary numbers and filling the diary for years. All earlier rules are unchanged.
-- 3. get_busy clamps its range to 31 days. 4. shop_status row exists without seed.sql. 5. Lookup indexes.

create or replace function anonymise_customer_by_token(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = '' as
$$
declare
  v_id uuid;
begin
  select b.id into v_id from public.bookings b where b.cancel_token = p_token for update;
  if v_id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;

  update public.bookings set status = 'cancelled', cancelled_by = 'customer'
  where id = v_id and status in ('pending', 'confirmed') and start_at > now();

  update public.bookings set
    customer_name = 'Deleted customer',
    phone = 'deleted-' || substr(md5(gen_random_uuid()::text), 1, 8), -- random: not reversible, not linkable
    email = '',
    cancel_token = gen_random_uuid()
  where id = v_id;

  update public.notifications set error = null where booking_id = v_id; -- provider errors may echo a number
  update public.booking_changes set reason = null where booking_id = v_id; -- owner free text may name them

  return jsonb_build_object('ok', true, 'anonymised', 1);
end
$$;
revoke execute on function anonymise_customer_by_token(uuid) from public;
grant execute on function anonymise_customer_by_token(uuid) to anon, authenticated;

-- Same as 009 plus the checks marked NEW. BOOKING_HORIZON_DAYS in src/lib/booking-form.ts must match the 90 below.
create or replace function create_booking(p_service uuid, p_start timestamptz, p_name text, p_phone text, p_email text)
returns table(id uuid, cancel_token text)
language plpgsql security definer set search_path = '' as
$$
declare
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
  -- NEW: UK numbers only, stored as +44 then the national number (src/lib/booking-form.ts normalisePhone)
  if v_phone !~ '^\+44[1235789]\d{8,9}$' then raise exception 'invalid'; end if;
  -- NEW: same caps as validateDetails
  if char_length(btrim(p_name)) > 100 or char_length(v_email) > 254
     or (v_email <> '' and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$') then
    raise exception 'invalid';
  end if;
  select duration_min into v_dur from public.services s where s.id = p_service and s.active;
  if v_dur is null then raise exception 'invalid'; end if;
  -- owner walk-ins may start now (up to 5 minutes ago); customers must book a future time
  if v_owner then v_grace := interval '5 minutes'; end if;
  if p_start is null or p_start <= now() - v_grace then raise exception 'past'; end if;
  -- NEW: the public can book at most 90 days ahead
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

  -- NEW: at most 3 upcoming bookings per phone for the public; the lock serialises concurrent calls per phone
  if not v_owner then
    perform pg_advisory_xact_lock(hashtext('create_booking:' || v_phone));
    if (select count(*) from public.bookings b
        where b.phone = v_phone and b.status in ('pending', 'confirmed') and b.start_at > now()) >= 3 then
      raise exception 'too_many_bookings';
    end if;
  end if;

  begin
    insert into public.bookings as b (barber_id, service_id, customer_name, phone, email, start_at, end_at, status)
    values (v_barber, p_service, btrim(p_name), v_phone, v_email, p_start, v_end, 'confirmed')
    returning b.id, b.cancel_token into v_id, v_tok;
  exception when exclusion_violation then
    raise exception 'slot_taken';
  end;
  return query select v_id, v_tok::text;
end
$$;

-- Same as 003, but a range is clamped to 31 days from p_from (the booking UI asks for one day at a time).
create or replace function get_busy(p_from timestamptz, p_to timestamptz)
returns table(start_at timestamptz, end_at timestamptz)
language sql stable security definer set search_path = '' as
$$
  select b.start_at, b.end_at from public.bookings b
  where b.status in ('pending','confirmed','arrived')
    and b.start_at < least(p_to, p_from + interval '31 days') and b.end_at > p_from
$$;

-- The single status row (id = true) used to come from seed.sql only; a fresh `db push` had none.
insert into public.shop_status (id) values (true) on conflict do nothing;

create index if not exists bookings_start_at on public.bookings (start_at);
create index if not exists bookings_phone on public.bookings (phone);
create index if not exists booking_changes_booking_id on public.booking_changes (booking_id);
