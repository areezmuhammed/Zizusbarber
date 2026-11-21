begin;
select plan(21);

-- seed: barber ...01, open Tue-Sun 09:30-20:00 London; Jan 2030 London = UTC
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000c1'), ('00000000-0000-0000-0000-0000000000c2');
insert into owners (user_id) values ('00000000-0000-0000-0000-0000000000c2');

insert into bookings (id, barber_id, service_id, customer_name, phone, email, start_at, end_at, status)
select v.id::uuid, '00000000-0000-0000-0000-000000000001', (select id from services where name = 'Hair Cut'),
       v.n, '0700', 'x@x.test', v.s::timestamptz, v.e::timestamptz, 'confirmed'
from (values
  -- day 1 (Tue): partial push, gap respected
  ('00000000-0000-0000-0000-0000000001a0', 'T1', '2030-01-01 10:00+00', '2030-01-01 10:20+00'),
  ('00000000-0000-0000-0000-0000000001a1', 'A',  '2030-01-01 10:20+00', '2030-01-01 10:50+00'),
  ('00000000-0000-0000-0000-0000000001a2', 'B',  '2030-01-01 11:30+00', '2030-01-01 12:00+00'),
  -- day 2 (Wed): cascade across 3
  ('00000000-0000-0000-0000-0000000002a0', 'T2', '2030-01-02 10:00+00', '2030-01-02 10:20+00'),
  ('00000000-0000-0000-0000-0000000002a1', 'C1', '2030-01-02 10:20+00', '2030-01-02 10:50+00'),
  ('00000000-0000-0000-0000-0000000002a2', 'C2', '2030-01-02 10:50+00', '2030-01-02 11:20+00'),
  ('00000000-0000-0000-0000-0000000002a3', 'C3', '2030-01-02 11:20+00', '2030-01-02 11:50+00'),
  ('00000000-0000-0000-0000-0000000002a4', 'D',  '2030-01-02 13:00+00', '2030-01-02 13:30+00'),
  -- day 3 (Thu): push past 20:00 close
  ('00000000-0000-0000-0000-0000000003a0', 'T3', '2030-01-03 19:00+00', '2030-01-03 19:20+00'),
  ('00000000-0000-0000-0000-0000000003a1', 'E',  '2030-01-03 19:20+00', '2030-01-03 19:40+00'),
  ('00000000-0000-0000-0000-0000000003a2', 'F',  '2030-01-03 19:40+00', '2030-01-03 20:00+00'),
  -- day 4 (Fri): shortening
  ('00000000-0000-0000-0000-0000000004a0', 'T4', '2030-01-04 10:00+00', '2030-01-04 10:40+00'),
  ('00000000-0000-0000-0000-0000000004a1', 'G',  '2030-01-04 10:40+00', '2030-01-04 11:10+00'),
  -- day 5 (Sat): the target is the last appointment of the day
  ('00000000-0000-0000-0000-0000000005a0', 'T5', '2030-01-05 19:30+00', '2030-01-05 19:50+00')
) v(id, n, s, e);

-- non-owner refused
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select extend_booking('00000000-0000-0000-0000-0000000001a0', '2030-01-01 10:40+00', 'x')$$,
  '42501', null, 'non-owner is refused');
reset role;
set local role anon;
select throws_ok($$select extend_booking('00000000-0000-0000-0000-0000000001a0', '2030-01-01 10:40+00', 'x')$$,
  '42501', null, 'anon is refused');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
set local role authenticated;

select throws_ok($$select extend_booking('00000000-0000-0000-0000-00000000dead', '2030-01-01 10:40+00', 'x')$$,
  'P0001', 'booking_not_found', 'unknown booking gives a clear error');

-- day 1: 20 -> 40 min pushes A by exactly 20 min, B (gap) untouched
select is(extend_booking('00000000-0000-0000-0000-0000000001a0', '2030-01-01 10:40+00', 'beard added'),
  '{"ok": true, "moved": ["00000000-0000-0000-0000-0000000001a1"]}'::jsonb, 'extend returns only the overlapped booking');
