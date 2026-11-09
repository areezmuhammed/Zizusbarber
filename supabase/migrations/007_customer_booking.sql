-- Customer self-service by secret cancel_token. Returns only that customer's own booking.
create function get_booking_by_token(p_token uuid)
returns table(
  service_name text, price_pence integer, duration_min integer,
  start_at timestamptz, end_at timestamptz, status text, first_name text, changes jsonb
)
language sql stable security definer set search_path = '' as
$$
  select s.name, s.price_pence, s.duration_min, b.start_at, b.end_at, b.status,
         split_part(btrim(b.customer_name), ' ', 1),
         coalesce((select jsonb_agg(jsonb_build_object(
                     'old_start', c.old_start, 'old_end', c.old_end,
                     'new_start', c.new_start, 'new_end', c.new_end,
                     'reason', c.reason, 'at', c.at) order by c.at)
                   from public.booking_changes c where c.booking_id = b.id), '[]'::jsonb)
  from public.bookings b join public.services s on s.id = b.service_id
  where b.cancel_token = p_token
$$;

create function cancel_booking_by_token(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = '' as
$$
declare
  -- configurable later (e.g. a shop setting); fixed at 24 hours for now
  c_cutoff constant interval := interval '24 hours';
  v_id uuid;
  v_status text;
  v_start timestamptz;
begin
  select b.id, b.status, b.start_at into v_id, v_status, v_start
  from public.bookings b where b.cancel_token = p_token for update;
  if v_id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if v_status not in ('confirmed', 'pending') then
    return jsonb_build_object('ok', false, 'reason', 'not_cancellable');
  end if;
  if v_start - c_cutoff < now() then return jsonb_build_object('ok', false, 'reason', 'too_late'); end if;
  update public.bookings set status = 'cancelled' where id = v_id;
  return jsonb_build_object('ok', true);
end
$$;

revoke execute on function get_booking_by_token(uuid) from public;
revoke execute on function cancel_booking_by_token(uuid) from public;
grant execute on function get_booking_by_token(uuid) to anon, authenticated;
grant execute on function cancel_booking_by_token(uuid) to anon, authenticated;
