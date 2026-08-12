-- =========================================================
-- Admin activity log (who created / updated / deleted what)
-- Run in Supabase → SQL Editor
-- =========================================================

create table if not exists public.activity_logs (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid,
  actor_email   text,
  action        text not null,
  entity        text not null,
  entity_id     text,
  summary       text not null,
  details       jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists activity_logs_created_at_idx
  on public.activity_logs (created_at desc);
create index if not exists activity_logs_actor_idx
  on public.activity_logs (actor_email);
create index if not exists activity_logs_entity_idx
  on public.activity_logs (entity, entity_id);

alter table public.activity_logs enable row level security;

grant select, insert on table public.activity_logs to authenticated;
grant all on table public.activity_logs to service_role;

drop policy if exists "Authenticated read activity logs" on public.activity_logs;
create policy "Authenticated read activity logs"
  on public.activity_logs for select to authenticated
  using (true);

drop policy if exists "Authenticated insert activity logs" on public.activity_logs;
create policy "Authenticated insert activity logs"
  on public.activity_logs for insert to authenticated
  with check (true);
