begin;
select plan(14);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000c1'), ('00000000-0000-0000-0000-0000000000c2');
insert into owners (user_id) values ('00000000-0000-0000-0000-0000000000c2');
insert into gallery (storage_path) values ('test.jpg');
insert into barbers (id, name) values ('00000000-0000-0000-0000-0000000000b1', 'Test Barber');
insert into services (id, name, price_pence, duration_min) values ('00000000-0000-0000-0000-0000000000a1', 'Test Cut', 1400, 30);
insert into bookings (barber_id, service_id, customer_name, phone, email, start_at, end_at, status)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'A', '1', 'a@x.test',
        '2030-01-01 10:00+00', '2030-01-01 10:30+00', 'confirmed');

select throws_ok(
  $$insert into bookings (barber_id, service_id, customer_name, phone, email, start_at, end_at, status)
    values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'B', '2', 'b@x.test',
            '2030-01-01 10:15+00', '2030-01-01 10:45+00', 'confirmed')$$,
  '23P01', null, 'overlapping confirmed bookings are rejected');

update bookings set status = 'cancelled';
select lives_ok(
  $$insert into bookings (barber_id, service_id, customer_name, phone, email, start_at, end_at, status)
    values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'C', '3', 'c@x.test',
            '2030-01-01 10:15+00', '2030-01-01 10:45+00', 'confirmed')$$,
  'cancelled booking does not block');

set local role anon;
select throws_ok($$insert into services (name, price_pence, duration_min) values ('x', 1, 1)$$,
  '42501', null, 'anon cannot insert services');
select isnt_empty($$select * from services$$, 'anon sees services');
select isnt_empty($$select * from gallery$$, 'anon sees gallery');
select isnt_empty($$select * from shop_status$$, 'anon sees shop_status');
select is_empty($$select * from bookings$$, 'anon cannot see bookings');
select throws_ok($$insert into bookings (barber_id, service_id, customer_name, phone, email, start_at, end_at)
  values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'D', '4', 'd@x.test',
          '2031-01-01 10:00+00', '2031-01-01 10:30+00')$$,
  '42501', null, 'anon cannot insert bookings');

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;
select is_empty($$select * from bookings$$, 'non-owner cannot see bookings');
select throws_ok($$insert into services (name, price_pence, duration_min) values ('x', 1, 1)$$,
  '42501', null, 'non-owner cannot insert services');
select throws_ok($$insert into gallery (storage_path) values ('x.jpg')$$,
  '42501', null, 'non-owner cannot insert gallery');

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
set local role authenticated;
select isnt_empty($$select * from bookings$$, 'owner can read bookings');
select lives_ok($$insert into services (name, price_pence, duration_min) values ('y', 1, 1)$$,
  'owner can insert services');
update services set price_pence = 1500 where id = '00000000-0000-0000-0000-0000000000a1';
select is((select price_pence from services where id = '00000000-0000-0000-0000-0000000000a1'), 1500,
  'owner can update services');

reset role;
select * from finish();
rollback;
