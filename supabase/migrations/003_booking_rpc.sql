-- Single-barber shop: bookings go to the first active barber.
create function create_booking(p_service uuid, p_start timestamptz, p_name text, p_phone text, p_email text)
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
begin
  if coalesce(btrim(p_name), '') = '' or coalesce(btrim(p_phone), '') = '' then
    raise exception 'invalid';
  end if;
  select duration_min into v_dur from public.services s where s.id = p_service and s.active;
  if v_dur is null then raise exception 'invalid'; end if;
  if p_start is null or p_start <= now() then raise exception 'past'; end if;
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

create function get_busy(p_from timestamptz, p_to timestamptz)
returns table(start_at timestamptz, end_at timestamptz)
language sql stable security definer set search_path = '' as
$$
  select b.start_at, b.end_at from public.bookings b
  where b.status in ('pending','confirmed','arrived') and b.start_at < p_to and b.end_at > p_from
$$;

revoke execute on function create_booking(uuid, timestamptz, text, text, text) from public;
revoke execute on function get_busy(timestamptz, timestamptz) from public;
grant execute on function create_booking(uuid, timestamptz, text, text, text) to anon, authenticated;
grant execute on function get_busy(timestamptz, timestamptz) to anon, authenticated;
