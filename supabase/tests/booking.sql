begin;
select plan(11);

-- 2030-01-01 is a Tuesday (open 09:30-20:00 London, = UTC in winter); 2030-01-07 is a Monday (closed)
create temp table svc as select id from services where name = 'Hair Cut';
grant select on svc to anon;

set local role anon;
select lives_ok($$select * from create_booking((select id from svc), '2030-01-01 10:00+00', 'Ann', '0700', 'a@x.test')$$, 'books an open slot');
select throws_ok($$select * from create_booking((select id from svc), '2030-01-01 10:00+00', 'Bob', '0701', 'b@x.test')$$,
  'P0001', 'slot_taken', 'second identical call is taken');
select throws_ok($$select * from create_booking((select id from svc), '2030-01-01 09:00+00', 'Cy', '0702', 'c@x.test')$$,
  'P0001', 'outside_hours', 'before opening rejected');
select throws_ok($$select * from create_booking((select id from svc), '2030-01-01 19:45+00', 'Cy', '0702', 'c@x.test')$$,
  'P0001', 'outside_hours', 'end after closing rejected');
select throws_ok($$select * from create_booking((select id from svc), '2030-01-07 12:00+00', 'Cy', '0702', 'c@x.test')$$,
  'P0001', 'outside_hours', 'closed weekday rejected');
select throws_ok($$select * from create_booking((select id from svc), '2020-01-01 12:00+00', 'Cy', '0702', 'c@x.test')$$,
  'P0001', 'past', 'past start rejected');
select throws_ok($$select * from create_booking((select id from svc), '2030-01-01 12:00+00', ' ', '0702', 'c@x.test')$$,
  'P0001', 'invalid', 'blank name rejected');

reset role;
select is((select end_at - start_at from bookings where customer_name = 'Ann'), interval '30 minutes', 'end = start + duration');
select is((select status from bookings where customer_name = 'Ann'), 'confirmed', 'status confirmed');

set local role anon;
select is((select count(*)::int from get_busy('2030-01-01 00:00+00', '2030-01-02 00:00+00')), 1, 'get_busy shows the booking');
reset role;
select is((select array_agg(n order by o) from pg_proc p,
  unnest(p.proargnames, p.proargmodes) with ordinality as u(n, m, o)
  where p.proname = 'get_busy' and m = 't'), array['start_at','end_at'], 'get_busy returns only start_at, end_at');
select * from finish();
rollback;
