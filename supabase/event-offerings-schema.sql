-- =========================================================
-- Guest-facing event types (Birthday, Gatherings, …)
-- + until-when fields on event bookings
-- Run in Supabase → SQL Editor
-- Safe to re-run
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.event_offerings (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  slug          text not null unique,
  description   text,
  notes         text,
  price         numeric(12,2) not null default 0,
  capacity      integer not null default 0,
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists event_offerings_active_sort_idx
  on public.event_offerings (is_active, sort_order asc, created_at desc);

drop trigger if exists event_offerings_set_updated_at on public.event_offerings;
create trigger event_offerings_set_updated_at
before update on public.event_offerings
for each row execute function public.set_updated_at();

alter table public.event_offerings enable row level security;

grant select on table public.event_offerings to anon;
grant select, insert, update, delete on table public.event_offerings to authenticated;
grant all on table public.event_offerings to service_role;

drop policy if exists "Public read active event offerings" on public.event_offerings;
create policy "Public read active event offerings"
  on public.event_offerings for select to anon
  using (is_active = true);

drop policy if exists "Authenticated read event offerings" on public.event_offerings;
create policy "Authenticated read event offerings"
  on public.event_offerings for select to authenticated
  using (true);

drop policy if exists "Authenticated manage event offerings" on public.event_offerings;
create policy "Authenticated manage event offerings"
  on public.event_offerings for all to authenticated
  using (true) with check (true);

insert into public.event_offerings (title, slug, description, notes, sort_order)
select * from (
  values
    (
      'Birthday Celebration',
      'birthday-celebration',
      'Reserve the inn for a birthday — pool, indoor spaces, and room for family and friends.',
      'Tell us the guest of honor, expected headcount, and any cake or setup notes.',
      0
    ),
    (
      'Gatherings',
      'gatherings',
      'Family reunions, get-togethers, and private hangouts at Aeyyyy.',
      'Share the occasion and how long you plan to use the space.',
      1
    )
) as v(title, slug, description, notes, sort_order)
where not exists (select 1 from public.event_offerings);

alter table public.event_bookings
  alter column event_id drop not null;

alter table public.event_bookings
  add column if not exists offering_id uuid references public.event_offerings(id) on delete restrict,
  add column if not exists event_end_date date,
  add column if not exists start_time text,
  add column if not exists end_time text;

create index if not exists event_bookings_offering_id_idx
  on public.event_bookings (offering_id);
