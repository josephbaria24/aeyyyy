-- =========================================================
-- Enable Realtime for admin cache invalidation
-- Safe: only adds tables that already exist
-- Run in Supabase → SQL Editor
-- =========================================================

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'bookings',
    'rooms',
    'income',
    'expenses',
    'site_rules',
    'events'
  ]
  loop
    if to_regclass('public.' || tbl) is not null then
      begin
        execute format(
          'alter publication supabase_realtime add table public.%I',
          tbl
        );
      exception
        when duplicate_object then
          null; -- already in publication
      end;
    end if;
  end loop;
end $$;
