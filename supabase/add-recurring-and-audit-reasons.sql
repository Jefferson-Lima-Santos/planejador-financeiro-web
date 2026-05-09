create extension if not exists pgcrypto;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'SOFT_DELETE', 'RESTORE', 'DELETE')),
  reason text,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs add column if not exists reason text;

create table if not exists public.recurring_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_type text not null check (entry_type in ('income', 'expense')),
  theme_id uuid,
  description text not null,
  amount_cents integer not null check (amount_cents >= 0),
  entry_day integer not null check (entry_day between 1 and 31),
  start_year integer not null,
  start_month integer not null check (start_month between 1 and 12),
  end_year integer,
  end_month integer check (end_month between 1 and 12),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz,
  deleted_reason text
);

alter table public.recurring_entries enable row level security;
alter table public.recurring_entries alter column user_id set default auth.uid();

alter table public.monthly_income_entries add column if not exists recurring_entry_id uuid;
alter table public.monthly_income_entries add column if not exists change_reason text;
alter table public.monthly_theme_entries add column if not exists recurring_entry_id uuid;
alter table public.monthly_theme_entries add column if not exists change_reason text;

drop policy if exists "recurring_entries_manage_own" on public.recurring_entries;
create policy "recurring_entries_manage_own"
  on public.recurring_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

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
  reason_text text;
begin
  if tg_op = 'INSERT' then
    action_name := 'INSERT';
    actor_id := coalesce((to_jsonb(new)->>'user_id')::uuid, auth.uid());
    row_id := new.id;
    reason_text := coalesce(to_jsonb(new)->>'change_reason', to_jsonb(new)->>'deleted_reason');

    insert into public.audit_logs (user_id, table_name, record_id, action, reason, old_values, new_values)
    values (actor_id, tg_table_name, row_id, action_name, reason_text, null, to_jsonb(new));

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
    reason_text := coalesce(to_jsonb(new)->>'change_reason', to_jsonb(new)->>'deleted_reason');

    insert into public.audit_logs (user_id, table_name, record_id, action, reason, old_values, new_values)
    values (actor_id, tg_table_name, row_id, action_name, reason_text, to_jsonb(old), to_jsonb(new));

    return new;
  end if;

  action_name := 'DELETE';
  actor_id := coalesce((to_jsonb(old)->>'user_id')::uuid, auth.uid());
  row_id := old.id;
  reason_text := coalesce(to_jsonb(old)->>'change_reason', to_jsonb(old)->>'deleted_reason');

  insert into public.audit_logs (user_id, table_name, record_id, action, reason, old_values, new_values)
  values (actor_id, tg_table_name, row_id, action_name, reason_text, to_jsonb(old), null);

  return old;
end;
$$;

drop trigger if exists audit_recurring_entries on public.recurring_entries;
create trigger audit_recurring_entries
  after insert or update or delete on public.recurring_entries
  for each row execute function public.audit_row_changes();
