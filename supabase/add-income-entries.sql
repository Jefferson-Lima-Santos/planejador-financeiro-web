create table if not exists public.monthly_income_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  budget_month_id uuid not null references public.budget_months(id) on delete cascade,
  description text not null,
  amount_cents integer not null check (amount_cents >= 0),
  received_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz,
  deleted_reason text
);

create index if not exists idx_monthly_income_entries_month
  on public.monthly_income_entries(budget_month_id);

create index if not exists idx_monthly_income_entries_user_active
  on public.monthly_income_entries(user_id, deleted_at);

alter table public.monthly_income_entries enable row level security;
alter table public.monthly_income_entries alter column user_id set default auth.uid();

drop policy if exists "monthly_income_entries_manage_own" on public.monthly_income_entries;
create policy "monthly_income_entries_manage_own"
  on public.monthly_income_entries for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.budget_months bm
      where bm.id = budget_month_id
        and bm.user_id = auth.uid()
        and bm.deleted_at is null
    )
  );

drop trigger if exists audit_monthly_income_entries on public.monthly_income_entries;
create trigger audit_monthly_income_entries
  after insert or update or delete on public.monthly_income_entries
  for each row execute function public.audit_row_changes();
