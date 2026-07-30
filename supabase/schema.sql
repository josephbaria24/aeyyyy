-- =========================================================
-- Aeyyyy Traveller's Inn — Supabase schema
-- Run in: Supabase Dashboard → SQL Editor → New query
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- Table: bookings
-- Used by:
--   /book          → insert
--   /admin         → select + update status
-- Auth users are handled by Supabase Auth (auth.users)
-- ---------------------------------------------------------

create table if not exists public.bookings (
  id            uuid primary key default gen_random_uuid(),
  booking_code  text not null unique,                 -- e.g. BK4821
  name          text not null,                        -- guest full name
  email         text not null,                        -- guest email
  phone         text,                                 -- guest phone
  destination   text not null,                        -- Costa Rica, Marari Beach, etc.
  check_in      date not null,
  check_out     date not null,
  adults        integer not null default 1 check (adults > 0),
  children      integer not null default 0 check (children >= 0),
  rooms         integer not null default 1 check (rooms > 0),
  requests      text,
  status        text not null default 'pending'
                  check (status in ('pending', 'confirmed', 'declined', 'cancelled', 'rescheduled')),
  rate_per_night numeric(12,2) not null default 0,
  amount        numeric(12,2) not null default 0,
  amount_paid   numeric(12,2) not null default 0,
  other_charges jsonb not null default '[]'::jsonb,
  currency      text not null default 'PHP',
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint bookings_dates_valid check (check_out > check_in)
);

-- Keep updated_at current on every update
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at
before update on public.bookings
for each row
execute function public.set_updated_at();

-- Indexes for admin dashboard filters / sorting
create index if not exists bookings_created_at_idx on public.bookings (created_at desc);
create index if not exists bookings_status_idx on public.bookings (status);
create index if not exists bookings_email_idx on public.bookings (email);
create index if not exists bookings_check_in_idx on public.bookings (check_in);

-- ---------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------

alter table public.bookings enable row level security;

-- Privileges (required or API returns 403)
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on table public.bookings to authenticated;
grant insert on table public.bookings to anon;
grant all on table public.bookings to service_role;

-- Public booking form can create bookings
drop policy if exists "Anyone can create bookings" on public.bookings;
create policy "Anyone can create bookings"
  on public.bookings
  for insert
  to anon, authenticated
  with check (true);

-- Only signed-in admins can read bookings
drop policy if exists "Authenticated users can read bookings" on public.bookings;
create policy "Authenticated users can read bookings"
  on public.bookings
  for select
  to authenticated
  using (true);

-- Only signed-in admins can update booking status
drop policy if exists "Authenticated users can update bookings" on public.bookings;
create policy "Authenticated users can update bookings"
  on public.bookings
  for update
  to authenticated
  using (true)
  with check (true);

-- Only signed-in admins can delete bookings (optional)
drop policy if exists "Authenticated users can delete bookings" on public.bookings;
create policy "Authenticated users can delete bookings"
  on public.bookings
  for delete
  to authenticated
  using (true);
