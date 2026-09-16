-- Event booking installment payment history
-- Run once in Supabase → SQL Editor.

alter table public.event_bookings
  add column if not exists payment_history jsonb not null default '[]'::jsonb;

comment on column public.event_bookings.payment_history is
  'Installment payment entries containing id, amount, and paid_at';
