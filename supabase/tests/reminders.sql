begin;
select plan(7);

insert into bookings (id, barber_id, service_id, customer_name, phone, email, start_at, end_at, status, cancel_token) values
  ('00000000-0000-0000-0000-000000001501', '00000000-0000-0000-0000-000000000001', (select id from services where name = 'Hair Cut'),
   'Ann Smith', '+447700900111', '', '2031-02-01 10:00+00', '2031-02-01 10:30+00', 'confirmed', '00000000-0000-0000-0000-000000001511'),
  ('00000000-0000-0000-0000-000000001502', '00000000-0000-0000-0000-000000000001', (select id from services where name = 'Hair Cut'),
   'Bob Jones', '+447700900222', '', '2031-02-01 11:00+00', '2031-02-01 11:30+00', 'confirmed', '00000000-0000-0000-0000-000000001512');

select ok(has_function_privilege('anon', 'set_reminders_off_by_token(uuid)', 'execute'), 'anon can stop reminders by token');
select ok(not has_function_privilege('public', 'set_reminders_off_by_token(uuid)', 'execute'), 'not granted to public');

set local role anon;
select is((select reminders_off from get_booking_by_token('00000000-0000-0000-0000-000000001511')), false, 'reminders on by default');
select is(set_reminders_off_by_token('00000000-0000-0000-0000-00000000ffff'), '{"ok":false,"reason":"not_found"}'::jsonb, 'unknown token: not_found');
select is(set_reminders_off_by_token('00000000-0000-0000-0000-000000001511'), '{"ok":true}'::jsonb, 'stop by token');
select is((select reminders_off from get_booking_by_token('00000000-0000-0000-0000-000000001511')), true, 'page sees reminders off');
reset role;
select is((select reminders_off from bookings where id = '00000000-0000-0000-0000-000000001502'), false, 'other bookings untouched');

select * from finish();
rollback;
