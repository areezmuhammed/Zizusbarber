begin;
select plan(32);

create temp table svc as select id from services where name = 'Hair Cut';
-- Ann has three bookings on one phone (past done, future confirmed, future-but-another-token); Bob shares nothing.
insert into bookings (id, barber_id, service_id, customer_name, phone, email, start_at, end_at, status, cancel_token) values
  ('00000000-0000-0000-0000-000000001601', '00000000-0000-0000-0000-000000000001', (select id from svc), 'Ann Smith', '+447700900111', 'a@x.test',
   now() - interval '10 days', now() - interval '10 days' + interval '30 minutes', 'done', '00000000-0000-0000-0000-000000001611'),
  ('00000000-0000-0000-0000-000000001602', '00000000-0000-0000-0000-000000000001', (select id from svc), 'Ann Smith', '+447700900111', 'a@x.test',
   '2031-01-01 10:00+00', '2031-01-01 10:30+00', 'confirmed', '00000000-0000-0000-0000-000000001612'),
  ('00000000-0000-0000-0000-000000001603', '00000000-0000-0000-0000-000000000001', (select id from svc), 'A. Smith', '+447700900111', '',
   '2031-01-02 10:00+00', '2031-01-02 10:30+00', 'confirmed', '00000000-0000-0000-0000-000000001613'),
  ('00000000-0000-0000-0000-000000001604', '00000000-0000-0000-0000-000000000001', (select id from svc), 'Bob Jones', '+447700900222', 'b@x.test',
   '2031-01-01 11:00+00', '2031-01-01 11:30+00', 'confirmed', '00000000-0000-0000-0000-000000001614'),
  -- retention: one booking 3 years old, one 1 year old
  ('00000000-0000-0000-0000-000000001605', '00000000-0000-0000-0000-000000000001', (select id from svc), 'Old Timer', '+447700900333', 'o@x.test',
   now() - interval '3 years', now() - interval '3 years' + interval '30 minutes', 'done', '00000000-0000-0000-0000-000000001615'),
  ('00000000-0000-0000-0000-000000001606', '00000000-0000-0000-0000-000000000001', (select id from svc), 'Recent Rita', '+447700900444', 'r@x.test',
   now() - interval '1 year', now() - interval '1 year' + interval '30 minutes', 'done', '00000000-0000-0000-0000-000000001616'),
  -- an old PENDING booking (never marked done) whose end is past the interval, and one that only STARTED before it
  ('00000000-0000-0000-0000-000000001607', '00000000-0000-0000-0000-000000000001', (select id from svc), 'Old Pending', '+447700900555', 'p@x.test',
   now() - interval '2 years 1 day', now() - interval '2 years 1 day' + interval '30 minutes', 'pending', '00000000-0000-0000-0000-000000001617'),
  ('00000000-0000-0000-0000-000000001608', '00000000-0000-0000-0000-000000000001', (select id from svc), 'Edge Pending', '+447700900666', 'q@x.test',
   now() - interval '2 years' - interval '10 minutes', now() - interval '2 years' + interval '20 minutes', 'pending', '00000000-0000-0000-0000-000000001618'),
  -- already anonymised long ago: must be left exactly as is
  ('00000000-0000-0000-0000-000000001609', '00000000-0000-0000-0000-000000000001', (select id from svc), 'Deleted customer', 'deleted-abcdef12', '',
   now() - interval '5 years', now() - interval '5 years' + interval '30 minutes', 'done', '00000000-0000-0000-0000-000000001619');
insert into booking_changes (booking_id, old_start, old_end, new_start, new_end, reason) values
  ('00000000-0000-0000-0000-000000001602', '2031-01-01 09:40+00', '2031-01-01 10:10+00', '2031-01-01 10:00+00', '2031-01-01 10:30+00', 'Ann asked to move'),
  ('00000000-0000-0000-0000-000000001605', now() - interval '3 years', now() - interval '3 years', now() - interval '3 years', now() - interval '3 years' + interval '30 minutes', 'Old Timer ran late');
insert into notifications (booking_id, kind, channel, status, error)
values ('00000000-0000-0000-0000-000000001601', 'confirmation', 'sms', 'failed', 'to +447700900111 rejected');

set local role anon;
select is(anonymise_customer_by_token('00000000-0000-0000-0000-00000000ffff'), '{"ok":false,"reason":"not_found"}'::jsonb, 'unknown token: not_found');
select is(anonymise_customer_by_token('00000000-0000-0000-0000-000000001612'), '{"ok":true,"anonymised":1}'::jsonb, 'anon can erase by token; only that booking');
select is((select count(*)::int from bookings), 0, 'anon still cannot read bookings');
select is((select count(*)::int from get_booking_by_token('00000000-0000-0000-0000-000000001612')), 0, 'old link no longer works');
select is(anonymise_customer_by_token('00000000-0000-0000-0000-000000001612'), '{"ok":false,"reason":"not_found"}'::jsonb, 'old token cannot be reused');
select is((select count(*)::int from get_booking_by_token('00000000-0000-0000-0000-000000001613')), 1, 'same-phone booking link still works');
reset role;

select is((select customer_name || '|' || email || '|' || (phone ~ '^deleted-[0-9a-f]{8}$')::text from bookings
  where id = '00000000-0000-0000-0000-000000001602'), 'Deleted customer||true', 'name, phone and email anonymised on the token booking');
