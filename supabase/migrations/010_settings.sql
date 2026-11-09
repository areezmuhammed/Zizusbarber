-- Owner settings (Task 13).
-- Fails loudly (and applies nothing) if existing data breaks these rules. Before applying to a database with
-- real data, clean first: keep one shop-wide opening_hours row per weekday (and per barber), one closures row
-- per date, and give any closure with only one of open_local/close_local set both values or neither.
-- One hours row per weekday (per barber, null = whole shop): the settings page edits a day, never a list of shifts.
alter table opening_hours
  add constraint opening_hours_one_per_day unique nulls not distinct (barber_id, weekday);

-- One closure per date: create_booking/extend_booking read a single row per day.
alter table closures add constraint closures_one_per_date unique (date);

-- Special hours are both set (close after open) or both null (closed all day).
alter table closures add constraint closures_hours_pair check (
  (open_local is null and close_local is null)
  or (open_local is not null and close_local is not null and close_local > open_local)
);
