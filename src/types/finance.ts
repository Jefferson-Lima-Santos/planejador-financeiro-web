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
