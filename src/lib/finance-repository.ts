import { supabase } from "@/lib/supabase";
import type {
  BudgetMonth,
  BudgetTheme,
  MonthlyThemeEntry,
} from "@/types/finance";

const requireSupabase = () => {
  if (!supabase) {
    throw new Error("Supabase nao configurado. Crie o .env.local.");
  }

  return supabase;
};

const requireAuthenticatedUserId = async (): Promise<string> => {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    throw new Error("Sua sessao expirou. Entre novamente para continuar.");
  }

  return data.user.id;
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

export async function listBudgetThemes(): Promise<BudgetTheme[]> {
  const client = requireSupabase();

  const { data, error } = await client
    .from("budget_themes")
    .select("id, name, description, default_percentage_bp, sort_order")
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as BudgetTheme[];
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

export async function updateMonthSalary(
  budgetMonthId: string,
  salaryCents: number
): Promise<void> {
  const client = requireSupabase();

  const { error } = await client
    .from("budget_months")
    .update({
      salary_cents: salaryCents,
      updated_at: new Date().toISOString(),
    })
    .eq("id", budgetMonthId);

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
}): Promise<void> {
  const client = requireSupabase();
  const authenticatedUserId = await requireAuthenticatedUserId();

  const { error } = await client.from("monthly_theme_entries").insert({
    user_id: authenticatedUserId,
    budget_month_id: input.budgetMonthId,
    theme_id: input.themeId,
    description: input.description,
    amount_cents: input.amountCents,
    entry_date: input.entryDate,
    notes: input.notes || null,
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
  notes?: string;
}): Promise<void> {
  const client = requireSupabase();

  const { error } = await client
    .from("monthly_theme_entries")
    .update({
      description: input.description,
      amount_cents: input.amountCents,
      entry_date: input.entryDate,
      notes: input.notes || null,
      updated_at: new Date().toISOString(),
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
