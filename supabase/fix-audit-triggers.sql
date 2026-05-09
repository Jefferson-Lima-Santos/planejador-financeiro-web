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

alter table public.monthly_income_entries add column if not exists change_reason text;
alter table public.monthly_theme_entries add column if not exists change_reason text;
alter table public.audit_logs add column if not exists reason text;

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_select_own" on public.audit_logs;
create policy "audit_logs_select_own"
  on public.audit_logs for select
  using (auth.uid() = user_id);

create index if not exists idx_audit_logs_record
  on public.audit_logs(table_name, record_id, created_at desc);

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
  old_deleted_at text;
  new_deleted_at text;
begin
  if tg_op = 'INSERT' then
    action_name := 'INSERT';
    actor_id := coalesce(nullif(to_jsonb(new)->>'user_id', '')::uuid, auth.uid());
    row_id := new.id;
    reason_text := coalesce(to_jsonb(new)->>'change_reason', to_jsonb(new)->>'deleted_reason');

    insert into public.audit_logs (user_id, table_name, record_id, action, reason, old_values, new_values)
    values (actor_id, tg_table_name, row_id, action_name, reason_text, null, to_jsonb(new));

    return new;
  end if;

  if tg_op = 'UPDATE' then
    old_deleted_at := to_jsonb(old)->>'deleted_at';
    new_deleted_at := to_jsonb(new)->>'deleted_at';

    if old_deleted_at is null and new_deleted_at is not null then
      action_name := 'SOFT_DELETE';
    elsif old_deleted_at is not null and new_deleted_at is null then
      action_name := 'RESTORE';
    else
      action_name := 'UPDATE';
    end if;

    actor_id := coalesce(nullif(to_jsonb(new)->>'user_id', '')::uuid, auth.uid());
    row_id := new.id;
    reason_text := coalesce(to_jsonb(new)->>'change_reason', to_jsonb(new)->>'deleted_reason');

    insert into public.audit_logs (user_id, table_name, record_id, action, reason, old_values, new_values)
    values (actor_id, tg_table_name, row_id, action_name, reason_text, to_jsonb(old), to_jsonb(new));

    return new;
  end if;

  action_name := 'DELETE';
  actor_id := coalesce(nullif(to_jsonb(old)->>'user_id', '')::uuid, auth.uid());
  row_id := old.id;
  reason_text := coalesce(to_jsonb(old)->>'change_reason', to_jsonb(old)->>'deleted_reason');

  insert into public.audit_logs (user_id, table_name, record_id, action, reason, old_values, new_values)
  values (actor_id, tg_table_name, row_id, action_name, reason_text, to_jsonb(old), null);

  return old;
end;
$$;

drop trigger if exists audit_budget_months on public.budget_months;
create trigger audit_budget_months
  after insert or update or delete on public.budget_months
  for each row execute function public.audit_row_changes();

drop trigger if exists audit_monthly_income_entries on public.monthly_income_entries;
create trigger audit_monthly_income_entries
  after insert or update or delete on public.monthly_income_entries
  for each row execute function public.audit_row_changes();

drop trigger if exists audit_recurring_entries on public.recurring_entries;
create trigger audit_recurring_entries
  after insert or update or delete on public.recurring_entries
  for each row execute function public.audit_row_changes();

drop trigger if exists audit_monthly_theme_entries on public.monthly_theme_entries;
create trigger audit_monthly_theme_entries
  after insert or update or delete on public.monthly_theme_entries
  for each row execute function public.audit_row_changes();

drop trigger if exists audit_goals on public.goals;
create trigger audit_goals
  after insert or update or delete on public.goals
  for each row execute function public.audit_row_changes();

select
  trigger_name,
  event_object_table
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name in (
    'audit_budget_months',
    'audit_monthly_income_entries',
    'audit_recurring_entries',
    'audit_monthly_theme_entries',
    'audit_goals'
  )
order by event_object_table, trigger_name;
