-- Admin screenshot/photo attachments for event bookings
-- Run once in Supabase → SQL Editor.

alter table public.event_bookings
  add column if not exists attachment_urls text[] not null default '{}';

comment on column public.event_bookings.attachment_urls is
  'Admin-only Cloudinary screenshots or photos attached to an event booking';
