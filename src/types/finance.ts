export type BudgetMonth = {
  id: string;
  user_id: string;
  year: number;
  month: number;
  salary_cents: number;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
};

export type BudgetTheme = {
  id: string;
  name: string;
  description: string | null;
  default_percentage_bp: number;
  target_behavior: "expense_limit" | "saving_goal";
  sort_order: number;
};

export type MonthlyThemeEntry = {
  id: string;
  user_id: string;
  budget_month_id: string;
  theme_id: string;
  recurring_entry_id: string | null;
  description: string;
  amount_cents: number;
  entry_date: string;
  notes: string | null;
  yield_percentage_bp: number;
  goal_id: string | null;
  goal_investment_id: string | null;
  change_reason: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  deleted_reason: string | null;
};

export type MonthlyIncomeEntry = {
  id: string;
  user_id: string;
  budget_month_id: string;
  recurring_entry_id: string | null;
  description: string;
  amount_cents: number;
  received_date: string;
  notes: string | null;
  change_reason: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  deleted_reason: string | null;
};

export type MonthlyComparison = {
  budget_month_id: string;
  label: string;
  year: number;
  month: number;
  income_cents: number;
  planned_expense_cents: number;
  unexpected_expense_cents: number;
  balance_cents: number;
};

export type Goal = {
  id: string;
  user_id: string;
  budget_month_id: string | null;
  name: string;
  target_value_cents: number;
  current_value_cents: number;
  target_date: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  investments?: GoalInvestment[];
  investment_total_cents?: number;
  linked_savings_cents?: number;
  manual_current_value_cents?: number;
  months_to_target?: number | null;
  projected_value_cents?: number;
  required_monthly_contribution_cents?: number | null;
  required_additional_monthly_contribution_cents?: number | null;
  target_status?: "on_track" | "needs_more" | "no_target_date" | "expired";
  total_saved_cents?: number;
};

export type GoalInvestment = {
  id: string;
  user_id: string;
  goal_id: string;
  name: string;
  current_value_cents: number;
  monthly_contribution_cents: number;
  return_rate_basis_points: number;
  return_rate_period: "monthly" | "annual";
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  contribution?: GoalInvestmentContribution | null;
};

export type GoalInvestmentContribution = {
  id: string;
  user_id: string;
  budget_month_id: string;
  goal_id: string;
  goal_investment_id: string;
  planned_amount_cents: number;
  confirmed_amount_cents: number;
  status: "pending" | "confirmed" | "skipped";
  monthly_theme_entry_id: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
};

export type GoalInvestmentDraft = {
  id?: string;
  currentValueCents: number;
  monthlyContributionCents: number;
  name: string;
  returnRateBasisPoints: number;
  returnRatePeriod: "monthly" | "annual";
};

export type ThemeSummary = BudgetTheme & {
  total_cents: number;
  recommended_cents: number;
  spent_percentage_bp: number;
};

export type EntryFormValues = {
  description: string;
  amount: string;
  entryDate: string;
  notes: string;
  isRecurring: boolean;
  recurrenceEndDate: string;
  changeReason: string;
  yieldPercentage: string;
  goalId: string;
};

export type RecurringEntry = {
  id: string;
  entry_day: number;
  start_year: number;
  start_month: number;
  end_year: number | null;
  end_month: number | null;
  yield_percentage_bp: number;
  goal_id: string | null;
};

export type AuditLogAction =
  | "INSERT"
  | "UPDATE"
  | "SOFT_DELETE"
  | "RESTORE"
  | "DELETE";

export type AuditLogTableName =
  | "budget_months"
  | "monthly_income_entries"
  | "monthly_theme_entries"
  | "recurring_entries"
  | "goals"
  | "goal_investments"
  | "goal_investment_contributions"
  | "user_preferences";

export type AuditLog = {
  id: string;
  table_name: AuditLogTableName;
  record_id: string;
  action: AuditLogAction | string;
  reason: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
};
