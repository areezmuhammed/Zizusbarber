begin;
select plan(15);

-- 2030-01-01 is a Tuesday (open 09:30-20:00 London, = UTC in winter); 2030-01-07 is a Monday (closed)
create temp table svc as select id from services where name = 'Hair Cut';
grant select on svc to anon, authenticated;

-- Fixed far-future dates (BST edges) are beyond the public 90-day horizon (016), so these hours/overlap rules are
-- exercised as the owner, who is exempt from the horizon and the per-phone cap only. Public limits: hardening.sql.
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000005c2');
insert into owners (user_id) values ('00000000-0000-0000-0000-0000000005c2');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005c2","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select * from create_booking((select id from svc), '2030-01-01 10:00+00', 'Ann', '+447700900700', 'a@x.test')$$, 'books an open slot');
select throws_ok($$select * from create_booking((select id from svc), '2030-01-01 10:00+00', 'Bob', '+447700900701', 'b@x.test')$$,
  'P0001', 'slot_taken', 'second identical call is taken');
select throws_ok($$select * from create_booking((select id from svc), '2030-01-01 09:00+00', 'Cy', '+447700900702', 'c@x.test')$$,
  'P0001', 'outside_hours', 'before opening rejected');
select throws_ok($$select * from create_booking((select id from svc), '2030-01-01 19:45+00', 'Cy', '+447700900702', 'c@x.test')$$,
  'P0001', 'outside_hours', 'end after closing rejected');
select throws_ok($$select * from create_booking((select id from svc), '2030-01-07 12:00+00', 'Cy', '+447700900702', 'c@x.test')$$,
  'P0001', 'outside_hours', 'closed weekday rejected');
select throws_ok($$select * from create_booking((select id from svc), '2020-01-01 12:00+00', 'Cy', '+447700900702', 'c@x.test')$$,
  'P0001', 'past', 'past start rejected');
select throws_ok($$select * from create_booking((select id from svc), '2030-01-01 12:00+00', ' ', '+447700900702', 'c@x.test')$$,
  'P0001', 'invalid', 'blank name rejected');

-- Hours judged in Europe/London local time. 2030-10-27: clocks went back, 19:00Z = 19:00 GMT (ends 19:30, ok).
select lives_ok($$select * from create_booking((select id from svc), '2030-10-27 19:00+00', 'Dee', '+447700900703', 'd@x.test')$$,
  'GMT day after clocks go back: 19:00Z accepted');
-- 2030-10-26 is still BST: 19:00Z = 20:00 local, would pass in UTC
select throws_ok($$select * from create_booking((select id from svc), '2030-10-26 19:00+00', 'Eve', '+447700900704', 'e@x.test')$$,
  'P0001', 'outside_hours', 'BST day before clocks go back: 19:00Z (20:00 local) rejected');
-- 2031-03-30 spring forward: 19:00Z = 20:00 BST, past 20:00 close; UTC comparison would accept it
select throws_ok($$select * from create_booking((select id from svc), '2031-03-30 19:00+00', 'Fay', '+447700900705', 'f@x.test')$$,
  'P0001', 'outside_hours', 'spring-forward day: 19:00Z (20:00 BST) rejected');
select lives_ok($$select * from create_booking((select id from svc), '2031-03-30 18:30+00', 'Gus', '+447700900706', 'g@x.test')$$,
  'spring-forward day: 18:30Z (19:30 BST, ends 20:00) accepted');

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
