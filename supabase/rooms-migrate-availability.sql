-- Manual room availability block (maintenance / closed)
-- Run in Supabase → SQL Editor

alter table public.rooms
  add column if not exists availability text not null default 'open'
  check (availability in ('open', 'unavailable'));

comment on column public.rooms.availability is 'open = bookable; unavailable = manually blocked (maintenance/closed)';
