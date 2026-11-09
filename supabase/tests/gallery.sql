begin;
select plan(30);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000e1'), ('00000000-0000-0000-0000-0000000000e2');
insert into owners (user_id) values ('00000000-0000-0000-0000-0000000000e2');
-- RLS is under test here, not the storage API's guard against direct SQL deletes
set local storage.allow_delete_query = 'true';

-- bucket config
select is((select public from storage.buckets where id = 'gallery'), true, 'gallery bucket is public');
select is((select file_size_limit from storage.buckets where id = 'gallery'), 5242880::bigint, 'gallery bucket caps files at 5MB');
select is((select allowed_mime_types from storage.buckets where id = 'gallery'), array['image/jpeg', 'image/png', 'image/webp'],
  'gallery bucket accepts only jpeg, png, webp');

insert into storage.objects (bucket_id, name) values ('gallery', 'gallery/seed.jpg');

-- anon: read only
set local role anon;
select is((select count(*)::int from storage.objects where bucket_id = 'gallery' and name = 'gallery/seed.jpg'), 1, 'anon can list gallery objects');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('gallery', 'gallery/anon.jpg')$$, '42501', null, 'anon cannot upload');
update storage.objects set name = 'gallery/moved.jpg' where name = 'gallery/seed.jpg';
delete from storage.objects where name = 'gallery/seed.jpg';
reset role;
select is((select count(*)::int from storage.objects where name = 'gallery/seed.jpg'), 1, 'anon update/delete of objects is a no-op');

-- signed-in non-owner: read only
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$insert into storage.objects (bucket_id, name) values ('gallery', 'gallery/user.jpg')$$, '42501', null, 'non-owner cannot upload');
update storage.objects set name = 'gallery/moved.jpg' where name = 'gallery/seed.jpg';
delete from storage.objects where name = 'gallery/seed.jpg';
reset role;
select is((select count(*)::int from storage.objects where name = 'gallery/seed.jpg'), 1, 'non-owner update/delete of objects is a no-op');

-- owner: full write on the gallery bucket only
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into storage.objects (bucket_id, name) values ('gallery', 'gallery/owner.jpg')$$, 'owner can upload');
select lives_ok($$update storage.objects set metadata = '{"x":1}' where name = 'gallery/owner.jpg'$$, 'owner can update');
select lives_ok($$delete from storage.objects where name = 'gallery/seed.jpg'$$, 'owner can delete');
reset role;
select is((select count(*)::int from storage.objects where name = 'gallery/seed.jpg'), 0, 'owner delete removed the object');
select is((select metadata->>'x' from storage.objects where name = 'gallery/owner.jpg'), '1', 'owner update applied');

-- move_gallery_photo: p1 sort 1, p2 sort 2, p3 sort 2 (duplicate; ties break on created_at)
insert into gallery (id, storage_path, sort, created_at) values
  ('00000000-0000-0000-0000-00000000f001', 'gallery/1.jpg', 1, '2030-01-01'),
  ('00000000-0000-0000-0000-00000000f002', 'gallery/2.jpg', 2, '2030-01-02'),
  ('00000000-0000-0000-0000-00000000f003', 'gallery/3.jpg', 2, '2030-01-03');
create view public.g_order as select string_agg(right(storage_path, 5), ',' order by sort, created_at) o from gallery;
grant select on g_order to anon, authenticated;

set local role anon;
select throws_ok($$select move_gallery_photo('00000000-0000-0000-0000-00000000f002', -1)$$, '42501', null, 'anon cannot reorder');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select move_gallery_photo('00000000-0000-0000-0000-00000000f002', -1)$$, '42501', null, 'non-owner cannot reorder');
reset role;
select is((select o from g_order), '1.jpg,2.jpg,3.jpg', 'refused reorders change nothing');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select move_gallery_photo('00000000-0000-0000-0000-00000000f003', -1)$$, 'owner moves the last photo up');
select is((select o from g_order), '1.jpg,3.jpg,2.jpg', 'swapped with its neighbour');
select is((select array_agg(sort order by sort) from gallery), array[1, 2, 3], 'sort renumbered 1..n with no duplicates');
select lives_ok($$select move_gallery_photo('00000000-0000-0000-0000-00000000f001', 1)$$, 'owner moves the first photo down');
select is((select o from g_order), '3.jpg,1.jpg,2.jpg', 'first moved down one');
select lives_ok($$select move_gallery_photo('00000000-0000-0000-0000-00000000f003', -1)$$, 'moving the top photo up is allowed');
select is((select o from g_order), '3.jpg,1.jpg,2.jpg', 'top edge: no change');
select lives_ok($$select move_gallery_photo('00000000-0000-0000-0000-00000000f002', 1)$$, 'moving the bottom photo down is allowed');
select is((select o from g_order), '3.jpg,1.jpg,2.jpg', 'bottom edge: no change');
select throws_ok($$select move_gallery_photo('00000000-0000-0000-0000-00000000f002', 2)$$, '22023', null, 'direction must be -1 or 1');
select throws_ok($$select move_gallery_photo('00000000-0000-0000-0000-00000000ffff', 1)$$, 'P0002', null, 'unknown photo is an error');
reset role;
select is((select array_agg(sort order by sort) from gallery), array[1, 2, 3], 'sort still unique after edges');

select ok(has_function_privilege('authenticated', 'move_gallery_photo(uuid,integer)', 'execute'), 'authenticated may call it (owner check inside)');
select ok(not has_function_privilege('anon', 'move_gallery_photo(uuid,integer)', 'execute'), 'anon has no execute grant');

select * from finish();
rollback;
