-- =========================================================
-- Link event bookings ↔ room bookings
-- Run in Supabase → SQL Editor after events-booking-schema.sql
-- Safe to re-run
-- =========================================================

alter table public.bookings
  add column if not exists linked_event_booking_id uuid,
  add column if not exists linked_event_code text;

alter table public.event_bookings
  add column if not exists linked_room_booking_id uuid,
  add column if not exists linked_room_code text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_linked_event_booking_id_fkey'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_linked_event_booking_id_fkey
      foreign key (linked_event_booking_id)
      references public.event_bookings(id)
      on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'event_bookings_linked_room_booking_id_fkey'
      and conrelid = 'public.event_bookings'::regclass
  ) then
    alter table public.event_bookings
      add constraint event_bookings_linked_room_booking_id_fkey
      foreign key (linked_room_booking_id)
      references public.bookings(id)
      on delete set null;
  end if;
end $$;

create index if not exists bookings_linked_event_booking_id_idx
  on public.bookings (linked_event_booking_id);

create index if not exists event_bookings_linked_room_booking_id_idx
  on public.event_bookings (linked_room_booking_id);
