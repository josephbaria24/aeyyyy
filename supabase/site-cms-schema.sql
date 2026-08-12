-- =========================================================
-- Homepage CMS: hero, gallery, partners, footer, event listing
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

-- Event listing: upcoming / recent / past
alter table public.events
  add column if not exists listing text not null default 'upcoming';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'events_listing_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_listing_check
      check (listing in ('upcoming', 'recent', 'past'));
  end if;
end $$;

-- ---------------------------------------------------------
-- Singleton homepage / footer copy + images
-- ---------------------------------------------------------

create table if not exists public.site_settings (
  id                      text primary key default 'default',
  hero_image_url          text,
  hero_title              text,
  hero_italic             text,
  hero_subtitle           text,
  hero_address            text,
  hero_phone              text,
  gallery_kicker          text,
  gallery_title           text,
  gallery_body            text,
  difference_title        text,
  difference_body         text,
  difference_image_1      text,
  difference_image_2      text,
  difference_point_1_title text,
  difference_point_1_body  text,
  difference_point_2_title text,
  difference_point_2_body  text,
  difference_point_3_title text,
  difference_point_3_body  text,
  partners_title          text,
  partners_subtitle       text,
  footer_blurb            text,
  footer_phone            text,
  footer_email            text,
  footer_address          text,
  footer_instagram        text,
  footer_facebook         text,
  footer_twitter          text,
  footer_linkedin         text,
  footer_privacy_url      text,
  footer_terms_url        text,
  footer_cancellation_url text,
  updated_at              timestamptz not null default now()
);

insert into public.site_settings (id) values ('default')
on conflict (id) do nothing;

drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at
before update on public.site_settings
for each row execute function public.set_updated_at();

alter table public.site_settings enable row level security;

grant select on table public.site_settings to anon;
grant select, insert, update, delete on table public.site_settings to authenticated;
grant all on table public.site_settings to service_role;

drop policy if exists "Public read site settings" on public.site_settings;
create policy "Public read site settings"
  on public.site_settings for select to anon
  using (true);

drop policy if exists "Authenticated read site settings" on public.site_settings;
create policy "Authenticated read site settings"
  on public.site_settings for select to authenticated
  using (true);

drop policy if exists "Authenticated manage site settings" on public.site_settings;
create policy "Authenticated manage site settings"
  on public.site_settings for all to authenticated
  using (true) with check (true);

-- ---------------------------------------------------------
-- Hotel photo carousel
-- ---------------------------------------------------------

create table if not exists public.site_gallery (
  id          uuid primary key default gen_random_uuid(),
  image_url   text not null,
  title       text not null default '',
  subtitle    text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists site_gallery_sort_idx
  on public.site_gallery (is_active, sort_order asc, created_at desc);

drop trigger if exists site_gallery_set_updated_at on public.site_gallery;
create trigger site_gallery_set_updated_at
before update on public.site_gallery
for each row execute function public.set_updated_at();

alter table public.site_gallery enable row level security;

grant select on table public.site_gallery to anon;
grant select, insert, update, delete on table public.site_gallery to authenticated;
grant all on table public.site_gallery to service_role;

drop policy if exists "Public read active gallery" on public.site_gallery;
create policy "Public read active gallery"
  on public.site_gallery for select to anon
  using (is_active = true);

drop policy if exists "Authenticated read gallery" on public.site_gallery;
create policy "Authenticated read gallery"
  on public.site_gallery for select to authenticated
  using (true);

drop policy if exists "Authenticated manage gallery" on public.site_gallery;
create policy "Authenticated manage gallery"
  on public.site_gallery for all to authenticated
  using (true) with check (true);

insert into public.site_gallery (image_url, title, subtitle, sort_order)
select * from (
  values
    ('/images/gate.png', 'A Warm Welcome', 'Hotel Entrance', 0),
    ('/images/kitchen.png', 'Guest Kitchen', 'Convenient Amenities', 1),
    ('/images/hero2.webp', 'Poolside Relaxation', 'Rest & Recharge', 2),
    ('/images/hallway.png', 'Clean Hotel Hallways', 'Bright & Welcoming', 3),
    ('/images/beds.png', 'Comfortable Rooms', 'Rest Easy', 4),
    ('/images/band area.png', 'Music & Entertainment', 'Band Area', 5),
    ('/images/reception.png', 'Relaxing Common Areas', 'Guest Lounge', 6)
) as v(image_url, title, subtitle, sort_order)
where not exists (select 1 from public.site_gallery);

-- ---------------------------------------------------------
-- Partner / brand logos
-- ---------------------------------------------------------

create table if not exists public.site_partners (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  image_url   text,
  url         text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists site_partners_sort_idx
  on public.site_partners (is_active, sort_order asc, created_at desc);

drop trigger if exists site_partners_set_updated_at on public.site_partners;
create trigger site_partners_set_updated_at
before update on public.site_partners
for each row execute function public.set_updated_at();

alter table public.site_partners enable row level security;

grant select on table public.site_partners to anon;
grant select, insert, update, delete on table public.site_partners to authenticated;
grant all on table public.site_partners to service_role;

drop policy if exists "Public read active partners" on public.site_partners;
create policy "Public read active partners"
  on public.site_partners for select to anon
  using (is_active = true);

drop policy if exists "Authenticated read partners" on public.site_partners;
create policy "Authenticated read partners"
  on public.site_partners for select to authenticated
  using (true);

drop policy if exists "Authenticated manage partners" on public.site_partners;
create policy "Authenticated manage partners"
  on public.site_partners for all to authenticated
  using (true) with check (true);
