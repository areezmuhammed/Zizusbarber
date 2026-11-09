create extension if not exists btree_gist;

create table owners (user_id uuid primary key references auth.users on delete cascade);

create table barbers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true
);

create table services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_pence integer not null check (price_pence >= 0),
  duration_min integer not null check (duration_min > 0),
  active boolean not null default true,
  sort integer not null default 0
);

-- local wall-clock times (Europe/London), never UTC; weekday 0=Sunday..6=Saturday
create table opening_hours (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid references barbers on delete cascade, -- null = whole shop
  weekday smallint not null check (weekday between 0 and 6),
  open_local time not null,
  close_local time not null check (close_local > open_local)
);

create table closures (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  reason text,
  open_local time, -- optional special hours; both null = closed all day
  close_local time
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references barbers,
  service_id uuid not null references services,
  customer_name text not null,
  phone text not null,
  email text not null,
  start_at timestamptz not null,
  end_at timestamptz not null check (end_at > start_at),
  status text not null default 'pending'
    check (status in ('pending','confirmed','arrived','done','no_show','cancelled')),
  cancel_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  constraint no_overlap exclude using gist (
    barber_id with =, tstzrange(start_at, end_at, '[)') with &&
  ) where (status in ('pending','confirmed','arrived'))
);

create table booking_changes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings on delete cascade,
  old_start timestamptz not null,
  old_end timestamptz not null,
  new_start timestamptz not null,
  new_end timestamptz not null,
  reason text,
  at timestamptz not null default now()
);

create table shop_status (
  id boolean primary key default true check (id), -- single row
  state text not null default 'closed' check (state in ('open','busy','closed')),
  in_shop integer not null default 0 check (in_shop >= 0),
  waiting integer not null default 0 check (waiting >= 0),
  note text
);

create table gallery (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  alt text not null default '',
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
