begin;
select plan(11);

-- returns the error message of a statement, or null if it succeeded (rolled back with the test)
create function public.t_err(q text) returns text language plpgsql as
$$ begin execute q; return null; exception when others then return sqlerrm; end $$;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000c1'), ('00000000-0000-0000-0000-0000000000c2');
insert into owners (user_id) values ('00000000-0000-0000-0000-0000000000c2');

insert into bookings (id, barber_id, service_id, customer_name, phone, email, start_at, end_at, status)
select v.id::uuid, '00000000-0000-0000-0000-000000000001', (select id from services where name = 'Hair Cut'),
       v.n, '0700', 'x@x.test', v.s::timestamptz, v.e::timestamptz, 'confirmed'
from (values
  -- 2030-06-04 (Tue, BST): close 20:00 BST = 19:00Z
  ('00000000-0000-0000-0000-0000000005a0', 'S0', '2030-06-04 18:00+00', '2030-06-04 18:20+00'),
  ('00000000-0000-0000-0000-0000000005a1', 'S1', '2030-06-04 18:20+00', '2030-06-04 18:50+00'),
  -- 2030-01-08 (Tue, GMT): 10-minute gap before P1
  ('00000000-0000-0000-0000-0000000006a0', 'P0', '2030-01-08 10:00+00', '2030-01-08 10:20+00'),
  ('00000000-0000-0000-0000-0000000006a1', 'P1', '2030-01-08 10:30+00', '2030-01-08 11:00+00'),
  -- 2030-01-09 last booking, 2030-01-10 first booking
  ('00000000-0000-0000-0000-0000000007a0', 'N0', '2030-01-09 19:30+00', '2030-01-09 19:50+00'),
  ('00000000-0000-0000-0000-0000000007a1', 'N1', '2030-01-10 09:30+00', '2030-01-10 10:00+00')
) v(id, n, s, e);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
set local role authenticated;

-- closing time judged in London time: S1 pushed to 18:40Z-19:10Z = 19:40-20:10 BST, past the 20:00 close.
-- (In UTC 19:10 is before 20:00, so a UTC comparison would wrongly allow it.)
select is(extend_booking('00000000-0000-0000-0000-0000000005a0', '2030-06-04 18:40+00', 'bst'),
  '{"ok": false, "conflicts": ["00000000-0000-0000-0000-0000000005a1"]}'::jsonb, 'BST: push ending 20:10 local is a conflict');
select is((select end_at from bookings where customer_name = 'S1'), '2030-06-04 18:50+00'::timestamptz, 'BST conflict changes nothing');
-- ending exactly at 20:00 BST is fine
select is(extend_booking('00000000-0000-0000-0000-0000000005a0', '2030-06-04 18:30+00', 'bst ok'),
  '{"ok": true, "moved": ["00000000-0000-0000-0000-0000000005a1"]}'::jsonb, 'BST: push ending exactly 20:00 local is allowed');

-- partial gap absorption: +20 min, the 10-minute gap absorbs half, P1 moves by only 10
select is(extend_booking('00000000-0000-0000-0000-0000000006a0', '2030-01-08 10:40+00', 'gap'),
  '{"ok": true, "moved": ["00000000-0000-0000-0000-0000000006a1"]}'::jsonb, 'gap: later booking moved');
select is((select tstzrange(start_at, end_at) from bookings where customer_name = 'P1'),
  tstzrange('2030-01-08 10:40+00', '2030-01-08 11:10+00'), 'gap: moved by 10 min, less than the 20 min extension');

-- exclusion violation is mapped to a readable error and nothing is written
select throws_ok($$select extend_booking('00000000-0000-0000-0000-0000000007a0', '2030-01-10 09:45+00', 'x')$$,
  'P0001', 'slot_taken', 'overlap with a booking outside the pushed day gives slot_taken');
select is((select end_at from bookings where customer_name = 'N0'), '2030-01-09 19:50+00'::timestamptz, 'slot_taken leaves target unchanged');

-- re-read after lock: a cancelled target is refused
reset role;
update bookings set status = 'cancelled' where customer_name = 'N0';
set local role authenticated;
select throws_ok($$select extend_booking('00000000-0000-0000-0000-0000000007a0', '2030-01-09 20:00+00', 'x')$$,
  'P0001', 'booking_not_found', 'cancelled target refused');

-- owner walk-in may start up to 5 minutes ago (it may still fail on hours, but never as 'past')
select isnt(public.t_err($$select * from create_booking((select id from services where name = 'Hair Cut'),
  now() - interval '2 minutes', 'Walk', '+447700900123', '')$$), 'past', 'owner: 2 minutes ago is not past');
select is(public.t_err($$select * from create_booking((select id from services where name = 'Hair Cut'),
  now() - interval '6 minutes', 'Walk', '+447700900123', '')$$), 'past', 'owner: 6 minutes ago is past');

-- a signed-in non-owner keeps the future-only rule
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is(public.t_err($$select * from create_booking((select id from services where name = 'Hair Cut'),
  now() - interval '2 minutes', 'Walk', '+447700900123', '')$$), 'past', 'non-owner: 2 minutes ago is past');

reset role;
select * from finish();
rollback;
