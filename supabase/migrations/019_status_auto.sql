-- The public badge follows opening hours by default. A manual open/busy/closed choice applies only on the
-- London date stored here; on any other day (or null) the site shows the automatic state again.
alter table public.shop_status add column manual_date date;
