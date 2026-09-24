-- Day-use / timed room stays (e.g. 6-hour walk-in)
-- Run once in Supabase → SQL Editor.

alter table public.bookings
  add column if not exists stay_kind text not null default 'overnight';

alter table public.bookings
  drop constraint if exists bookings_stay_kind_check;

alter table public.bookings
  add constraint bookings_stay_kind_check
  check (stay_kind in ('overnight', 'day_use'));

alter table public.bookings
  add column if not exists start_time text,
  add column if not exists end_time text;

comment on column public.bookings.stay_kind is
  'overnight = nightly stay; day_use = timed same-day stay (hours)';
comment on column public.bookings.start_time is
  'Optional local start time for day_use stays (HH:MM)';
comment on column public.bookings.end_time is
  'Optional local end time for day_use stays (HH:MM)';

create index if not exists bookings_stay_kind_idx
  on public.bookings (stay_kind);
