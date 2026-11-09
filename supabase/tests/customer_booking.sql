begin;
select plan(15);

create temp table svc as select id from services where name = 'Hair Cut';
insert into bookings (id, barber_id, service_id, customer_name, phone, email, start_at, end_at, status, cancel_token) values
  ('00000000-0000-0000-0000-0000000009a1', '00000000-0000-0000-0000-000000000001', (select id from svc), 'Ann Smith', '0700', 'a@x.test',
   '2030-01-01 10:00+00', '2030-01-01 10:30+00', 'confirmed', '00000000-0000-0000-0000-0000000009b1'),
  ('00000000-0000-0000-0000-0000000009a2', '00000000-0000-0000-0000-000000000001', (select id from svc), 'Bob Jones', '0701', 'b@x.test',
   '2030-01-01 11:00+00', '2030-01-01 11:30+00', 'confirmed', '00000000-0000-0000-0000-0000000009b2'),
  -- starts in 2 hours: inside the 24h cutoff
  ('00000000-0000-0000-0000-0000000009a3', '00000000-0000-0000-0000-000000000001', (select id from svc), 'Cy Late', '0702', 'c@x.test',
   now() + interval '2 hours', now() + interval '2 hours 30 minutes', 'confirmed', '00000000-0000-0000-0000-0000000009b3');
insert into bookings (id, barber_id, service_id, customer_name, phone, email, start_at, end_at, status, cancel_token) values
  ('00000000-0000-0000-0000-0000000009a4', '00000000-0000-0000-0000-000000000001', (select id from svc), 'Dee In', '0703', 'd@x.test',
   now() + interval '24 hours 1 minute', now() + interval '24 hours 2 minutes', 'confirmed', '00000000-0000-0000-0000-0000000009b4'),
  ('00000000-0000-0000-0000-0000000009a5', '00000000-0000-0000-0000-000000000001', (select id from svc), 'Eve Out', '0704', 'e@x.test',
   now() + interval '23 hours 59 minutes', now() + interval '24 hours', 'confirmed', '00000000-0000-0000-0000-0000000009b5');
insert into booking_changes (booking_id, old_start, old_end, new_start, new_end, reason)
values ('00000000-0000-0000-0000-0000000009a1', '2030-01-01 09:40+00', '2030-01-01 10:10+00', '2030-01-01 10:00+00', '2030-01-01 10:30+00', 'push');

set local role anon;

select is((select count(*)::int from get_booking_by_token('00000000-0000-0000-0000-0000000009b1')), 1, 'valid token returns one row');
select is((select first_name || '/' || service_name || '/' || price_pence from get_booking_by_token('00000000-0000-0000-0000-0000000009b1')),
  'Ann/Hair Cut/1400', 'own booking, first name only');
select is((select jsonb_array_length(changes) from get_booking_by_token('00000000-0000-0000-0000-0000000009b1')), 1, 'changes returned');
select is((select changes->0->>'reason' from get_booking_by_token('00000000-0000-0000-0000-0000000009b1')), 'push', 'change reason');
select is((select count(*)::int from get_booking_by_token('00000000-0000-0000-0000-0000000009b2') where first_name = 'Ann'), 0, 'other tokens never return other customers');
select is((select count(*)::int from get_booking_by_token('00000000-0000-0000-0000-00000000ffff')), 0, 'unknown token returns nothing');

select is(cancel_booking_by_token('00000000-0000-0000-0000-00000000ffff'), '{"ok":false,"reason":"not_found"}'::jsonb, 'cancel unknown');
select is(cancel_booking_by_token('00000000-0000-0000-0000-0000000009b3'), '{"ok":false,"reason":"too_late"}'::jsonb, 'cancel inside 24h refused');
select is(cancel_booking_by_token('00000000-0000-0000-0000-0000000009b1'), '{"ok":true}'::jsonb, 'cancel before cutoff works');
select is(cancel_booking_by_token('00000000-0000-0000-0000-0000000009b1'), '{"ok":false,"reason":"not_cancellable"}'::jsonb, 'cannot cancel twice');
select is((select status from get_booking_by_token('00000000-0000-0000-0000-0000000009b1')), 'cancelled', 'status is cancelled');
select is(cancel_booking_by_token('00000000-0000-0000-0000-0000000009b4'), '{"ok":true}'::jsonb, 'start at now()+24h+1min can be cancelled');
select is(cancel_booking_by_token('00000000-0000-0000-0000-0000000009b5'), '{"ok":false,"reason":"too_late"}'::jsonb, 'start at now()+24h-1min is too late');
select is((select count(*)::int from bookings), 0, 'anon cannot select bookings directly');
reset role;
select is((select status from bookings where id = '00000000-0000-0000-0000-0000000009a3'), 'confirmed', 'too-late booking untouched');

select * from finish();
rollback;
