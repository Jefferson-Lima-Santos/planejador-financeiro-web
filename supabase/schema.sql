create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create table if not exists public.budget_months (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),
  salary_cents integer not null default 0 check (salary_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create unique index if not exists idx_budget_months_user_year_month_active
  on public.budget_months(user_id, year, month)
  where deleted_at is null;

create table if not exists public.budget_themes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  default_percentage_bp integer not null check (default_percentage_bp >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create unique index if not exists idx_budget_themes_name_active
  on public.budget_themes(lower(name))
  where deleted_at is null;

create table if not exists public.monthly_theme_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  budget_month_id uuid not null references public.budget_months(id) on delete cascade,
  theme_id uuid not null references public.budget_themes(id),
  description text not null,
  amount_cents integer not null check (amount_cents >= 0),
  entry_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz,
  deleted_reason text
);

create index if not exists idx_monthly_theme_entries_month_theme
  on public.monthly_theme_entries(budget_month_id, theme_id);

create index if not exists idx_monthly_theme_entries_user_active
  on public.monthly_theme_entries(user_id, deleted_at);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  budget_month_id uuid references public.budget_months(id) on delete set null,
  name text not null,
  target_value_cents integer not null check (target_value_cents >= 0),
  current_value_cents integer not null default 0 check (current_value_cents >= 0),
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

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

alter table public.profiles enable row level security;
alter table public.budget_months enable row level security;
alter table public.budget_themes enable row level security;
alter table public.monthly_theme_entries enable row level security;
alter table public.goals enable row level security;
alter table public.audit_logs enable row level security;

alter table public.budget_months alter column user_id set default auth.uid();
alter table public.monthly_theme_entries alter column user_id set default auth.uid();
alter table public.goals alter column user_id set default auth.uid();

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "budget_months_manage_own" on public.budget_months;
create policy "budget_months_manage_own"
  on public.budget_months for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "budget_themes_read_active" on public.budget_themes;
create policy "budget_themes_read_active"
  on public.budget_themes for select
  using (deleted_at is null);

drop policy if exists "monthly_theme_entries_manage_own" on public.monthly_theme_entries;
create policy "monthly_theme_entries_manage_own"
  on public.monthly_theme_entries for all
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

drop policy if exists "goals_manage_own" on public.goals;
create policy "goals_manage_own"
  on public.goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "audit_logs_select_own" on public.audit_logs;
create policy "audit_logs_select_own"
  on public.audit_logs for select
  using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

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

drop trigger if exists audit_budget_months on public.budget_months;
create trigger audit_budget_months
  after insert or update or delete on public.budget_months
  for each row execute function public.audit_row_changes();

drop trigger if exists audit_monthly_theme_entries on public.monthly_theme_entries;
create trigger audit_monthly_theme_entries
  after insert or update or delete on public.monthly_theme_entries
  for each row execute function public.audit_row_changes();

drop trigger if exists audit_goals on public.goals;
create trigger audit_goals
  after insert or update or delete on public.goals
  for each row execute function public.audit_row_changes();

insert into public.budget_themes
  (name, description, default_percentage_bp, sort_order)
select *
from (
  values
    ('Gastos fixos', 'Aluguel, internet, luz, agua, gas, alimentacao etc', 3500, 1),
    ('Cartao de credito', 'Compras, parcelas e despesas pagas no cartao', 2000, 2),
    ('Educacao', 'Cursos, faculdade, pos-graduacao, idiomas etc', 1000, 3),
    ('Gastos excepcionais', 'Despesas fora do orcamento fixo', 1500, 4),
    ('Poupanca para o futuro', 'Dinheiro guardado ou investido', 1000, 5),
    ('Gastos livres', 'Demais gastos pessoais', 1000, 6)
) as seed(name, description, default_percentage_bp, sort_order)
where not exists (
  select 1
  from public.budget_themes existing
  where lower(existing.name) = lower(seed.name)
    and existing.deleted_at is null
);
