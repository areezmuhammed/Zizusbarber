-- Admin fixes (Task 11).
-- 1. extend_booking: the target row is re-read AFTER the day lock (and locked with it), so two owner sessions
--    acting on the same day are serialised and never act on stale start/end/status; an exclusion violation
--    (e.g. extending into a booking on the next day) is reported as 'slot_taken' instead of a raw 23P01.
-- 2. create_booking: an owner may book a walk-in up to 5 minutes in the past ("now" at the chair);
--    everyone else stays future-only. All other rules (hours, overlap) are unchanged.

create or replace function extend_booking(p_id uuid, p_new_end timestamptz, p_reason text)
returns jsonb
language plpgsql security definer set search_path = '' as
$$
declare
  t public.bookings;
  r record;
  v_barber uuid;
  v_day date;
  v_close time;
  v_closure public.closures;
  v_close_at timestamptz;
  v_prev_end timestamptz;
  v_new_end timestamptz;
  v_ids uuid[] := '{}';
  v_os timestamptz[] := '{}';
  v_oe timestamptz[] := '{}';
  v_ns timestamptz[] := '{}';
  v_ne timestamptz[] := '{}';
  v_conflicts uuid[] := '{}';
  i int;
begin
  if not public.is_owner() then
    raise exception 'not_owner' using errcode = 'insufficient_privilege';
  end if;

  -- unlocked read only to find which barber/day to lock
  select b.barber_id, (b.start_at at time zone 'Europe/London')::date into v_barber, v_day
  from public.bookings b where b.id = p_id;
  if not found then raise exception 'booking_not_found'; end if;

  -- lock the barber's active bookings for that local day, in time order
  perform 1 from public.bookings b
  where b.barber_id = v_barber and b.status in ('pending','confirmed','arrived')
    and b.start_at >= v_day::timestamp at time zone 'Europe/London'
    and b.start_at < (v_day + 1)::timestamp at time zone 'Europe/London'
  order by b.start_at
  for update;

  -- authoritative read after the lock: a concurrent session may have changed or cancelled it meanwhile
  select * into t from public.bookings b
  where b.id = p_id and b.status in ('pending','confirmed','arrived')
  for update;
  if not found or (t.start_at at time zone 'Europe/London')::date <> v_day or t.barber_id <> v_barber then
    raise exception 'booking_not_found';
  end if;
  if p_new_end is null or p_new_end <= t.start_at then raise exception 'invalid'; end if;

  select * into v_closure from public.closures c where c.date = v_day limit 1;
  if found then
    v_close := v_closure.close_local; -- null = closed all day
  else
    select max(h.close_local) into v_close from public.opening_hours h
    where h.weekday = extract(dow from v_day) and (h.barber_id is null or h.barber_id = t.barber_id);
  end if;
  v_close_at := coalesce((v_day + v_close) at time zone 'Europe/London', '-infinity');

  v_prev_end := p_new_end;
  for r in
    select b.id, b.start_at, b.end_at from public.bookings b
    where b.barber_id = t.barber_id and b.status in ('pending','confirmed','arrived')
      and b.id <> t.id and b.start_at >= t.start_at
      and b.start_at < (v_day + 1)::timestamp at time zone 'Europe/London'
    order by b.start_at
  loop
    exit when r.start_at >= v_prev_end; -- sorted and non-overlapping, so nothing later overlaps either
    v_new_end := v_prev_end + (r.end_at - r.start_at);
    if v_new_end > v_close_at then v_conflicts := v_conflicts || r.id; end if;
    v_ids := v_ids || r.id;
    v_os := v_os || r.start_at;
    v_oe := v_oe || r.end_at;
    v_ns := v_ns || v_prev_end;
    v_ne := v_ne || v_new_end;
    v_prev_end := v_new_end;
  end loop;

  if cardinality(v_conflicts) > 0 then
    return jsonb_build_object('ok', false, 'conflicts', to_jsonb(v_conflicts));
  end if;

  begin
    -- last-to-first so the per-row no_overlap check never sees a transient overlap
    for i in reverse cardinality(v_ids) .. 1 loop
      update public.bookings set start_at = v_ns[i], end_at = v_ne[i] where id = v_ids[i];
      insert into public.booking_changes (booking_id, old_start, old_end, new_start, new_end, reason)
      values (v_ids[i], v_os[i], v_oe[i], v_ns[i], v_ne[i], p_reason);
    end loop;
    update public.bookings set end_at = p_new_end where id = t.id;
  exception when exclusion_violation then
    raise exception 'slot_taken';
  end;

  return jsonb_build_object('ok', true, 'moved', to_jsonb(v_ids));
end
$$;

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
begin
  if coalesce(btrim(p_name), '') = '' or coalesce(btrim(p_phone), '') = '' then
    raise exception 'invalid';
  end if;
  select duration_min into v_dur from public.services s where s.id = p_service and s.active;
  if v_dur is null then raise exception 'invalid'; end if;
  -- owner walk-ins may start now (up to 5 minutes ago); customers must book a future time
  if public.is_owner() then v_grace := interval '5 minutes'; end if;
  if p_start is null or p_start <= now() - v_grace then raise exception 'past'; end if;
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

  begin
    insert into public.bookings as b (barber_id, service_id, customer_name, phone, email, start_at, end_at, status)
    values (v_barber, p_service, btrim(p_name), btrim(p_phone), coalesce(btrim(p_email), ''), p_start, v_end, 'confirmed')
    returning b.id, b.cancel_token into v_id, v_tok;
  exception when exclusion_violation then
    raise exception 'slot_taken';
  end;
  return query select v_id, v_tok::text;
end
$$;
