-- =========================================================
-- Room categories + site rules + events (landing page CMS)
-- Run in Supabase → SQL Editor after rooms-schema.sql
-- =========================================================

-- Room category (for booking/rooms filters)
alter table public.rooms
  add column if not exists category text not null default 'Standard';

alter table public.rooms
  add column if not exists image_urls text[] not null default '{}';

-- Backfill gallery from legacy single image_url
update public.rooms
set image_urls = array[image_url]
where image_url is not null
  and image_url <> ''
  and (image_urls is null or cardinality(image_urls) = 0);

create index if not exists rooms_category_idx on public.rooms (category);

-- House rules / regulations shown on landing page
create table if not exists public.site_rules (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  body          text not null,
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists site_rules_active_sort_idx
  on public.site_rules (is_active, sort_order asc, created_at desc);

drop trigger if exists site_rules_set_updated_at on public.site_rules;
create trigger site_rules_set_updated_at
before update on public.site_rules
for each row execute function public.set_updated_at();

alter table public.site_rules enable row level security;

grant select on table public.site_rules to anon;
grant select, insert, update, delete on table public.site_rules to authenticated;
grant all on table public.site_rules to service_role;

drop policy if exists "Public read active site rules" on public.site_rules;
create policy "Public read active site rules"
  on public.site_rules for select to anon
  using (is_active = true);

drop policy if exists "Authenticated read site rules" on public.site_rules;
create policy "Authenticated read site rules"
  on public.site_rules for select to authenticated
  using (true);

drop policy if exists "Authenticated manage site rules" on public.site_rules;
create policy "Authenticated manage site rules"
  on public.site_rules for all to authenticated
  using (true) with check (true);

-- Events shown on landing page (admin layout + social share)
create table if not exists public.events (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  slug          text not null unique,
  subtitle      text,
  description   text,
  image_url     text,
  event_date    date,
  location      text,
  layout        text not null default 'card'
                  check (layout in ('featured', 'card', 'wide')),
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists events_active_sort_idx
  on public.events (is_active, sort_order asc, event_date desc nulls last);

create index if not exists events_slug_idx on public.events (slug);

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

alter table public.events enable row level security;

grant select on table public.events to anon;
grant select, insert, update, delete on table public.events to authenticated;
grant all on table public.events to service_role;

drop policy if exists "Public read active events" on public.events;
create policy "Public read active events"
  on public.events for select to anon
  using (is_active = true);

drop policy if exists "Authenticated read events" on public.events;
create policy "Authenticated read events"
  on public.events for select to authenticated
  using (true);

drop policy if exists "Authenticated manage events" on public.events;
create policy "Authenticated manage events"
  on public.events for all to authenticated
  using (true) with check (true);

-- Bookable event fields (also in events-booking-schema.sql)
alter table public.events
  add column if not exists is_bookable boolean not null default false,
  add column if not exists price numeric(12,2) not null default 0,
  add column if not exists capacity integer not null default 0,
  add column if not exists start_time text,
  add column if not exists end_time text;
