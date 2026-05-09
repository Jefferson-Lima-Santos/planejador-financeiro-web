alter table public.budget_months alter column user_id set default auth.uid();
alter table public.monthly_theme_entries alter column user_id set default auth.uid();
alter table public.goals alter column user_id set default auth.uid();

drop policy if exists "budget_months_manage_own" on public.budget_months;
create policy "budget_months_manage_own"
  on public.budget_months for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

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
