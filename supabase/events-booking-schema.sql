-- =========================================================
-- Bookable events + event reservations
-- Run in Supabase → SQL Editor after content-schema.sql
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.events
  add column if not exists is_bookable boolean not null default false,
  add column if not exists price numeric(12,2) not null default 0,
  add column if not exists capacity integer not null default 0,
  add column if not exists start_time text,
  add column if not exists end_time text;

create table if not exists public.event_bookings (
  id            uuid primary key default gen_random_uuid(),
  booking_code  text not null unique,
  event_id      uuid not null references public.events(id) on delete restrict,
  event_title   text not null,
  event_date    date,
  name          text not null,
  email         text not null,
  phone         text,
  guests        integer not null default 1 check (guests > 0),
  requests      text,
  status        text not null default 'pending'
                  check (status in ('pending', 'confirmed', 'declined', 'cancelled', 'rescheduled')),
  amount        numeric(12,2) not null default 0,
  amount_paid   numeric(12,2) not null default 0,
  currency      text not null default 'PHP',
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists event_bookings_created_at_idx
  on public.event_bookings (created_at desc);
create index if not exists event_bookings_status_idx
  on public.event_bookings (status);
create index if not exists event_bookings_event_id_idx
  on public.event_bookings (event_id);
create index if not exists event_bookings_code_idx
  on public.event_bookings (booking_code);

drop trigger if exists event_bookings_set_updated_at on public.event_bookings;
create trigger event_bookings_set_updated_at
before update on public.event_bookings
for each row execute function public.set_updated_at();

alter table public.event_bookings enable row level security;

grant select, insert, update, delete on table public.event_bookings to authenticated;
grant insert on table public.event_bookings to anon;
grant all on table public.event_bookings to service_role;

drop policy if exists "Anyone can create event bookings" on public.event_bookings;
create policy "Anyone can create event bookings"
  on public.event_bookings for insert to anon
  with check (true);

drop policy if exists "Authenticated read event bookings" on public.event_bookings;
create policy "Authenticated read event bookings"
  on public.event_bookings for select to authenticated
  using (true);

drop policy if exists "Authenticated manage event bookings" on public.event_bookings;
create policy "Authenticated manage event bookings"
  on public.event_bookings for all to authenticated
  using (true) with check (true);
