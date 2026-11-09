-- Customer notifications (Task 15).
-- 1. notifications: one row per (booking, kind, change); claimed BEFORE sending so nothing is ever sent twice.
-- 2. bookings.cancelled_by: 'shop' when an owner cancels (notice due), 'customer' for self-cancel (no notice).
-- 3. extend_booking (same signature as 009): also logs a booking_changes row for the TARGET booking when its
--    own end changes, so that customer is told as well. Everything else is identical to 009.

create table notifications (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings on delete cascade,
  kind text not null check (kind in ('confirmation','reminder_24h','reminder_2h','changed','cancelled_by_shop')),
  change_id uuid references booking_changes on delete cascade,
  channel text not null check (channel in ('email','sms')),
  status text not null default 'pending' check (status in ('pending','sent','failed','skipped')),
  attempts integer not null default 1,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint notifications_once unique nulls not distinct (booking_id, kind, change_id)
);
create index notifications_change_id on notifications (change_id);

alter table notifications enable row level security;
-- owner may read (dashboard); only the service role (Edge Function) writes, via claim_notification + update
create policy owner_read on notifications for select to authenticated using (is_owner());
revoke all on notifications from anon;
revoke insert, update, delete, truncate on notifications from authenticated;

-- Claims a notification for sending: a new row, or a failed one under the 3-attempt cap. Returns null otherwise
-- (already pending/sent/skipped, capped, or claimed by a parallel run).
create function claim_notification(p_booking uuid, p_kind text, p_change uuid, p_channel text)
returns uuid
language sql set search_path = '' as
$$
  insert into public.notifications as n (booking_id, kind, change_id, channel)
  values (p_booking, p_kind, p_change, p_channel)
  on conflict on constraint notifications_once do update
    set status = 'pending', attempts = n.attempts + 1, channel = excluded.channel, error = null
    where n.status = 'failed' and n.attempts < 3
  returning n.id
$$;
revoke execute on function claim_notification(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function claim_notification(uuid, text, uuid, text) to service_role;

alter table bookings add column cancelled_by text check (cancelled_by in ('shop','customer'));

-- Who cancelled: an owner session (admin setStatus) = 'shop'; anyone else (cancel_booking_by_token, anon) = 'customer'.
create function set_cancelled_by() returns trigger
language plpgsql security definer set search_path = '' as
$$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    new.cancelled_by := coalesce(new.cancelled_by, case when public.is_owner() then 'shop' else 'customer' end);
  end if;
  return new;
end
$$;
revoke execute on function set_cancelled_by() from public, anon, authenticated;
create trigger bookings_cancelled_by before update of status on bookings
  for each row execute function set_cancelled_by();

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
    -- the target's own customer is told too when its length changes (not notified once started; see notify core)
    if p_new_end <> t.end_at then
      insert into public.booking_changes (booking_id, old_start, old_end, new_start, new_end, reason)
      values (t.id, t.start_at, t.end_at, t.start_at, p_new_end, 'length changed');
    end if;
  exception when exclusion_violation then
    raise exception 'slot_taken';
  end;

  return jsonb_build_object('ok', true, 'moved', to_jsonb(v_ids));
end
$$;
