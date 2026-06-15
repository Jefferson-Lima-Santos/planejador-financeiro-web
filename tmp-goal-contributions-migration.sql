alter table public.monthly_theme_entries
  add column if not exists goal_investment_id uuid references public.goal_investments(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'monthly_theme_entries_goal_investment_id_fkey'
  ) then
    alter table public.monthly_theme_entries
      add constraint monthly_theme_entries_goal_investment_id_fkey
      foreign key (goal_investment_id) references public.goal_investments(id) on delete set null;
  end if;
end $$;

create table if not exists public.goal_investment_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  budget_month_id uuid not null references public.budget_months(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  goal_investment_id uuid not null references public.goal_investments(id) on delete cascade,
  planned_amount_cents integer not null default 0 check (planned_amount_cents >= 0),
  confirmed_amount_cents integer not null default 0 check (confirmed_amount_cents >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'skipped')),
  monthly_theme_entry_id uuid references public.monthly_theme_entries(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create unique index if not exists idx_goal_investment_contributions_month_investment_active
  on public.goal_investment_contributions(budget_month_id, goal_investment_id)
  where deleted_at is null;

create index if not exists idx_goal_investment_contributions_goal
  on public.goal_investment_contributions(goal_id, budget_month_id);

alter table public.goal_investment_contributions enable row level security;
alter table public.goal_investment_contributions alter column user_id set default auth.uid();

drop policy if exists "goal_investment_contributions_manage_own" on public.goal_investment_contributions;
create policy "goal_investment_contributions_manage_own"
  on public.goal_investment_contributions for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.goal_investments gi
      join public.goals g on g.id = gi.goal_id
      where gi.id = goal_investment_id
        and g.user_id = auth.uid()
        and g.deleted_at is null
        and gi.deleted_at is null
    )
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

drop trigger if exists audit_goal_investment_contributions on public.goal_investment_contributions;
create trigger audit_goal_investment_contributions
  after insert or update or delete on public.goal_investment_contributions
  for each row execute function public.audit_row_changes();
