insert into barbers (id, name) values ('00000000-0000-0000-0000-000000000001', 'Zizus');

-- durations are placeholders - confirm with owner
insert into services (name, price_pence, duration_min, sort) values
  ('Hair Cut', 1400, 30, 1),
  ('Hair Cut and Beard', 2000, 45, 2),
  ('Beard', 800, 15, 3),
  ('Hot Towel Shave', 800, 20, 4),
  ('Face Mask', 700, 15, 5),
  ('Hair Cut and Designs', 500, 30, 6),
  ('Thread', 500, 10, 7),
  ('Facial Session', 2000, 30, 8);

-- Tue-Sun 09:30-20:00 local, Monday closed - confirm 09:30 vs 10:00
insert into opening_hours (weekday, open_local, close_local)
select d, '09:30', '20:00' from unnest(array[0,2,3,4,5,6]) d;

insert into shop_status (state) values ('closed') on conflict (id) do nothing; -- 016 already creates the row
