-- =========================================================
-- FIX: 403 on /rest/v1/bookings
-- Run this NOW in Supabase → SQL Editor
-- =========================================================

-- 1) Allow API roles to use the table
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on table public.bookings to authenticated;
grant insert on table public.bookings to anon;
grant all on table public.bookings to service_role;

-- 2) Make sure RLS policies exist
alter table public.bookings enable row level security;

drop policy if exists "Anyone can create bookings" on public.bookings;
create policy "Anyone can create bookings"
  on public.bookings
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Authenticated users can read bookings" on public.bookings;
create policy "Authenticated users can read bookings"
  on public.bookings
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can update bookings" on public.bookings;
create policy "Authenticated users can update bookings"
  on public.bookings
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete bookings" on public.bookings;
create policy "Authenticated users can delete bookings"
  on public.bookings
  for delete
  to authenticated
  using (true);
