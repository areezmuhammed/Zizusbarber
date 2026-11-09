begin;
select plan(20);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000c1'), ('00000000-0000-0000-0000-0000000000c2');
insert into owners (user_id) values ('00000000-0000-0000-0000-0000000000c2');

insert into bookings (id, barber_id, service_id, customer_name, phone, email, start_at, end_at, status, cancel_token)
select v.id::uuid, '00000000-0000-0000-0000-000000000001', (select id from services where name = 'Hair Cut'),
       v.n, '+447700900123', '', v.s::timestamptz, v.e::timestamptz, 'confirmed', v.t::uuid
from (values
  ('00000000-0000-0000-0000-00000000aa01', 'N1', '2030-01-01 10:00+00', '2030-01-01 10:20+00', '00000000-0000-0000-0000-00000000bb01'),
  ('00000000-0000-0000-0000-00000000aa02', 'N2', '2030-01-01 10:20+00', '2030-01-01 10:50+00', '00000000-0000-0000-0000-00000000bb02'),
  ('00000000-0000-0000-0000-00000000aa03', 'N3', '2030-01-02 10:00+00', '2030-01-02 10:30+00', '00000000-0000-0000-0000-00000000bb03'),
  ('00000000-0000-0000-0000-00000000aa04', 'N4', '2030-01-02 11:00+00', '2030-01-02 11:30+00', '00000000-0000-0000-0000-00000000bb04')
) v(id, n, s, e, t);

-- claim / idempotency (service role)
set local role service_role;
create temp table c1 as select claim_notification('00000000-0000-0000-0000-00000000aa01', 'confirmation', null, 'sms') id;
select isnt((select id from c1), null, 'first claim returns an id');
select is(claim_notification('00000000-0000-0000-0000-00000000aa01', 'confirmation', null, 'sms'), null, 'second claim of a pending row returns null');
update notifications set status = 'sent' where id = (select id from c1);
select is(claim_notification('00000000-0000-0000-0000-00000000aa01', 'confirmation', null, 'sms'), null, 'a sent row is never claimed again');
select throws_ok($$insert into notifications (booking_id, kind, channel) values ('00000000-0000-0000-0000-00000000aa01', 'confirmation', 'email')$$,
  '23505', null, 'unique key blocks a duplicate (null change_id counts as equal)');

create temp table c2 as select claim_notification('00000000-0000-0000-0000-00000000aa01', 'reminder_2h', null, 'sms') id;
update notifications set status = 'failed' where id = (select id from c2);
select is(claim_notification('00000000-0000-0000-0000-00000000aa01', 'reminder_2h', null, 'sms'), (select id from c2), 'failed row is re-claimed');
update notifications set status = 'failed' where id = (select id from c2);
select is(claim_notification('00000000-0000-0000-0000-00000000aa01', 'reminder_2h', null, 'sms'), (select id from c2), 'third attempt allowed');
update notifications set status = 'failed' where id = (select id from c2);
select is(claim_notification('00000000-0000-0000-0000-00000000aa01', 'reminder_2h', null, 'sms'), null, 'capped after 3 attempts');
select is((select attempts from notifications where id = (select id from c2)), 3, 'attempts counted');
reset role;

-- RLS: anon none, non-owner none, owner reads
set local role anon;
select throws_ok($$select count(*) from notifications$$, '42501', null, 'anon has no access to notifications');
select throws_ok($$select claim_notification('00000000-0000-0000-0000-00000000aa01', 'changed', null, 'sms')$$, '42501', null, 'anon cannot claim');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from notifications), 0, 'non-owner sees no notifications');
select throws_ok($$select claim_notification('00000000-0000-0000-0000-00000000aa01', 'changed', null, 'sms')$$, '42501', null, 'authenticated cannot claim');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from notifications), 2, 'owner reads notifications');
select throws_ok($$insert into notifications (booking_id, kind, channel) values ('00000000-0000-0000-0000-00000000aa02', 'confirmation', 'sms')$$,
  '42501', null, 'owner cannot write notifications directly');

-- extend_booking logs the target's own change as well as the moved booking's
select is(extend_booking('00000000-0000-0000-0000-00000000aa01', '2030-01-01 10:40+00', 'beard added'),
  '{"ok": true, "moved": ["00000000-0000-0000-0000-00000000aa02"]}'::jsonb, 'extend moves N2');
select is((select row(old_start, old_end, new_start, new_end, reason)::text from booking_changes
           where booking_id = '00000000-0000-0000-0000-00000000aa01'),
  row('2030-01-01 10:00+00'::timestamptz, '2030-01-01 10:20+00'::timestamptz,
      '2030-01-01 10:00+00'::timestamptz, '2030-01-01 10:40+00'::timestamptz, 'length changed')::text,
  'target end change logged in booking_changes');
select is((select count(*)::int from booking_changes where booking_id = '00000000-0000-0000-0000-00000000aa02'), 1, 'moved booking logged once');

-- owner cancel (admin setStatus: plain RLS update) is distinguishable from customer self-cancel
update bookings set status = 'cancelled' where id = '00000000-0000-0000-0000-00000000aa03';
select is((select cancelled_by from bookings where id = '00000000-0000-0000-0000-00000000aa03'), 'shop', 'owner cancel -> cancelled_by shop');
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select is(cancel_booking_by_token('00000000-0000-0000-0000-00000000bb04'), '{"ok": true}'::jsonb, 'customer self-cancels');
reset role;
select is((select cancelled_by from bookings where id = '00000000-0000-0000-0000-00000000aa04'), 'customer', 'self-cancel -> cancelled_by customer');

select * from finish();
rollback;
