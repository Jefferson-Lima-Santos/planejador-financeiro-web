create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  preference_key text not null,
  value_json jsonb not null default 'null'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create unique index if not exists idx_user_preferences_user_key
  on public.user_preferences(user_id, preference_key);

alter table public.user_preferences enable row level security;
alter table public.user_preferences alter column user_id set default auth.uid();

drop policy if exists "user_preferences_manage_own" on public.user_preferences;
create policy "user_preferences_manage_own"
  on public.user_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists audit_user_preferences on public.user_preferences;
create trigger audit_user_preferences
  after insert or update or delete on public.user_preferences
  for each row execute function public.audit_row_changes();

insert into public.user_preferences (user_id, preference_key, value_json, updated_at)
select p.id, 'theme_mode', '"dark"'::jsonb, now()
from public.profiles p
on conflict (user_id, preference_key) do update
set value_json = excluded.value_json,
    updated_at = excluded.updated_at;
