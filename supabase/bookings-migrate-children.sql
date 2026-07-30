-- Add children count to bookings (run in Supabase SQL Editor if column is missing)
alter table public.bookings
  add column if not exists children integer not null default 0
  check (children >= 0);
