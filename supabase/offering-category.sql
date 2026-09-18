-- Separate swimming pool offerings from event areas
-- Run once in Supabase → SQL Editor.

alter table public.event_offerings
  add column if not exists category text not null default 'event';

alter table public.event_offerings
  drop constraint if exists event_offerings_category_check;

alter table public.event_offerings
  add constraint event_offerings_category_check
  check (category in ('event', 'pool'));

create index if not exists event_offerings_category_idx
  on public.event_offerings (category, is_active, sort_order);

comment on column public.event_offerings.category is
  'event = celebration/area booking; pool = day-use swimming package';
