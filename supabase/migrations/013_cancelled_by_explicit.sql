-- Task 15 fix: who cancelled is set EXPLICITLY by each path instead of inferred from is_owner()
-- (an owner signed in while using a customer's manage link was recorded as 'shop').
-- - cancel_booking_by_token (customer manage link): 'customer', whoever is signed in.
-- - admin setStatus (src/app/admin/bookings.ts): 'shop', in the same UPDATE.
-- - anything else that cancels without setting it (service role, Supabase dashboard, SQL): 'shop', so the customer
--   IS told; a wrong "sorry, we had to cancel" beats a customer turning up to a cancelled slot.

create or replace function cancel_booking_by_token(p_token uuid)
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
  update public.bookings set status = 'cancelled', cancelled_by = 'customer' where id = v_id;
  return jsonb_build_object('ok', true);
end
$$;

create or replace function set_cancelled_by() returns trigger
language plpgsql security definer set search_path = '' as
$$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    new.cancelled_by := coalesce(new.cancelled_by, 'shop'); -- fallback only; the app paths set it explicitly
  end if;
  return new;
end
$$;
