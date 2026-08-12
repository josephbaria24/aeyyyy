-- =========================================================
-- Event areas: photos + availability (instead of event types)
-- Run in Supabase → SQL Editor after event-offerings-schema.sql
-- Safe to re-run
-- =========================================================

alter table public.event_offerings
  add column if not exists image_urls text[] not null default '{}',
  add column if not exists availability text not null default 'open';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'event_offerings_availability_check'
      and conrelid = 'public.event_offerings'::regclass
  ) then
    alter table public.event_offerings
      add constraint event_offerings_availability_check
      check (availability in ('open', 'unavailable'));
  end if;
end $$;
