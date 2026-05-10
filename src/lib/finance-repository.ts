import { supabase } from "@/lib/supabase";
import type {
  AuditLog,
  AuditLogTableName,
  BudgetMonth,
  BudgetTheme,
  Goal,
  MonthlyComparison,
  MonthlyIncomeEntry,
  MonthlyThemeEntry,
  RecurringEntry,
} from "@/types/finance";

const requireSupabase = () => {
  if (!supabase) {
    throw new Error(
      "Não foi possível conectar o serviço agora. Confira a configuração e tente novamente."
    );
  }

  return supabase;
};

const requireAuthenticatedUserId = async (): Promise<string> => {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    throw new Error("Sua sessão expirou. Entre novamente para continuar.");
  }

  return data.user.id;
};

const getYearMonth = (date: string): { year: number; month: number } => {
  const value = new Date(`${date}T00:00:00`);

  return {
    month: value.getMonth() + 1,
    year: value.getFullYear(),
  };
};

const getDayOfMonth = (date: string): number =>
  new Date(`${date}T00:00:00`).getDate();

const getDateInMonth = (year: number, month: number, day: number): string => {
  const lastDay = new Date(year, month, 0).getDate();
  const safeDay = Math.min(day, lastDay);
  const safeMonth = String(month).padStart(2, "0");
  const safeDayText = String(safeDay).padStart(2, "0");

  return `${year}-${safeMonth}-${safeDayText}`;
};

const isMonthInRange = (
  year: number,
  month: number,
  startYear: number,
  startMonth: number,
  endYear: number | null,
  endMonth: number | null
): boolean => {
  const value = year * 12 + month;
  const start = startYear * 12 + startMonth;
  const end = endYear && endMonth ? endYear * 12 + endMonth : null;

  return value >= start && (end === null || value <= end);
};

export async function ensureBudgetMonth(
  userId: string,
  year: number,
  month: number
): Promise<BudgetMonth> {
  const client = requireSupabase();
  const authenticatedUserId = await requireAuthenticatedUserId();

  const { data: existing, error: existingError } = await client
    .from("budget_months")
    .select("*")
    .eq("user_id", authenticatedUserId)
    .eq("year", year)
    .eq("month", month)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return existing as BudgetMonth;
  }

  const { data, error } = await client
    .from("budget_months")
    .insert({
      user_id: authenticatedUserId,
      year,
      month,
      salary_cents: 0,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as BudgetMonth;
}

export async function materializeRecurringEntries(
  budgetMonthId: string,
  year: number,
  month: number
): Promise<void> {
  const client = requireSupabase();
  const authenticatedUserId = await requireAuthenticatedUserId();

  const { data: recurringRows, error } = await client
    .from("recurring_entries")
    .select("*")
    .eq("user_id", authenticatedUserId)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }

  for (const recurring of recurringRows ?? []) {
    if (
      !isMonthInRange(
        year,
        month,
        recurring.start_year,
        recurring.start_month,
        recurring.end_year,
        recurring.end_month
      )
    ) {
      continue;
    }

    const tableName =
      recurring.entry_type === "income"
        ? "monthly_income_entries"
        : "monthly_theme_entries";
    const { data: existing, error: existingError } = await client
      .from(tableName)
      .select("id")
      .eq("budget_month_id", budgetMonthId)
      .eq("recurring_entry_id", recurring.id)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existing) {
      continue;
    }

    const entryDate = getDateInMonth(year, month, recurring.entry_day);

    if (recurring.entry_type === "income") {
      const { error: insertError } = await client
        .from("monthly_income_entries")
        .insert({
          amount_cents: recurring.amount_cents,
          budget_month_id: budgetMonthId,
          description: recurring.description,
          notes: recurring.notes,
          received_date: entryDate,
          recurring_entry_id: recurring.id,
          user_id: authenticatedUserId,
        });

      if (insertError) {
        throw insertError;
      }
    } else {
      const { error: insertError } = await client
        .from("monthly_theme_entries")
        .insert({
          amount_cents: recurring.amount_cents,
          budget_month_id: budgetMonthId,
          description: recurring.description,
          entry_date: entryDate,
          goal_id: recurring.goal_id,
          notes: recurring.notes,
          recurring_entry_id: recurring.id,
          theme_id: recurring.theme_id,
          user_id: authenticatedUserId,
          yield_percentage_bp: recurring.yield_percentage_bp ?? 0,
        });

      if (insertError) {
        throw insertError;
      }
    }
  }
}

