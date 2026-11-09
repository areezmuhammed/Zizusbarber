create function is_owner() returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.owners where user_id = (select auth.uid())) $$;

alter table owners enable row level security;
alter table barbers enable row level security;
alter table services enable row level security;
alter table opening_hours enable row level security;
alter table closures enable row level security;
alter table bookings enable row level security;
alter table booking_changes enable row level security;
alter table shop_status enable row level security;
alter table gallery enable row level security;

-- public read
create policy public_read on barbers for select using (true);
create policy public_read on services for select using (true);
create policy public_read on opening_hours for select using (true);
create policy public_read on closures for select using (true);
create policy public_read on shop_status for select using (true);
create policy public_read on gallery for select using (true);

-- owner-only writes (and owner-only read for private tables)
create policy owner_write on barbers for all to authenticated using (is_owner()) with check (is_owner());
create policy owner_write on services for all to authenticated using (is_owner()) with check (is_owner());
create policy owner_write on opening_hours for all to authenticated using (is_owner()) with check (is_owner());
create policy owner_write on closures for all to authenticated using (is_owner()) with check (is_owner());
create policy owner_write on shop_status for all to authenticated using (is_owner()) with check (is_owner());
create policy owner_write on gallery for all to authenticated using (is_owner()) with check (is_owner());
create policy owner_all on bookings for all to authenticated using (is_owner()) with check (is_owner());
create policy owner_all on booking_changes for all to authenticated using (is_owner()) with check (is_owner());
create policy owner_read on owners for select to authenticated using (user_id = (select auth.uid()));
