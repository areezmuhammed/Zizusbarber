-- Gallery photos (Task 14). Public bucket: anyone can read; only owners write.
-- Uploads go through a signed upload URL minted by an owner-only server action (the path is chosen server-side),
-- so these policies are the backstop: anon and non-owner sessions can never insert, update or delete objects.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy gallery_public_read on storage.objects for select using (bucket_id = 'gallery');
create policy gallery_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'gallery' and (select public.is_owner()));
create policy gallery_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'gallery' and (select public.is_owner())) with check (bucket_id = 'gallery' and (select public.is_owner()));
create policy gallery_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'gallery' and (select public.is_owner()));

-- Moves a photo one place up (-1) or down (1) and renumbers sort 1..n, all under one lock, so quick repeated taps
-- queue up instead of racing into duplicate sort values. Moving past either end is a no-op.
create function public.move_gallery_photo(p_id uuid, p_dir int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  ids uuid[];
  i int;
begin
  if not public.is_owner() then raise exception 'not an owner' using errcode = '42501'; end if;
  if p_dir is null or p_dir not in (-1, 1) then raise exception 'direction must be -1 or 1' using errcode = '22023'; end if;
  perform 1 from public.gallery for update;
  select array_agg(id order by sort, created_at, id) into ids from public.gallery;
  i := array_position(ids, p_id);
  if i is null then raise exception 'no such photo' using errcode = 'P0002'; end if;
  if i + p_dir between 1 and cardinality(ids) then
    ids[i] := ids[i + p_dir];
    ids[i + p_dir] := p_id;
  end if;
  update public.gallery g set sort = o.n from unnest(ids) with ordinality as o(id, n) where g.id = o.id and g.sort <> o.n;
end $$;

revoke execute on function public.move_gallery_photo(uuid, int) from public, anon;
grant execute on function public.move_gallery_photo(uuid, int) to authenticated;