export async function listBudgetThemes(): Promise<BudgetTheme[]> {
  const client = requireSupabase();

  const { data, error } = await client
    .from("budget_themes")
    .select("id, name, description, default_percentage_bp, target_behavior, sort_order")
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as BudgetTheme[];
}

export async function getRecurringEntry(entryId: string): Promise<RecurringEntry> {
  const client = requireSupabase();

  const { data, error } = await client
    .from("recurring_entries")
    .select("id, entry_day, start_year, start_month, end_year, end_month, yield_percentage_bp, goal_id")
    .eq("id", entryId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Recorrencia nao encontrada.");
  }

  return data as RecurringEntry;
}

export async function listMonthEntries(
  budgetMonthId: string
): Promise<MonthlyThemeEntry[]> {
  const client = requireSupabase();

  const { data, error } = await client
    .from("monthly_theme_entries")
    .select("*")
    .eq("budget_month_id", budgetMonthId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as MonthlyThemeEntry[];
}

export async function listMonthIncomeEntries(
  budgetMonthId: string
): Promise<MonthlyIncomeEntry[]> {
  const client = requireSupabase();

  const { data, error } = await client
    .from("monthly_income_entries")
    .select("*")
    .eq("budget_month_id", budgetMonthId)
    .order("received_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as MonthlyIncomeEntry[];
}

export async function listMonthGoals(budgetMonthId: string): Promise<Goal[]> {
  const client = requireSupabase();
  const authenticatedUserId = await requireAuthenticatedUserId();

  const { data, error } = await client
    .from("goals")
    .select("*")
    .eq("user_id", authenticatedUserId)
    .eq("budget_month_id", budgetMonthId)
    .is("deleted_at", null)
    .order("target_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as Goal[];
}

export async function listAuditLogsForRecord(
  tableName: AuditLogTableName,
  recordId: string
): Promise<AuditLog[]> {
  const client = requireSupabase();
  const authenticatedUserId = await requireAuthenticatedUserId();

  const { data, error } = await client
    .from("audit_logs")
    .select(
      "id, table_name, record_id, action, reason, old_values, new_values, created_at"
    )
    .eq("user_id", authenticatedUserId)
    .eq("table_name", tableName)
    .eq("record_id", recordId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as AuditLog[];
}

export async function listMonthlyComparisons(
  currentYear: number,
  currentMonth: number,
  limit = 6
): Promise<MonthlyComparison[]> {
  const client = requireSupabase();
  const authenticatedUserId = await requireAuthenticatedUserId();
  const currentOrder = currentYear * 100 + currentMonth;

  const { data: months, error: monthsError } = await client
    .from("budget_months")
    .select("id, year, month")
    .eq("user_id", authenticatedUserId)
    .is("deleted_at", null)
    .lte("year", currentYear)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(limit * 2);

  if (monthsError) {
    throw monthsError;
  }

  const selectedMonths = (months ?? [])
    .filter((month) => month.year * 100 + month.month <= currentOrder)
    .slice(0, limit)
    .reverse();
  const monthIds = selectedMonths.map((month) => month.id);

  if (monthIds.length === 0) {
    return [];
  }

  const [incomeResult, expenseResult] = await Promise.all([
    client
      .from("monthly_income_entries")
      .select("budget_month_id, amount_cents")
      .in("budget_month_id", monthIds)
      .is("deleted_at", null),
    client
      .from("monthly_theme_entries")
      .select("budget_month_id, amount_cents, recurring_entry_id")
      .in("budget_month_id", monthIds)
      .is("deleted_at", null),
  ]);

  if (incomeResult.error) {
    throw incomeResult.error;
  }

  if (expenseResult.error) {
    throw expenseResult.error;
  }

  return selectedMonths.map((month) => {
    const income = (incomeResult.data ?? [])
      .filter((entry) => entry.budget_month_id === month.id)
      .reduce((sum, entry) => sum + entry.amount_cents, 0);
    const plannedExpense = (expenseResult.data ?? [])
      .filter(
        (entry) =>
          entry.budget_month_id === month.id && Boolean(entry.recurring_entry_id)
      )
      .reduce((sum, entry) => sum + entry.amount_cents, 0);
    const unexpectedExpense = (expenseResult.data ?? [])
      .filter(
        (entry) =>
          entry.budget_month_id === month.id && !entry.recurring_entry_id
      )
      .reduce((sum, entry) => sum + entry.amount_cents, 0);

    return {
      balance_cents: income - plannedExpense - unexpectedExpense,
      budget_month_id: month.id,
      income_cents: income,
      label: `${String(month.month).padStart(2, "0")}/${month.year}`,
      month: month.month,
      planned_expense_cents: plannedExpense,
      unexpected_expense_cents: unexpectedExpense,
      year: month.year,
    };
  });
}

export async function createIncomeEntry(input: {
  budgetMonthId: string;
  description: string;
  amountCents: number;
  receivedDate: string;
  notes?: string;
  isRecurring?: boolean;
  recurrenceEndDate?: string;
  yieldPercentageBp?: number;
  goalId?: string;
}): Promise<void> {
  const client = requireSupabase();
  const authenticatedUserId = await requireAuthenticatedUserId();
  let recurringEntryId: string | null = null;

  if (input.isRecurring) {
    const start = getYearMonth(input.receivedDate);
    const end = input.recurrenceEndDate
      ? getYearMonth(input.recurrenceEndDate)
      : null;
    const { data, error } = await client
      .from("recurring_entries")
      .insert({
        amount_cents: input.amountCents,
        description: input.description,
        end_month: end?.month ?? null,
        end_year: end?.year ?? null,
        entry_day: getDayOfMonth(input.receivedDate),
        entry_type: "income",
        notes: input.notes || null,
        start_month: start.month,
        start_year: start.year,
        user_id: authenticatedUserId,
      })
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    recurringEntryId = data.id;
  }

  const { error } = await client.from("monthly_income_entries").insert({
    user_id: authenticatedUserId,
    budget_month_id: input.budgetMonthId,
    recurring_entry_id: recurringEntryId,
    description: input.description,
    amount_cents: input.amountCents,
    received_date: input.receivedDate,
    notes: input.notes || null,
  });

  if (error) {
    throw error;
  }
}

export async function updateIncomeEntry(input: {
  entryId: string;
  description: string;
  amountCents: number;
  receivedDate: string;
  notes?: string;
  changeReason?: string;
}): Promise<void> {
  const client = requireSupabase();

  const { error } = await client
    .from("monthly_income_entries")
    .update({
      description: input.description,
      amount_cents: input.amountCents,
      change_reason: input.changeReason || null,
      received_date: input.receivedDate,
      notes: input.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.entryId);

  if (error) {
    throw error;
  }
}

export async function softDeleteIncomeEntry(
  entryId: string,
  reason: string
): Promise<void> {
  const client = requireSupabase();

  const { error } = await client
    .from("monthly_income_entries")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_reason: reason || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entryId)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }
}

export async function restoreIncomeEntry(entryId: string): Promise<void> {
  const client = requireSupabase();

  const { error } = await client
    .from("monthly_income_entries")
    .update({
      deleted_at: null,
      deleted_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entryId);

  if (error) {
    throw error;
  }
}

export async function createEntry(input: {
  userId: string;
  budgetMonthId: string;
  themeId: string;
  description: string;
  amountCents: number;
  entryDate: string;
  notes?: string;
  isRecurring?: boolean;
  recurrenceEndDate?: string;
  yieldPercentageBp?: number;
  goalId?: string;
}): Promise<void> {
  const client = requireSupabase();
  const authenticatedUserId = await requireAuthenticatedUserId();
  let recurringEntryId: string | null = null;

  if (input.isRecurring) {
    const start = getYearMonth(input.entryDate);
    const end = input.recurrenceEndDate
      ? getYearMonth(input.recurrenceEndDate)
      : null;
    const { data, error } = await client
      .from("recurring_entries")
      .insert({
        amount_cents: input.amountCents,
        description: input.description,
        end_month: end?.month ?? null,
        end_year: end?.year ?? null,
        entry_day: getDayOfMonth(input.entryDate),
        entry_type: "expense",
        goal_id: input.goalId || null,
        notes: input.notes || null,
        start_month: start.month,
        start_year: start.year,
        theme_id: input.themeId,
        user_id: authenticatedUserId,
        yield_percentage_bp: input.yieldPercentageBp ?? 0,
      })
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    recurringEntryId = data.id;
  }

  const { error } = await client.from("monthly_theme_entries").insert({
    user_id: authenticatedUserId,
    budget_month_id: input.budgetMonthId,
    theme_id: input.themeId,
    recurring_entry_id: recurringEntryId,
    description: input.description,
    amount_cents: input.amountCents,
    entry_date: input.entryDate,
    goal_id: input.goalId || null,
    notes: input.notes || null,
    yield_percentage_bp: input.yieldPercentageBp ?? 0,
  });

  if (error) {
    throw error;
  }
}

export async function updateEntry(input: {
  entryId: string;
  description: string;
  amountCents: number;
  entryDate: string;
  themeId: string;
  isRecurring: boolean;
  recurrenceEndDate?: string;
  existingRecurringEntryId?: string | null;
  notes?: string;
  changeReason?: string;
  yieldPercentageBp?: number;
  goalId?: string;
}): Promise<void> {
  const client = requireSupabase();
  const authenticatedUserId = await requireAuthenticatedUserId();
  const now = new Date().toISOString();

  let recurringEntryId: string | null = input.existingRecurringEntryId ?? null;

  if (input.isRecurring) {
    const start = getYearMonth(input.entryDate);
    const end = input.recurrenceEndDate ? getYearMonth(input.recurrenceEndDate) : null;

    if (recurringEntryId) {
      const updatePayload: Record<string, unknown> = {
        amount_cents: input.amountCents,
        description: input.description,
        entry_day: getDayOfMonth(input.entryDate),
        entry_type: "expense",
        goal_id: input.goalId || null,
        notes: input.notes || null,
        start_month: start.month,
        start_year: start.year,
        theme_id: input.themeId,
        updated_at: now,
        yield_percentage_bp: input.yieldPercentageBp ?? 0,
        deleted_at: null,
        deleted_reason: null,
      };

      if (end) {
        updatePayload.end_month = end.month;
        updatePayload.end_year = end.year;
      }

      const { error: recurringError } = await client
        .from("recurring_entries")
        .update(updatePayload)
        .eq("id", recurringEntryId);

      if (recurringError) {
        throw recurringError;
      }
    } else {
      const { data, error: insertRecurringError } = await client
        .from("recurring_entries")
        .insert({
          amount_cents: input.amountCents,
          description: input.description,
          end_month: end?.month ?? null,
          end_year: end?.year ?? null,
          entry_day: getDayOfMonth(input.entryDate),
          entry_type: "expense",
          goal_id: input.goalId || null,
          notes: input.notes || null,
          start_month: start.month,
          start_year: start.year,
          theme_id: input.themeId,
          user_id: authenticatedUserId,
          yield_percentage_bp: input.yieldPercentageBp ?? 0,
        })
        .select("id")
        .single();

      if (insertRecurringError) {
        throw insertRecurringError;
      }

      recurringEntryId = data.id;
    }
  } else if (recurringEntryId) {
    const { error: disableError } = await client
      .from("recurring_entries")
      .update({
        deleted_at: now,
        deleted_reason: input.changeReason || null,
        updated_at: now,
      })
      .eq("id", recurringEntryId)
      .is("deleted_at", null);

    if (disableError) {
      throw disableError;
    }

    recurringEntryId = null;
  }

  const { error } = await client
    .from("monthly_theme_entries")
    .update({
      description: input.description,
      amount_cents: input.amountCents,
      change_reason: input.changeReason || null,
      entry_date: input.entryDate,
      goal_id: input.goalId || null,
      notes: input.notes || null,
      recurring_entry_id: recurringEntryId,
      updated_at: now,
      yield_percentage_bp: input.yieldPercentageBp ?? 0,
    })
    .eq("id", input.entryId);

  if (error) {
    throw error;
  }
}

export async function softDeleteEntry(
  entryId: string,
  reason: string
): Promise<void> {
  const client = requireSupabase();

  const { error } = await client
    .from("monthly_theme_entries")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_reason: reason || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entryId)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }
}

export async function restoreEntry(entryId: string): Promise<void> {
  const client = requireSupabase();

  const { error } = await client
    .from("monthly_theme_entries")
    .update({
      deleted_at: null,
      deleted_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entryId);

  if (error) {
    throw error;
  }
}
