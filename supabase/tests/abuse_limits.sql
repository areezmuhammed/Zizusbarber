begin;
select plan(31);

-- 017: public (non-owner) create_booking is capped at 5 bookings created per phone per 24h (cancelled ones count,
-- so cancel-and-rebook cannot text one number forever) and 20 bookings created per hour shop-wide ('busy').
-- Both count public_booking_log, which only the public branch writes; owner bookings never count.

create function public.t_err(q text) returns text language plpgsql as
$$ begin execute q; return null; exception when others then return sqlerrm; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000017c2');
insert into owners (user_id) values ('00000000-0000-0000-0000-0000000017c2');

-- a Tuesday (open 09:30-20:00) 7-13 days ahead (past the 24h cancel cutoff, inside the 90-day horizon)
create temp table d as
select l + 7 + ((2 - extract(dow from l + 7)::int + 7) % 7) as near
from (select (now() at time zone 'Europe/London')::date as l) t;
create temp table svc as select id from services where name = 'Hair Cut';
grant select on d, svc to anon, authenticated;
create function public.t_at(hhmm text) returns timestamptz language sql as
$$ select ((select near from d) + hhmm::time) at time zone 'Europe/London' $$;
create function public.t_book(hhmm text, phone text) returns text language sql as
$$ select format('select * from create_booking((select id from svc), public.t_at(%L), %L, %L, %L)', hhmm, 'Abuse test', phone, '') $$;
-- book then cancel with the customer's own link, as the attacker would after the confirmation text went out
create function public.t_cycle(hhmm text, phone text) returns text language plpgsql as
$$ declare t text; begin
  select cancel_token into t from create_booking((select id from svc), public.t_at(hhmm), 'Abuse test', phone, '');
  return cancel_booking_by_token(t::uuid) ->> 'ok';
exception when others then return sqlerrm; end $$;
create function public.t_log_hour() returns int language sql security definer as
$$ select count(*)::int from public.public_booking_log where created_at > now() - interval '1 hour' $$;

set local role anon;
-- (1) cancel-and-rebook replay on one phone: 5 cycles (a real customer rebooking 2-3 times is well inside), then no
select is(public.t_cycle('10:00', '+447700900601'), 'true', 'cycle 1: book + cancel');
select is(public.t_cycle('10:00', '+447700900601'), 'true', 'cycle 2: rebook + cancel');
select is(public.t_cycle('10:00', '+447700900601'), 'true', 'cycle 3: rebook + cancel (normal customer use)');
select is(public.t_cycle('10:00', '+447700900601'), 'true', 'cycle 4');
select is(public.t_cycle('10:00', '+447700900601'), 'true', 'cycle 5');
select is(public.t_err(public.t_book('10:00', '+447700900601')), 'too_many_bookings', '6th booking for one phone in 24h rejected although all 5 were cancelled');
select is(public.t_err(public.t_book('11:00', '+447700900602')), null, 'another phone is unaffected');
reset role;

-- (2) the 24h window: 5 bookings made 25h ago no longer count; 4 made 23h ago still do
insert into public_booking_log (phone_hash, created_at)
select md5('+447700900603'), now() - interval '25 hours' from generate_series(1, 5)
union all select md5('+447700900604'), now() - interval '23 hours' from generate_series(1, 4);
set local role anon;
select is(public.t_err(public.t_book('12:00', '+447700900603')), null, 'bookings created 25h ago do not count');
select is(public.t_err(public.t_book('13:00', '+447700900604')), null, '5th booking in 24h allowed');
select is(public.t_err(public.t_book('13:30', '+447700900604')), 'too_many_bookings', '6th in 24h (4 from 23h ago) rejected');
reset role;

-- (3) owner exemption: may book for the capped phone, and the booking is not logged
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000017c2","role":"authenticated"}', true);
set local role authenticated;
select is(public.t_err(public.t_book('14:00', '+447700900601')), null, 'owner may book for a phone over the 24h limit');
reset role;
select set_config('request.jwt.claims', '', true); -- back to a signed-out caller
select is(public.t_log_hour(), 8,'public bookings logged this hour: 5 cycles + 3 (owner and rejections not logged)');

-- (4) global hourly cap. 30 public bookings 61 minutes ago do not count; top up to 19 in the last hour.
insert into public_booking_log (phone_hash, created_at)
select md5('+4477009007' || lpad(g::text, 2, '0')), now() - interval '61 minutes' from generate_series(1, 30) g
union all
select md5('+4477009008' || lpad(g::text, 2, '0')), now() - interval '30 minutes' from generate_series(1, 11) g;
select is(public.t_log_hour(), 19, '19 public bookings in the last hour');
set local role anon;
select is(public.t_err(public.t_book('15:00', '+447700900605')), null, '20th public booking in an hour ok');
select is(public.t_err(public.t_book('16:00', '+447700900606')), 'busy', '21st public booking in an hour: busy');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000017c2","role":"authenticated"}', true);
set local role authenticated;
select is(public.t_err(public.t_book('16:00', '+447700900606')), null, 'owner still books while the public is capped');
reset role;
select is(public.t_log_hour(), 20, 'owner booking does not count toward the hourly cap');
select set_config('request.jwt.claims', '', true);
set local role anon;
select is(public.t_err(public.t_book('17:00', '+447700900607')), 'busy', 'public still busy after the owner booked');
reset role;

-- (5) the log keeps only a hash, never the number, and the public cannot read it
select is((select count(*)::int from public_booking_log where phone_hash like '+%'), 0, 'no raw phone numbers stored');
set local role anon;
select is(public.t_err('select count(*) from public.public_booking_log'), 'permission denied for table public_booking_log', 'anon cannot read the log');
reset role;

-- (6) erase-and-rebook replay: erasing a booking does not reset the per-phone cap (the hash row survives)
delete from public_booking_log; -- clear the hourly window used above
create temp table er (tok text);
grant all on er to anon;
set local role anon;
insert into er select cancel_token from create_booking((select id from svc), public.t_at('10:30'), 'Abuse test', '+447700900610', '');
select is((anonymise_customer_by_token((select tok::uuid from er)) ->> 'ok'), 'true', 'erased the booking');
select is(public.t_cycle('11:30', '+447700900610'), 'true', 'rebook 2 + cancel after erase');
select is(public.t_cycle('12:30', '+447700900610'), 'true', 'rebook 3 + cancel after erase');
select is(public.t_cycle('13:30', '+447700900610'), 'true', 'rebook 4 + cancel after erase');
select is(public.t_err(public.t_book('14:30', '+447700900610')), null, '5th created incl. the erased one');
select is(public.t_err(public.t_book('15:30', '+447700900610')), 'too_many_bookings', '6th rejected: the erased booking still counts');
reset role;
select is((select count(*)::int from public_booking_log where phone_hash = md5('+447700900610')), 5, 'log row survived erasure');

-- a public booking purges expired rows opportunistically
reset role;
insert into public_booking_log (phone_hash, created_at) values (md5('stale'), now() - interval '25 hours');
set local role anon;
select is(public.t_err(public.t_book('09:30', '+447700900611')), null, 'public booking ok');
reset role;
select is((select count(*)::int from public_booking_log where created_at < now() - interval '24 hours'), 0, 'no log rows older than 24h remain after a public booking');

-- (7) the log is write-locked too
set local role anon;
select throws_ok($$insert into public.public_booking_log (phone_hash) values ('x')$$, '42501', null, 'anon cannot insert into the log');
select throws_ok($$delete from public.public_booking_log$$, '42501', null, 'anon cannot delete from the log');
reset role;

select * from finish();
rollback;
