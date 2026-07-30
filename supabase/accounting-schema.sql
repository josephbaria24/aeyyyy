-- =========================================================
-- Accounting + booking amount fields
-- Run in Supabase → SQL Editor after bookings table exists
-- =========================================================

-- Booking total amount (for receipts / income)
alter table public.bookings
  add column if not exists amount numeric(12,2) not null default 0,
  add column if not exists currency text not null default 'PHP',
  add column if not exists notes text;

-- Income records
create table if not exists public.income (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  category      text not null default 'booking'
                  check (category in ('booking', 'food', 'tour', 'other')),
  amount        numeric(12,2) not null check (amount >= 0),
  currency      text not null default 'PHP',
  income_date   date not null default current_date,
  booking_id    uuid references public.bookings(id) on delete set null,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Expense records
create table if not exists public.expenses (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  category      text not null default 'operations'
                  check (category in ('operations', 'utilities', 'payroll', 'supplies', 'maintenance', 'marketing', 'other')),
  amount        numeric(12,2) not null check (amount >= 0),
  currency      text not null default 'PHP',
  expense_date  date not null default current_date,
  receipt_url   text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists income_date_idx on public.income (income_date desc);
create index if not exists income_booking_id_idx on public.income (booking_id);
create index if not exists expenses_date_idx on public.expenses (expense_date desc);
create index if not exists expenses_category_idx on public.expenses (category);

drop trigger if exists income_set_updated_at on public.income;
create trigger income_set_updated_at
before update on public.income
for each row execute function public.set_updated_at();

drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

alter table public.income enable row level security;
alter table public.expenses enable row level security;

grant select, insert, update, delete on table public.income to authenticated;
grant select, insert, update, delete on table public.expenses to authenticated;
grant all on table public.income to service_role;
grant all on table public.expenses to service_role;

drop policy if exists "Authenticated manage income" on public.income;
create policy "Authenticated manage income"
  on public.income for all to authenticated
  using (true) with check (true);

drop policy if exists "Authenticated manage expenses" on public.expenses;
create policy "Authenticated manage expenses"
  on public.expenses for all to authenticated
  using (true) with check (true);
