-- Room booking source: walk-in, Agoda, Booking.com, website, or other.
-- Safe to run again if an earlier version of this file was already applied.

alter table public.bookings
  add column if not exists booking_channel text;

alter table public.bookings
  add column if not exists booking_channel_detail text;

alter table public.bookings
  drop constraint if exists bookings_channel_check;

alter table public.bookings
  add constraint bookings_channel_check
  check (
    booking_channel is null
    or booking_channel in ('walk_in', 'agoda', 'booking_com', 'website', 'other')
  );

-- Recover channels that were only written into notes.
update public.bookings
set booking_channel = 'booking_com'
where booking_channel is null
  and (
    coalesce(notes, '') ilike '%booking.com%'
    or coalesce(notes, '') ilike '%booking com%'
    or coalesce(requests, '') ilike '%booking.com%'
  );

update public.bookings
set booking_channel = 'agoda'
where booking_channel is null
  and (
    coalesce(notes, '') ilike '%agoda%'
    or coalesce(requests, '') ilike '%agoda%'
  );

update public.bookings
set booking_channel = 'walk_in'
where booking_channel is null
  and (
    booking_code ilike 'WI%'
    or coalesce(notes, '') ilike '%walk-in%'
    or coalesce(notes, '') ilike '%walk in%'
  );

update public.bookings
set booking_channel = 'website'
where booking_channel is null;

comment on column public.bookings.booking_channel is
  'walk_in, agoda, booking_com, website, or other';
comment on column public.bookings.booking_channel_detail is
  'Custom source name when booking_channel is other';
