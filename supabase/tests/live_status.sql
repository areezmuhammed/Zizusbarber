begin;
select plan(14);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000c1'), ('00000000-0000-0000-0000-0000000000c2');
insert into owners (user_id) values ('00000000-0000-0000-0000-0000000000c2');
update shop_status set in_shop = 0, waiting = 49;

select ok(exists (select 1 from pg_publication_tables
  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shop_status'),
  'shop_status is in the realtime publication');

set local role anon;
select throws_ok($$select bump_shop_status('in_shop', 1)$$, '42501', null, 'anon cannot call bump_shop_status');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select bump_shop_status('in_shop', 1)$$, '42501', 'not_owner', 'non-owner is refused');
select is((select in_shop from shop_status), 0, 'non-owner changed nothing');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select lives_ok($$select bump_shop_status('in_shop', 1)$$, 'owner can bump');
select is((select in_shop from shop_status), 1, '+1 applied');
select bump_shop_status('in_shop', -5);
select is((select in_shop from shop_status), 0, 'clamped at 0');
select bump_shop_status('waiting', 10);
select is((select waiting from shop_status), 50, 'clamped at the cap 50');
select is((select in_shop from shop_status), 0, 'other counter untouched');
select throws_ok($$select bump_shop_status('state', 1)$$, 'P0001', 'invalid', 'unknown field refused');
select throws_ok($$update shop_status set note = repeat('x', 81)$$, '23514', null, 'note over 80 chars rejected');

select lives_ok($$update shop_status set manual_date = '2026-11-25'$$, 'owner can set the manual day');
set local role anon;
select is((select manual_date from shop_status), '2026-11-25'::date, 'anyone can read the manual day');
update shop_status set manual_date = null; -- RLS: matches no rows for anon
select is((select manual_date from shop_status), '2026-11-25'::date, 'anon cannot change the manual day');

select * from finish();
rollback;
