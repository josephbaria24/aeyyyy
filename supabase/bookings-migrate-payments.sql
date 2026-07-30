-- Booking rate, payments, and extra payables (damages, minibar, etc.)
-- Run in Supabase → SQL Editor

alter table public.bookings
  add column if not exists rate_per_night numeric(12,2) not null default 0,
  add column if not exists amount_paid numeric(12,2) not null default 0,
  add column if not exists other_charges jsonb not null default '[]'::jsonb;

-- Ensure stay amount column exists (from accounting-schema)
alter table public.bookings
  add column if not exists amount numeric(12,2) not null default 0;

comment on column public.bookings.rate_per_night is 'Room nightly rate locked at booking time';
comment on column public.bookings.amount is 'Stay subtotal = rate_per_night × nights × rooms';
comment on column public.bookings.amount_paid is 'Total amount already paid by guest';
comment on column public.bookings.other_charges is 'JSON array of {label, amount} extras (damages, etc.)';
