-- =========================================================
-- Rooms catalog (public listing + admin CRUD)
-- Run in Supabase → SQL Editor after base schema exists
-- =========================================================

create table if not exists public.rooms (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  slug             text not null unique,
  description      text,
  amenities        text[] not null default '{}',
  price_per_night  numeric(12,2) not null default 0 check (price_per_night >= 0),
  currency         text not null default 'PHP',
  capacity         integer not null default 2 check (capacity > 0),
  image_url        text,
  image_urls       text[] not null default '{}',
  category         text not null default 'Standard',
  is_active        boolean not null default true,
  availability     text not null default 'open'
                     check (availability in ('open', 'unavailable')),
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists rooms_active_sort_idx
  on public.rooms (is_active, sort_order asc, created_at desc);

create index if not exists rooms_slug_idx on public.rooms (slug);
create index if not exists rooms_category_idx on public.rooms (category);

drop trigger if exists rooms_set_updated_at on public.rooms;
create trigger rooms_set_updated_at
before update on public.rooms
for each row execute function public.set_updated_at();

alter table public.rooms enable row level security;

grant select on table public.rooms to anon;
grant select, insert, update, delete on table public.rooms to authenticated;
grant all on table public.rooms to service_role;

drop policy if exists "Public read active rooms" on public.rooms;
create policy "Public read active rooms"
  on public.rooms for select to anon
  using (is_active = true);

drop policy if exists "Authenticated read rooms" on public.rooms;
create policy "Authenticated read rooms"
  on public.rooms for select to authenticated
  using (true);

drop policy if exists "Authenticated manage rooms" on public.rooms;
create policy "Authenticated manage rooms"
  on public.rooms for all to authenticated
  using (true) with check (true);
