-- =========================================================
-- Rooms columns used by admin (category + gallery)
-- Run in Supabase → SQL Editor if room save returns 400
-- =========================================================

alter table public.rooms
  add column if not exists category text not null default 'Standard';

alter table public.rooms
  add column if not exists image_urls text[] not null default '{}';

create index if not exists rooms_category_idx on public.rooms (category);

-- Backfill gallery from legacy single image_url
update public.rooms
set image_urls = array[image_url]
where image_url is not null
  and image_url <> ''
  and (image_urls is null or cardinality(image_urls) = 0);
