begin;
select plan(25);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000c1'), ('00000000-0000-0000-0000-0000000000c2');
insert into owners (user_id) values ('00000000-0000-0000-0000-0000000000c2');
insert into services (id, name, price_pence, duration_min) values ('00000000-0000-0000-0000-0000000000a1', 'Set Cut', 1400, 30);
insert into closures (id, date, reason) values ('00000000-0000-0000-0000-0000000000d1', '2030-12-25', 'Xmas');
insert into bookings (barber_id, service_id, customer_name, phone, email, start_at, end_at, status)
values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'Past', '1', 'a@x.test',
        '2030-01-01 10:00+00', '2030-01-01 10:30+00', 'done');

-- constraints
select throws_ok($$insert into opening_hours (weekday, open_local, close_local) values (2, '10:00', '12:00')$$,
  '23505', null, 'one shop-wide hours row per weekday (null barber counts as equal)');
select lives_ok($$insert into opening_hours (weekday, open_local, close_local) values (2, '10:00', '12:00')
  on conflict (barber_id, weekday) do update set open_local = excluded.open_local, close_local = excluded.close_local$$,
  'upsert by (barber_id, weekday) works');
select is((select open_local::text || '-' || close_local::text from opening_hours where weekday = 2 and barber_id is null),
  '10:00:00-12:00:00', 'upsert replaced the day');
select throws_ok($$insert into opening_hours (weekday, open_local, close_local) values (1, '12:00', '12:00')$$,
  '23514', null, 'close must be after open');
select throws_ok($$insert into closures (date) values ('2030-12-25')$$, '23505', null, 'one closure per date');
select throws_ok($$insert into closures (date, open_local) values ('2030-12-26', '10:00')$$,
  '23514', null, 'special hours need both open and close');
select throws_ok($$insert into closures (date, open_local, close_local) values ('2030-12-26', '14:00', '10:00')$$,
  '23514', null, 'special close must be after open');
select lives_ok($$insert into closures (date, open_local, close_local) values ('2030-12-24', '10:00', '14:00')$$,
  'special hours with both set');
select throws_ok($$delete from services where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '23503', null, 'a service with bookings cannot be hard-deleted');

-- anon and a signed-in non-owner cannot write
set local role anon;
select throws_ok($$insert into opening_hours (weekday, open_local, close_local) values (1, '10:00', '12:00')$$,
  '42501', null, 'anon cannot insert hours');
select throws_ok($$insert into closures (date) values ('2030-12-27')$$, '42501', null, 'anon cannot insert closures');
update services set price_pence = 1 where id = '00000000-0000-0000-0000-0000000000a1';
delete from closures where id = '00000000-0000-0000-0000-0000000000d1';
reset role;
select is((select price_pence from services where id = '00000000-0000-0000-0000-0000000000a1'), 1400, 'anon update of services is a no-op');
select is((select count(*)::int from closures where id = '00000000-0000-0000-0000-0000000000d1'), 1, 'anon delete of closures is a no-op');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$insert into services (name, price_pence, duration_min) values ('x', 1, 10)$$,
  '42501', null, 'non-owner cannot insert services');
select throws_ok($$insert into closures (date) values ('2030-12-27')$$, '42501', null, 'non-owner cannot insert closures');
update opening_hours set open_local = '06:00' where weekday = 2;
update services set duration_min = 99 where id = '00000000-0000-0000-0000-0000000000a1';
delete from closures where id = '00000000-0000-0000-0000-0000000000d1';
reset role;
select is((select open_local from opening_hours where weekday = 2 and barber_id is null), '10:00'::time, 'non-owner update of hours is a no-op');
select is((select duration_min from services where id = '00000000-0000-0000-0000-0000000000a1'), 30, 'non-owner update of services is a no-op');
select is((select count(*)::int from closures where id = '00000000-0000-0000-0000-0000000000d1'), 1, 'non-owner delete of closures is a no-op');

-- the owner can write all three
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into services (name, price_pence, duration_min) values ('Owner Svc', 1000, 20)$$, 'owner inserts a service');
select lives_ok($$update opening_hours set open_local = '09:00' where weekday = 2 and barber_id is null$$, 'owner updates hours');
select lives_ok($$delete from closures where id = '00000000-0000-0000-0000-0000000000d1'$$, 'owner deletes a closure');
-- past bookings keep their stored times when the service changes
update services set duration_min = 60, price_pence = 2500 where id = '00000000-0000-0000-0000-0000000000a1';
reset role;
select is((select count(*)::int from closures where id = '00000000-0000-0000-0000-0000000000d1'), 0, 'closure deleted by owner');
select is((select duration_min from services where id = '00000000-0000-0000-0000-0000000000a1'), 60, 'owner changed the duration');
select is((select open_local from opening_hours where weekday = 2 and barber_id is null), '09:00'::time, 'owner hours update stored');
select is((select tstzrange(start_at, end_at) from bookings where customer_name = 'Past'),
  tstzrange('2030-01-01 10:00+00', '2030-01-01 10:30+00'), 'existing booking keeps its end_at after a duration change');

select * from finish();
rollback;
