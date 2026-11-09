-- Live status (Task 12): shop_status is broadcast over Realtime; counts change by atomic delta.
alter publication supabase_realtime add table shop_status;

alter table shop_status
  add column updated_at timestamptz not null default now(),
  add constraint shop_status_in_shop_cap check (in_shop <= 50),
  add constraint shop_status_waiting_cap check (waiting <= 50),
  add constraint shop_status_note_len check (char_length(note) <= 80);

-- One UPDATE with the delta applied in SQL, so two quick taps never overwrite each other. Clamped to 0..50.
create or replace function bump_shop_status(p_field text, p_delta int)
returns void
language plpgsql security definer set search_path = '' as
$$
begin
  if not public.is_owner() then
    raise exception 'not_owner' using errcode = 'insufficient_privilege';
  end if;
  if p_field not in ('in_shop', 'waiting') or p_delta is null then
    raise exception 'invalid';
  end if;
  update public.shop_status set
    in_shop = case when p_field = 'in_shop' then greatest(0, least(50, in_shop + p_delta)) else in_shop end,
    waiting = case when p_field = 'waiting' then greatest(0, least(50, waiting + p_delta)) else waiting end,
    updated_at = now()
  where id; -- single row; the WHERE also satisfies the safe-update guard
end;
$$;

revoke all on function bump_shop_status(text, int) from public, anon;
grant execute on function bump_shop_status(text, int) to authenticated;
