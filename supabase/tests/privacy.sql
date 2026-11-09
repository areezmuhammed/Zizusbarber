begin;
select plan(20);

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
   now() - interval '1 year', now() - interval '1 year' + interval '30 minutes', 'done', '00000000-0000-0000-0000-000000001616');
insert into notifications (booking_id, kind, channel, status, error)
values ('00000000-0000-0000-0000-000000001601', 'confirmation', 'sms', 'failed', 'to +447700900111 rejected');

set local role anon;
select is(anonymise_customer_by_token('00000000-0000-0000-0000-00000000ffff'), '{"ok":false,"reason":"not_found"}'::jsonb, 'unknown token: not_found');
select is(anonymise_customer_by_token('00000000-0000-0000-0000-000000001612'), '{"ok":true,"anonymised":3}'::jsonb, 'anon can erase by token; all 3 rows on that phone');
select is((select count(*)::int from bookings), 0, 'anon still cannot read bookings');
select is((select count(*)::int from get_booking_by_token('00000000-0000-0000-0000-000000001612')), 0, 'old link no longer works');
select is(anonymise_customer_by_token('00000000-0000-0000-0000-000000001612'), '{"ok":false,"reason":"not_found"}'::jsonb, 'old token cannot be reused');
reset role;

select is((select count(*)::int from bookings where id between '00000000-0000-0000-0000-000000001601' and '00000000-0000-0000-0000-000000001603'
  and customer_name = 'Deleted customer' and email = '' and phone ~ '^deleted-[0-9a-f]{8}$'), 3, 'name, phone and email anonymised on all three');
select is((select count(distinct phone)::int from bookings where customer_name = 'Deleted customer'
  and id between '00000000-0000-0000-0000-000000001601' and '00000000-0000-0000-0000-000000001603'), 3, 'placeholders are not linkable');
select is((select count(*)::int from bookings where cancel_token in ('00000000-0000-0000-0000-000000001611',
  '00000000-0000-0000-0000-000000001612', '00000000-0000-0000-0000-000000001613')), 0, 'every token rotated');
select is((select status from bookings where id = '00000000-0000-0000-0000-000000001601'), 'done', 'past booking kept as is');
select is((select start_at from bookings where id = '00000000-0000-0000-0000-000000001601')::date, (now() - interval '10 days')::date, 'time slot kept');
select is((select string_agg(status || '/' || cancelled_by, ',' order by id) from bookings
  where id in ('00000000-0000-0000-0000-000000001602', '00000000-0000-0000-0000-000000001603')),
  'cancelled/customer,cancelled/customer', 'future bookings cancelled by the customer (no shop-cancel notice)');
select is((select error from notifications where booking_id = '00000000-0000-0000-0000-000000001601'), null, 'notification error text cleared');
select is((select customer_name || phone || email from bookings where id = '00000000-0000-0000-0000-000000001604'),
  'Bob Jones+447700900222b@x.test', 'other customers untouched');
select is((select status from bookings where id = '00000000-0000-0000-0000-000000001604'), 'confirmed', 'other customer still booked');

-- retention
select ok(not has_function_privilege('anon', 'anonymise_old_bookings(interval)', 'execute'), 'anon cannot run retention');
select ok(not has_function_privilege('authenticated', 'anonymise_old_bookings(interval)', 'execute'), 'authenticated cannot run retention');
select ok(has_function_privilege('anon', 'anonymise_customer_by_token(uuid)', 'execute'), 'anon can run erase-by-token');
select cmp_ok(anonymise_old_bookings(), '>=', 1, 'retention anonymises something');
select is((select customer_name from bookings where id = '00000000-0000-0000-0000-000000001605'), 'Deleted customer', '3-year-old booking anonymised');
select is((select customer_name from bookings where id = '00000000-0000-0000-0000-000000001606'), 'Recent Rita', '1-year-old booking kept');

select * from finish();
rollback;
