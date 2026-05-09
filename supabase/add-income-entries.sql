create extension if not exists pgcrypto;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'SOFT_DELETE', 'RESTORE', 'DELETE')),
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.audit_row_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  action_name text;
  actor_id uuid;
  row_id uuid;
begin
  if tg_op = 'INSERT' then
    action_name := 'INSERT';
    actor_id := coalesce((to_jsonb(new)->>'user_id')::uuid, auth.uid());
    row_id := new.id;

    insert into public.audit_logs (user_id, table_name, record_id, action, old_values, new_values)
    values (actor_id, tg_table_name, row_id, action_name, null, to_jsonb(new));

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.deleted_at is null and new.deleted_at is not null then
      action_name := 'SOFT_DELETE';
    elsif old.deleted_at is not null and new.deleted_at is null then
      action_name := 'RESTORE';
    else
      action_name := 'UPDATE';
    end if;

    actor_id := coalesce((to_jsonb(new)->>'user_id')::uuid, auth.uid());
    row_id := new.id;

    insert into public.audit_logs (user_id, table_name, record_id, action, old_values, new_values)
    values (actor_id, tg_table_name, row_id, action_name, to_jsonb(old), to_jsonb(new));

    return new;
  end if;

  action_name := 'DELETE';
  actor_id := coalesce((to_jsonb(old)->>'user_id')::uuid, auth.uid());
  row_id := old.id;

  insert into public.audit_logs (user_id, table_name, record_id, action, old_values, new_values)
  values (actor_id, tg_table_name, row_id, action_name, to_jsonb(old), null);

  return old;
end;
$$;

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
