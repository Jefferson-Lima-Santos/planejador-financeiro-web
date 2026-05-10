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
};

export type RecurringEntry = {
  id: string;
  entry_day: number;
  start_year: number;
  start_month: number;
  end_year: number | null;
  end_month: number | null;
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
  | "goals";

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
