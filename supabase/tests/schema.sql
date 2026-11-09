begin;
select plan(8);

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
select lives_ok($$select * from services$$, 'anon can select services');
select isnt_empty($$select * from services$$, 'anon sees services rows');
select lives_ok($$select * from gallery$$, 'anon can select gallery');
select lives_ok($$select * from shop_status$$, 'anon can select shop_status');
select is_empty($$select * from bookings$$, 'anon cannot see bookings');

select * from finish();
rollback;
