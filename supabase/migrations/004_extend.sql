-- Owner changes a booking's end; later bookings that now overlap are pushed by the minimum, in order.
-- Nothing is written if any pushed booking would end after that day's local closing time.
create function extend_booking(p_id uuid, p_new_end timestamptz, p_reason text)
returns jsonb
language plpgsql security definer set search_path = '' as
$$
declare
  t public.bookings;
  r record;
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

  select * into t from public.bookings b
  where b.id = p_id and b.status in ('pending','confirmed','arrived');
  if not found then raise exception 'booking_not_found'; end if;
  if p_new_end is null or p_new_end <= t.start_at then raise exception 'invalid'; end if;

  v_day := (t.start_at at time zone 'Europe/London')::date;

  -- lock the barber's active bookings for that local day, in time order
  perform 1 from public.bookings b
  where b.barber_id = t.barber_id and b.status in ('pending','confirmed','arrived')
    and b.start_at >= v_day::timestamp at time zone 'Europe/London'
    and b.start_at < (v_day + 1)::timestamp at time zone 'Europe/London'
  order by b.start_at
  for update;

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

  -- last-to-first so the per-row no_overlap check never sees a transient overlap
  for i in reverse cardinality(v_ids) .. 1 loop
    update public.bookings set start_at = v_ns[i], end_at = v_ne[i] where id = v_ids[i];
    insert into public.booking_changes (booking_id, old_start, old_end, new_start, new_end, reason)
    values (v_ids[i], v_os[i], v_oe[i], v_ns[i], v_ne[i], p_reason);
  end loop;
  update public.bookings set end_at = p_new_end where id = t.id;

  return jsonb_build_object('ok', true, 'moved', to_jsonb(v_ids));
end
$$;

revoke execute on function extend_booking(uuid, timestamptz, text) from public, anon;
grant execute on function extend_booking(uuid, timestamptz, text) to authenticated;