select is((select count(*)::int from bookings where cancel_token = '00000000-0000-0000-0000-000000001612'), 0, 'token rotated');
select is((select status || '/' || cancelled_by from bookings where id = '00000000-0000-0000-0000-000000001602'),
  'cancelled/customer', 'future booking cancelled by the customer (no shop-cancel notice)');
select is((select string_agg(customer_name || phone || email || status || cancel_token::text, ',' order by id) from bookings
  where id in ('00000000-0000-0000-0000-000000001601', '00000000-0000-0000-0000-000000001603')),
  'Ann Smith+447700900111a@x.testdone00000000-0000-0000-0000-000000001611,'
  || 'A. Smith+447700900111confirmed00000000-0000-0000-0000-000000001613', 'other bookings on the same phone UNTOUCHED');
select is((select error from notifications where booking_id = '00000000-0000-0000-0000-000000001601'), 'to +447700900111 rejected',
  'same-phone notification untouched');
select is((select customer_name || phone || email from bookings where id = '00000000-0000-0000-0000-000000001604'),
  'Bob Jones+447700900222b@x.test', 'other customers untouched');
select is((select status from bookings where id = '00000000-0000-0000-0000-000000001604'), 'confirmed', 'other customer still booked');

-- erasing a past booking keeps its status and slot, clears its notification error
set local role anon;
select is(anonymise_customer_by_token('00000000-0000-0000-0000-000000001611'), '{"ok":true,"anonymised":1}'::jsonb, 'erase a past booking');
reset role;
select is((select status || customer_name from bookings where id = '00000000-0000-0000-0000-000000001601'), 'doneDeleted customer', 'past booking kept as done');
select is((select start_at from bookings where id = '00000000-0000-0000-0000-000000001601')::date, (now() - interval '10 days')::date, 'time slot kept');
select is((select error from notifications where booking_id = '00000000-0000-0000-0000-000000001601'), null, 'notification error text cleared');
select is((select customer_name || status from bookings where id = '00000000-0000-0000-0000-000000001603'), 'A. Smithconfirmed', 'still untouched');

-- ATTACK: a stranger books with the victim's (unverified) phone, then erases their own booking.
insert into bookings (id, barber_id, service_id, customer_name, phone, email, start_at, end_at, status, cancel_token) values
  ('00000000-0000-0000-0000-00000000160a', '00000000-0000-0000-0000-000000000001', (select id from svc), 'Victim Vic', '+447700900777', 'v@x.test',
   '2031-02-01 10:00+00', '2031-02-01 10:30+00', 'confirmed', '00000000-0000-0000-0000-00000000161a'),
  ('00000000-0000-0000-0000-00000000160b', '00000000-0000-0000-0000-000000000001', (select id from svc), 'Mallory', '+447700900777', '',
   '2031-02-02 10:00+00', '2031-02-02 10:30+00', 'confirmed', '00000000-0000-0000-0000-00000000161b');
set local role anon;
select is(anonymise_customer_by_token('00000000-0000-0000-0000-00000000161b'), '{"ok":true,"anonymised":1}'::jsonb, 'attacker erases own booking');
select is((select status || '|' || first_name from get_booking_by_token('00000000-0000-0000-0000-00000000161a')), 'confirmed|Victim',
  'attack: victim booking still confirmed and its link still works');
reset role;
select is((select customer_name || phone || email || status from bookings where id = '00000000-0000-0000-0000-00000000160a'),
  'Victim Vic+447700900777v@x.testconfirmed', 'attack: victim personal data untouched');

-- retention
select ok(not has_function_privilege('anon', 'anonymise_old_bookings(interval)', 'execute'), 'anon cannot run retention');
select ok(not has_function_privilege('authenticated', 'anonymise_old_bookings(interval)', 'execute'), 'authenticated cannot run retention');
select ok(has_function_privilege('anon', 'anonymise_customer_by_token(uuid)', 'execute'), 'anon can run erase-by-token');
select is((select reason from booking_changes where booking_id = '00000000-0000-0000-0000-000000001602'), null, 'erasure scrubs change reasons');
select is(anonymise_old_bookings(), 2, 'retention anonymises exactly the two rows that ended over 2 years ago');
select is((select reason from booking_changes where booking_id = '00000000-0000-0000-0000-000000001605'), null, 'retention scrubs change reasons');
select is((select customer_name from bookings where id = '00000000-0000-0000-0000-000000001607'), 'Deleted customer', 'old pending booking anonymised');
select is((select customer_name from bookings where id = '00000000-0000-0000-0000-000000001608'), 'Edge Pending', 'booking that ended inside the interval kept');
select is((select phone || cancel_token from bookings where id = '00000000-0000-0000-0000-000000001609'),
  'deleted-abcdef1200000000-0000-0000-0000-000000001619', 'already-anonymised row untouched');
select is((select customer_name from bookings where id = '00000000-0000-0000-0000-000000001605'), 'Deleted customer', '3-year-old booking anonymised');
select is((select customer_name from bookings where id = '00000000-0000-0000-0000-000000001606'), 'Recent Rita', '1-year-old booking kept');

select * from finish();
rollback;
