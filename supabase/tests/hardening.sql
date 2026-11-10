begin;
select plan(26);

-- returns the error message of a statement, or null if it succeeded (rolled back with the test)
create function public.t_err(q text) returns text language plpgsql as
$$ begin execute q; return null; exception when others then return sqlerrm; end $$;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000016c2');
insert into owners (user_id) values ('00000000-0000-0000-0000-0000000016c2');

-- a Tuesday (open 09:30-20:00) 7-13 days ahead, and a Tuesday 91-97 days ahead, both London dates
create temp table d as
select x.near, x.near + 84 + 7 as far
from (select l + 7 + ((2 - extract(dow from l + 7)::int + 7) % 7) as near
      from (select (now() at time zone 'Europe/London')::date as l) t) x;
create temp table svc as select id from services where name = 'Hair Cut';
grant select on d, svc to anon, authenticated;
create function public.t_at(day date, hhmm text) returns timestamptz language sql as
$$ select (day + hhmm::time) at time zone 'Europe/London' $$;
create function public.t_book(day text, hhmm text, name text, phone text, email text default '') returns text language sql as
$$ select format('select * from create_booking((select id from svc), public.t_at((select %s from d), %L), %L, %L, %L)',
                 day, hhmm, name, phone, email) $$;

set local role anon;
-- (a) phone shape: stored form is +44 then a UK national number
select is(public.t_err(public.t_book('near', '10:00', 'Intl', '+12025550123')), 'invalid', 'international phone rejected');
select is(public.t_err(public.t_book('near', '10:00', 'Raw', '07700900123')), 'invalid', 'un-normalised phone rejected');
select is(public.t_err(public.t_book('near', '10:00', 'Zero', '+4407700900123')), 'invalid', '+44 0 (doubled trunk zero) rejected');
select is(public.t_err(public.t_book('near', '10:00', 'Long', '+4477009001234567')), 'invalid', 'too many digits rejected');
select is(public.t_err(public.t_book('near', '10:00', 'Junk', '+447700900123; x')), 'invalid', 'trailing junk rejected');
-- (b) lengths and email shape
select is(public.t_err(public.t_book('near', '10:00', repeat('a', 101), '+447700900123')), 'invalid', '101-char name rejected');
select is(public.t_err(public.t_book('near', '10:00', 'Em', '+447700900123', repeat('a', 250) || '@b.co')), 'invalid', '255-char email rejected');
select is(public.t_err(public.t_book('near', '10:00', 'Em', '+447700900123', 'not-an-email')), 'invalid', 'malformed email rejected');
-- (c) horizon
select is(public.t_err(public.t_book('far', '10:00', 'Far', '+447700900123')), 'too_far', '91+ days ahead rejected for anon');
-- (d) at most 3 upcoming bookings per phone for the public
select is(public.t_err(public.t_book('near', '10:00', 'One', '+447700900123', 'one@x.test')), null, '1st booking (with email) ok');
select is(public.t_err(public.t_book('near', '11:00', repeat('a', 100), '+447700900123')), null, '2nd booking (100-char name) ok');
select is(public.t_err(public.t_book('near', '12:00', 'Three', '+447700900123')), null, '3rd booking ok');
select is(public.t_err(public.t_book('near', '13:00', 'Four', '+447700900123')), 'too_many_bookings', '4th upcoming booking for a phone rejected');
select is(public.t_err(public.t_book('near', '13:00', 'Other', '+447700900124')), null, 'a different phone is not affected');
reset role;
update bookings set status = 'cancelled' where customer_name = 'Three';
set local role anon;
select is(public.t_err(public.t_book('near', '14:00', 'Four again', '+447700900123')), null, 'cancelled bookings do not count');

-- the owner may exceed the cap and the horizon
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000016c2","role":"authenticated"}', true);
set local role authenticated;
select is(public.t_err(public.t_book('near', '15:00', 'Owner adds', '+447700900123')), null, 'owner may add a 4th upcoming booking');
select is(public.t_err(public.t_book('far', '10:00', 'Regular', '+447700900123')), null, 'owner may book beyond 90 days');
select is(public.t_err(public.t_book('near', '16:00', 'Owner intl', '+12025550123')), 'invalid', 'owner is held to the UK phone rule too');
reset role;

select is((select count(*)::int from bookings where phone = '+447700900123' and status = 'confirmed'), 5, 'three public + one re-book + owner extra');

-- get_busy: ranges longer than 31 days are clamped to 31 days from p_from
create temp table far_busy as select now() + interval '40 days' as s;
grant select on far_busy to anon;
insert into bookings (barber_id, service_id, customer_name, phone, email, start_at, end_at, status)
select '00000000-0000-0000-0000-000000000001', (select id from svc), 'Far busy', '+447700900999', '',
       s, s + interval '30 minutes', 'confirmed' from far_busy;
set local role anon;
select is((select count(*)::int from get_busy(now() + interval '39 days', now() + interval '41 days') g where g.start_at = (select s from far_busy)), 1, 'get_busy finds it in a short range');
select is((select count(*)::int from get_busy(now() + interval '0 days', now() + interval '400 days') g where g.start_at = (select s from far_busy)), 0, 'get_busy clamps a long range to 31 days');
reset role;

-- shop_status: migration 016 seeds the single row; the statement is idempotent
insert into public.shop_status (id) values (true) on conflict do nothing;
insert into public.shop_status (id) values (true) on conflict do nothing;
select is((select count(*)::int from shop_status), 1, 'shop_status insert is idempotent: exactly one row');
delete from shop_status;
insert into public.shop_status (id) values (true) on conflict do nothing;
select is((select state || in_shop || waiting from shop_status), 'closed00', 'on an empty table it creates the default closed row');

-- indexes for the per-phone cap, diary and change lookups
select has_index('public', 'bookings', 'bookings_start_at', 'bookings(start_at) index');
select has_index('public', 'bookings', 'bookings_phone', 'bookings(phone) index');
select has_index('public', 'booking_changes', 'booking_changes_booking_id', 'booking_changes(booking_id) index');

select * from finish();
rollback;
