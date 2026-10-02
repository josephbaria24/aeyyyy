-- Optional corkage line on pool packages and event areas.
-- Run once in Supabase → SQL Editor. Safe to run again.

alter table public.event_offerings
  add column if not exists corkage_note text;

comment on column public.event_offerings.corkage_note is
  'Guest-facing corkage text, e.g. No corkage or ₱200 per bottle';