select is((select end_at from bookings where customer_name = 'T1'), '2030-01-01 10:40+00'::timestamptz, 'target lengthened');
select is((select tstzrange(start_at, end_at) from bookings where customer_name = 'A'),
  tstzrange('2030-01-01 10:40+00', '2030-01-01 11:10+00'), 'A pushed by the minimum, duration kept');
select is((select start_at from bookings where customer_name = 'B'), '2030-01-01 11:30+00'::timestamptz, 'B with enough gap not moved');
select is((select row(old_start, old_end, new_start, new_end, reason)::text from booking_changes
           where booking_id = '00000000-0000-0000-0000-0000000001a1'),
  row('2030-01-01 10:20+00'::timestamptz, '2030-01-01 10:50+00'::timestamptz,
      '2030-01-01 10:40+00'::timestamptz, '2030-01-01 11:10+00'::timestamptz, 'beard added')::text,
  'move logged in booking_changes');

-- day 2: cascade
select is(extend_booking('00000000-0000-0000-0000-0000000002a0', '2030-01-02 10:40+00', 'cascade'),
  '{"ok": true, "moved": ["00000000-0000-0000-0000-0000000002a1", "00000000-0000-0000-0000-0000000002a2", "00000000-0000-0000-0000-0000000002a3"]}'::jsonb,
  'cascade moves all three in order');
select is((select array_agg(start_at order by start_at) from bookings where customer_name in ('C1','C2','C3')),
  array['2030-01-02 10:40+00', '2030-01-02 11:10+00', '2030-01-02 11:40+00']::timestamptz[], 'each cascaded by the minimum');
select is((select start_at from bookings where customer_name = 'D'), '2030-01-02 13:00+00'::timestamptz, 'D after gap not moved');
select is((select count(*)::int from booking_changes c join bookings b on b.id = c.booking_id
           where b.start_at::date = '2030-01-02' and c.reason = 'cascade'), 3, 'one booking_changes row per moved booking');

-- day 3: push past closing -> conflict, nothing changed
select is(extend_booking('00000000-0000-0000-0000-0000000003a0', '2030-01-03 19:40+00', 'late'),
  '{"ok": false, "conflicts": ["00000000-0000-0000-0000-0000000003a2"]}'::jsonb, 'push past close returns conflicts');
select is((select end_at from bookings where customer_name = 'T3'), '2030-01-03 19:20+00'::timestamptz, 'target unchanged on conflict');
select is((select array_agg(start_at order by start_at) from bookings where customer_name in ('E','F')),
  array['2030-01-03 19:20+00', '2030-01-03 19:40+00']::timestamptz[], 'others unchanged on conflict');
select is((select count(*)::int from booking_changes where reason = 'late'), 0, 'no booking_changes on conflict');

-- day 4: shortening moves nothing
select is(extend_booking('00000000-0000-0000-0000-0000000004a0', '2030-01-04 10:20+00', 'short'),
  '{"ok": true, "moved": []}'::jsonb, 'shortening moves nothing');
select is((select end_at from bookings where customer_name = 'T4'), '2030-01-04 10:20+00'::timestamptz, 'target shortened');
select is((select start_at from bookings where customer_name = 'G'), '2030-01-04 10:40+00'::timestamptz, 'G untouched');

select throws_ok($$select extend_booking('00000000-0000-0000-0000-0000000004a0', '2030-01-04 10:00+00', 'x')$$,
  'P0001', 'invalid', 'end not after start rejected');

select is(extend_booking('00000000-0000-0000-0000-0000000005a0', '2030-01-05 20:00+00', 'at closing')->>'ok',
  'true', 'the last booking can end exactly at closing');

reset role;
select * from finish();
rollback;
