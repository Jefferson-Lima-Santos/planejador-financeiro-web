create table if not exists public.goal_investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  name text not null,
  current_value_cents integer not null default 0 check (current_value_cents >= 0),
  monthly_contribution_cents integer not null default 0 check (monthly_contribution_cents >= 0),
  return_rate_basis_points integer not null default 0 check (return_rate_basis_points >= 0),
  return_rate_period text not null default 'annual'
    check (return_rate_period in ('monthly', 'annual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create index if not exists idx_goal_investments_goal
  on public.goal_investments(goal_id);

create index if not exists idx_goal_investments_user_active
  on public.goal_investments(user_id, deleted_at);

alter table public.goal_investments enable row level security;
alter table public.goal_investments alter column user_id set default auth.uid();

drop policy if exists "goal_investments_manage_own" on public.goal_investments;
create policy "goal_investments_manage_own"
  on public.goal_investments for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.goals g
      where g.id = goal_id
        and g.user_id = auth.uid()
        and g.deleted_at is null
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

drop trigger if exists audit_goal_investments on public.goal_investments;
create trigger audit_goal_investments
  after insert or update or delete on public.goal_investments
  for each row execute function public.audit_row_changes();
