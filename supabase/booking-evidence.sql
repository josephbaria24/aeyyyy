-- Admin evidence screenshots/photos for room bookings
-- Run once in Supabase → SQL Editor.

alter table public.bookings
  add column if not exists evidence_urls text[] not null default '{}';

comment on column public.bookings.evidence_urls is
  'Admin-only Cloudinary image URLs proving external or manual reservations';
