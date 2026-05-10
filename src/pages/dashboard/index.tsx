import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/pt-br";
import {
  AddOutlined,
  ArrowBackIosNewOutlined,
  CloseOutlined,
  DeleteOutlineOutlined,
  EditOutlined,
  HistoryOutlined,
  ReplayOutlined,
  SaveOutlined,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControlLabel,
  IconButton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useRecoilValue } from "recoil";
import { AppTextField, MoneyTextField } from "@/components/form-fields";
import { financeColors } from "@/components/financialDashboard/dashboardColors";
import { AuthGuard } from "@/guards/auth-guard";
import { DashboardLayout } from "@/layouts/dashboard-layout";
import { ExpensesSection, HeroSection, MonthlyDataSection, SummarySection } from "@/sections/financialDashboard";
import { useAuth } from "@/contexts/auth-context";
import { authTokenRefreshTickAtom } from "@/state/atoms/auth";
import { tokens } from "@/locales/tokens";
import {
  createEntry,
  createIncomeEntry,
  ensureBudgetMonth,
  getRecurringEntry,
  listMonthGoals,
  listAuditLogsForRecord,
  listBudgetThemes,
  listMonthlyComparisons,
  listMonthIncomeEntries,
  listMonthEntries,
  materializeRecurringEntries,
  restoreIncomeEntry,
  restoreEntry,
  softDeleteIncomeEntry,
  softDeleteEntry,
  updateIncomeEntry,
  updateEntry,
} from "@/lib/finance-repository";
import type {
  AuditLog,
  BudgetMonth,
  BudgetTheme,
  EntryFormValues,
  Goal,
  MonthlyComparison,
  MonthlyIncomeEntry,
  MonthlyThemeEntry,
  ThemeSummary,
} from "@/types/finance";
import {
  centsToCurrency,
  centsToInputValue,
  currencyInputToCents,
} from "@/utils/money";

dayjs.locale("pt-br");

const emptyEntryForm = (themeId = ""): EntryFormValues & { themeId: string } => ({
  amount: "",
  changeReason: "",
  description: "",
  entryDate: dayjs().format("YYYY-MM-DD"),
  isRecurring: false,
  notes: "",
  recurrenceEndDate: "",
  themeId,
});

const emptyIncomeForm = (): EntryFormValues => ({
  amount: "",
  changeReason: "",
  description: "",
  entryDate: dayjs().format("YYYY-MM-DD"),
  isRecurring: false,
  notes: "",
  recurrenceEndDate: "",
});

const sortAuditLogs = (logs: AuditLog[]) =>
  [...logs].sort(
    (first, second) =>
      new Date(second.created_at).getTime() - new Date(first.created_at).getTime()
  );

type MonthTransitionDirection = "next" | "previous";
type MonthTransitionPhase = "idle" | "exit" | "enter";
export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <FinancialDashboard />
      </DashboardLayout>
    </AuthGuard>
  );
}

function FinancialDashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isMobile = useMediaQuery("(max-width:600px)");
  const userId = user?.id ?? null;
  const tokenRefreshTick = useRecoilValue(authTokenRefreshTickAtom);
  const expensesSectionRef = useRef<HTMLDivElement | null>(null);
  const lastLoadedRef = useRef<{ key: string; tokenTick: number } | null>(null);
  const monthTransitionTimeoutsRef = useRef<number[]>([]);
  const [currentMonth, setCurrentMonth] = useState<Dayjs>(dayjs().startOf("month"));
  const [budgetMonth, setBudgetMonth] = useState<BudgetMonth | null>(null);
  const [comparisons, setComparisons] = useState<MonthlyComparison[]>([]);
  const [themes, setThemes] = useState<BudgetTheme[]>([]);
  const [entries, setEntries] = useState<MonthlyThemeEntry[]>([]);
  const [incomeEntries, setIncomeEntries] = useState<MonthlyIncomeEntry[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [incomeDrawerOpen, setIncomeDrawerOpen] = useState(false);
  const [incomeDrawerTab, setIncomeDrawerTab] = useState<"active" | "deleted">("active");
  const [incomeFormValues, setIncomeFormValues] = useState(emptyIncomeForm());
  const [editingIncomeEntry, setEditingIncomeEntry] =
    useState<MonthlyIncomeEntry | null>(null);
  const [incomeEditDialogOpen, setIncomeEditDialogOpen] = useState(false);
  const [incomeAuditLogs, setIncomeAuditLogs] = useState<AuditLog[]>([]);
  const [incomeAuditLoading, setIncomeAuditLoading] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<ThemeSummary | null>(null);
  const [drawerTab, setDrawerTab] = useState<"active" | "deleted">("active");
  const [formValues, setFormValues] = useState(emptyEntryForm());
  const [editingEntry, setEditingEntry] = useState<MonthlyThemeEntry | null>(null);
  const [expenseEditDialogOpen, setExpenseEditDialogOpen] = useState(false);
  const [expenseAuditLogs, setExpenseAuditLogs] = useState<AuditLog[]>([]);
  const [expenseAuditLoading, setExpenseAuditLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MonthlyThemeEntry | null>(null);
  const [incomeDeleteTarget, setIncomeDeleteTarget] =
    useState<MonthlyIncomeEntry | null>(null);
  const [expenseThemeDialogOpen, setExpenseThemeDialogOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [monthTransitionDirection, setMonthTransitionDirection] =
    useState<MonthTransitionDirection>("next");
  const [monthTransitionPhase, setMonthTransitionPhase] =
    useState<MonthTransitionPhase>("idle");

  const loadMonth = useCallback(async () => {
    if (!userId) {
      return;
    }

    setIsLoading(true);

    try {
      const month = await ensureBudgetMonth(
        userId,
        currentMonth.year(),
        currentMonth.month() + 1
      );
      await materializeRecurringEntries(
        month.id,
        currentMonth.year(),
        currentMonth.month() + 1
      );
      const [themeRows, entryRows, incomeRows, goalRows, comparisonRows] = await Promise.all([
        listBudgetThemes(),
        listMonthEntries(month.id),
        listMonthIncomeEntries(month.id),
        listMonthGoals(month.id),
        listMonthlyComparisons(currentMonth.year(), currentMonth.month() + 1),
      ]);

      setBudgetMonth(month);
      setComparisons(comparisonRows);
      setThemes(themeRows);
      setEntries(entryRows);
      setIncomeEntries(incomeRows);
      setGoals(goalRows);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao carregar dados."
      );
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const monthKey = `${userId}:${currentMonth.year()}-${currentMonth.month() + 1}`;
    const lastLoaded = lastLoadedRef.current;

    if (lastLoaded?.key === monthKey && lastLoaded.tokenTick === tokenRefreshTick) {
      return;
    }

    lastLoadedRef.current = { key: monthKey, tokenTick: tokenRefreshTick };
    loadMonth();
  }, [currentMonth, loadMonth, tokenRefreshTick, userId]);

  useEffect(() => {
    return () => {
      monthTransitionTimeoutsRef.current.forEach((timeoutId) =>
        window.clearTimeout(timeoutId)
      );
    };
  }, []);

  const activeEntries = useMemo(
    () => entries.filter((entry) => !entry.deleted_at),
    [entries]
  );

  const activeIncomeEntries = useMemo(
    () => incomeEntries.filter((entry) => !entry.deleted_at),
    [incomeEntries]
  );

  const deletedIncomeEntries = useMemo(
    () => incomeEntries.filter((entry) => entry.deleted_at),
    [incomeEntries]
  );

  const incomeTotalCents = useMemo(
    () => activeIncomeEntries.reduce((sum, entry) => sum + entry.amount_cents, 0),
    [activeIncomeEntries]
  );

  const themeSummaries = useMemo<ThemeSummary[]>(() => {
    return themes.map((theme) => {
      const total = activeEntries
        .filter((entry) => entry.theme_id === theme.id)
        .reduce((sum, entry) => sum + entry.amount_cents, 0);
      const recommended = Math.round(
        (incomeTotalCents * theme.default_percentage_bp) / 10000
      );
      const spentPercentage =
        incomeTotalCents > 0 ? Math.round((total / incomeTotalCents) * 10000) : 0;

      return {
        ...theme,
        recommended_cents: recommended,
        spent_percentage_bp: spentPercentage,
        total_cents: total,
      };
    });
  }, [activeEntries, incomeTotalCents, themes]);

  const totals = useMemo(() => {
    const spent = activeEntries.reduce((sum, entry) => sum + entry.amount_cents, 0);
    const planned = activeEntries
      .filter((entry) => entry.recurring_entry_id)
      .reduce((sum, entry) => sum + entry.amount_cents, 0);
    const unexpected = activeEntries
      .filter((entry) => !entry.recurring_entry_id)
      .reduce((sum, entry) => sum + entry.amount_cents, 0);

    return {
      balance: incomeTotalCents - spent,
      income: incomeTotalCents,
      planned,
      spent,
      unexpected,
    };
  }, [activeEntries, incomeTotalCents]);

  const openedThemeEntries = useMemo(() => {
    if (!selectedTheme) {
      return [];
    }

    return entries.filter((entry) => entry.theme_id === selectedTheme.id);
  }, [entries, selectedTheme]);

  const openedActiveEntries = openedThemeEntries.filter((entry) => !entry.deleted_at);
  const openedDeletedEntries = openedThemeEntries.filter((entry) => entry.deleted_at);
  const isCurrentMonth = currentMonth.isSame(dayjs().startOf("month"), "month");
  const isMonthTransitioning = monthTransitionPhase !== "idle";
  const monthContentAnimation = useMemo(
    () => ({
      "@keyframes month-content-enter": {
        "0%": {
          opacity: 0,
          transform:
            monthTransitionDirection === "next"
              ? "translateX(72px)"
              : "translateX(-72px)",
        },
        "100%": {
          opacity: 1,
          transform: "translateX(0)",
        },
      },
      "@keyframes month-content-exit": {
        "0%": {
          opacity: 1,
          transform: "translateX(0)",
        },
        "100%": {
          opacity: 0,
          transform:
            monthTransitionDirection === "next"
              ? "translateX(-72px)"
              : "translateX(72px)",
        },
      },
      animation:
        monthTransitionPhase === "exit"
          ? "month-content-exit 320ms cubic-bezier(0.4, 0, 0.2, 1) forwards"
          : monthTransitionPhase === "enter"
          ? "month-content-enter 460ms cubic-bezier(0.16, 1, 0.3, 1)"
          : "none",
      willChange: monthTransitionPhase === "idle" ? "auto" : "opacity, transform",
    }),
    [monthTransitionDirection, monthTransitionPhase]
  );

  const changeMonth = (nextMonth: Dayjs) => {
    if (isLoading || isMonthTransitioning) {
      return;
    }

    const currentOrder = currentMonth.year() * 12 + currentMonth.month();
    const nextOrder = nextMonth.year() * 12 + nextMonth.month();

    if (nextOrder === currentOrder) {
      return;
    }

    setMonthTransitionDirection(nextOrder > currentOrder ? "next" : "previous");
    setMonthTransitionPhase("exit");

    monthTransitionTimeoutsRef.current.forEach((timeoutId) =>
      window.clearTimeout(timeoutId)
    );

    const switchMonthTimeout = window.setTimeout(() => {
      setCurrentMonth(nextMonth.startOf("month"));
      setMonthTransitionPhase("enter");
    }, 320);

    const finishTransitionTimeout = window.setTimeout(() => {
      setMonthTransitionPhase("idle");
      monthTransitionTimeoutsRef.current = [];
    }, 860);

    monthTransitionTimeoutsRef.current = [
      switchMonthTimeout,
      finishTransitionTimeout,
    ];
  };

  const handleOpenTheme = (summary: ThemeSummary) => {
    setSelectedTheme(summary);
    setDrawerTab("active");
    setEditingEntry(null);
    setFormValues(emptyEntryForm(summary.id));
  };

  const handleEditIncomeEntry = (entry: MonthlyIncomeEntry) => {
    setIncomeAuditLogs([]);
    setEditingIncomeEntry(entry);
    setIncomeFormValues({
      amount: centsToInputValue(entry.amount_cents),
      changeReason: "",
      description: entry.description,
      entryDate: entry.received_date,
      isRecurring: false,
      notes: entry.notes ?? "",
      recurrenceEndDate: "",
    });
    setIncomeEditDialogOpen(true);
  };

  useEffect(() => {
    if (!incomeEditDialogOpen || !editingIncomeEntry) {
      return;
    }

    setIncomeAuditLoading(true);

    Promise.all([
      listAuditLogsForRecord("monthly_income_entries", editingIncomeEntry.id),
      editingIncomeEntry.recurring_entry_id
        ? listAuditLogsForRecord("recurring_entries", editingIncomeEntry.recurring_entry_id)
        : Promise.resolve([]),
    ])
      .then(([entryLogs, recurringLogs]) =>
        setIncomeAuditLogs(sortAuditLogs([...entryLogs, ...recurringLogs]))
      )
      .catch((error) => {
        toast.error(
          error instanceof Error ? error.message : "Erro ao carregar dados."
        );
      })
      .finally(() => setIncomeAuditLoading(false));
  }, [editingIncomeEntry, incomeEditDialogOpen, tokenRefreshTick]);

  const handleSubmitIncomeEntry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!budgetMonth) {
      return;
    }

    setIsSaving(true);

    try {
      const amountCents = currencyInputToCents(incomeFormValues.amount);

      if (editingIncomeEntry) {
        await updateIncomeEntry({
          amountCents,
          changeReason: incomeFormValues.changeReason,
          description: incomeFormValues.description,
          entryId: editingIncomeEntry.id,
          notes: incomeFormValues.notes,
          receivedDate: incomeFormValues.entryDate,
        });
        toast.success(t(tokens.dashboard.incomeUpdated));
      } else {
        await createIncomeEntry({
          amountCents,
          budgetMonthId: budgetMonth.id,
          description: incomeFormValues.description,
          isRecurring: incomeFormValues.isRecurring,
          notes: incomeFormValues.notes,
          receivedDate: incomeFormValues.entryDate,
          recurrenceEndDate: incomeFormValues.recurrenceEndDate,
        });
        toast.success(t(tokens.dashboard.incomeAdded));
      }

      setEditingIncomeEntry(null);
      setIncomeFormValues(emptyIncomeForm());
      setIncomeEntries(await listMonthIncomeEntries(budgetMonth.id));
      setIncomeEditDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(tokens.dashboard.saveIncomeError));
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditEntry = (entry: MonthlyThemeEntry) => {
    setExpenseAuditLogs([]);
    setEditingEntry(entry);
    setFormValues({
      amount: centsToInputValue(entry.amount_cents),
      changeReason: "",
      description: entry.description,
      entryDate: entry.entry_date,
      isRecurring: Boolean(entry.recurring_entry_id),
      notes: entry.notes ?? "",
      recurrenceEndDate: "",
      themeId: entry.theme_id,
    });

    setExpenseEditDialogOpen(true);

    if (!entry.recurring_entry_id) {
      return;
    }

    getRecurringEntry(entry.recurring_entry_id)
      .then((recurrence) => {
        if (!recurrence.end_year || !recurrence.end_month) {
          return;
        }

        const base = dayjs(
          `${recurrence.end_year}-${String(recurrence.end_month).padStart(2, "0")}-01`
        );
        const safeDay = Math.min(recurrence.entry_day, base.daysInMonth());

        setFormValues((current) => ({
          ...current,
          recurrenceEndDate: base.date(safeDay).format("YYYY-MM-DD"),
        }));
      })
      .catch(() => {
        // Se falhar, mantem o form sem data final.
      });
  };

  useEffect(() => {
    if (!expenseEditDialogOpen || !editingEntry) {
      return;
    }

    setExpenseAuditLoading(true);

    Promise.all([
      listAuditLogsForRecord("monthly_theme_entries", editingEntry.id),
      editingEntry.recurring_entry_id
        ? listAuditLogsForRecord("recurring_entries", editingEntry.recurring_entry_id)
        : Promise.resolve([]),
    ])
      .then(([entryLogs, recurringLogs]) =>
        setExpenseAuditLogs(sortAuditLogs([...entryLogs, ...recurringLogs]))
      )
      .catch((error) => {
        toast.error(
          error instanceof Error ? error.message : "Erro ao carregar dados."
        );
      })
      .finally(() => setExpenseAuditLoading(false));
  }, [editingEntry, expenseEditDialogOpen, tokenRefreshTick]);

  const handleSubmitEntry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!budgetMonth || !selectedTheme || !user) {
      return;
    }

    setIsSaving(true);

    try {
      const amountCents = currencyInputToCents(formValues.amount);

      if (editingEntry) {
        await updateEntry({
          amountCents,
          changeReason: formValues.changeReason,
          description: formValues.description,
          entryDate: formValues.entryDate,
          entryId: editingEntry.id,
          existingRecurringEntryId: editingEntry.recurring_entry_id,
          isRecurring: formValues.isRecurring,
          notes: formValues.notes,
          recurrenceEndDate: formValues.recurrenceEndDate,
          themeId: editingEntry.theme_id,
        });
        toast.success(t(tokens.dashboard.expenseUpdated));
      } else {
        await createEntry({
          amountCents,
          budgetMonthId: budgetMonth.id,
          description: formValues.description,
          entryDate: formValues.entryDate,
          isRecurring: formValues.isRecurring,
          notes: formValues.notes,
          recurrenceEndDate: formValues.recurrenceEndDate,
          themeId: selectedTheme.id,
          userId: user.id,
        });
        toast.success(t(tokens.dashboard.expenseAdded));
      }

      setEditingEntry(null);
      setFormValues(emptyEntryForm(selectedTheme.id));
      setEntries(await listMonthEntries(budgetMonth.id));
      setExpenseEditDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(tokens.dashboard.saveExpenseError));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseIncomeEditDialog = () => {
    setIncomeEditDialogOpen(false);
    setEditingIncomeEntry(null);
    setIncomeFormValues(emptyIncomeForm());
  };

  const handleCloseExpenseEditDialog = () => {
    setExpenseEditDialogOpen(false);
    setEditingEntry(null);
    setFormValues(emptyEntryForm(selectedTheme?.id));
  };

  const handleSoftDelete = async () => {
    if (!deleteTarget || !budgetMonth) {
      return;
    }

    setIsSaving(true);

    try {
      await softDeleteEntry(deleteTarget.id, deleteReason);
      setEntries(await listMonthEntries(budgetMonth.id));
      setDeleteTarget(null);
      setDeleteReason("");
      toast.success(t(tokens.dashboard.expenseCanceled));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(tokens.dashboard.cancelExpenseError));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSoftDeleteIncome = async () => {
    if (!incomeDeleteTarget || !budgetMonth) {
      return;
    }

    setIsSaving(true);

    try {
      await softDeleteIncomeEntry(incomeDeleteTarget.id, deleteReason);
      setIncomeEntries(await listMonthIncomeEntries(budgetMonth.id));
      setIncomeDeleteTarget(null);
      setDeleteReason("");
      toast.success(t(tokens.dashboard.incomeCanceled));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(tokens.dashboard.cancelIncomeError));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestore = async (entry: MonthlyThemeEntry) => {
    if (!budgetMonth) {
      return;
    }

    setIsSaving(true);

    try {
      await restoreEntry(entry.id);
      setEntries(await listMonthEntries(budgetMonth.id));
      toast.success(t(tokens.dashboard.expenseRestored));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(tokens.dashboard.restoreExpenseError));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestoreIncome = async (entry: MonthlyIncomeEntry) => {
    if (!budgetMonth) {
      return;
    }

    setIsSaving(true);

    try {
      await restoreIncomeEntry(entry.id);
      setIncomeEntries(await listMonthIncomeEntries(budgetMonth.id));
      toast.success(t(tokens.dashboard.incomeRestored));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(tokens.dashboard.restoreIncomeError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Head>
        <title>
          {t(tokens.common.dashboard)} | {t(tokens.common.appName)}
        </title>
      </Head>

      <Stack spacing={3}>
        <HeroSection
          currentMonth={currentMonth}
          isCurrentMonth={isCurrentMonth}
          isLoading={isLoading}
          isMonthTransitioning={isMonthTransitioning}
          onChangeMonth={changeMonth}
        />

        <SummarySection
          activeIncomeCount={activeIncomeEntries.length}
          animationSx={monthContentAnimation}
          currentMonth={currentMonth}
          isLoading={isLoading}
          onOpenIncome={() => setIncomeDrawerOpen(true)}
          onScrollToExpenses={() =>
            expensesSectionRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            })
          }
          totals={totals}
        />

        <MonthlyDataSection
          animationSx={monthContentAnimation}
          comparisons={comparisons}
          currentMonth={currentMonth}
          goals={goals}
          isLoading={isLoading}
          totals={totals}
        />

        <ExpensesSection
          animationSx={monthContentAnimation}
          currentMonth={currentMonth}
          isLoading={isLoading}
          onAddExpense={() => setExpenseThemeDialogOpen(true)}
          onOpenTheme={handleOpenTheme}
          ref={expensesSectionRef}
          themeSummaries={themeSummaries}
        />
      </Stack>

      <EntryDrawer
        activeEntries={openedActiveEntries}
        deletedEntries={openedDeletedEntries}
        drawerTab={drawerTab}
        editingEntry={editingEntry}
        formValues={formValues}
        isSaving={isSaving}
        onClose={() => setSelectedTheme(null)}
        onDelete={(entry) => setDeleteTarget(entry)}
        onEdit={handleEditEntry}
        onFormChange={setFormValues}
        onRestore={handleRestore}
        onSubmit={handleSubmitEntry}
        onTabChange={setDrawerTab}
        onCancelEdit={() => {
          handleCloseExpenseEditDialog();
        }}
        open={Boolean(selectedTheme)}
        theme={selectedTheme}
      />

      <IncomeDrawer
        activeEntries={activeIncomeEntries}
        deletedEntries={deletedIncomeEntries}
        drawerTab={incomeDrawerTab}
        editingEntry={editingIncomeEntry}
        formValues={incomeFormValues}
        isSaving={isSaving}
        onCancelEdit={() => {
          handleCloseIncomeEditDialog();
        }}
        onClose={() => setIncomeDrawerOpen(false)}
        onDelete={(entry) => setIncomeDeleteTarget(entry)}
        onEdit={handleEditIncomeEntry}
        onFormChange={setIncomeFormValues}
        onRestore={handleRestoreIncome}
        onSubmit={handleSubmitIncomeEntry}
        onTabChange={setIncomeDrawerTab}
        open={incomeDrawerOpen}
        totalCents={incomeTotalCents}
      />

      <Dialog
        fullWidth
        fullScreen={isMobile}
        maxWidth="md"
        onClose={handleCloseExpenseEditDialog}
        open={expenseEditDialogOpen && Boolean(editingEntry)}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack alignItems="center" direction="row" spacing={1}>
            <IconButton
              aria-label={t(tokens.common.back)}
              edge="start"
              onClick={handleCloseExpenseEditDialog}
              sx={{ display: { xs: "inline-flex", sm: "none" } }}
            >
              <ArrowBackIosNewOutlined fontSize="small" />
            </IconButton>
            <Typography sx={{ flexGrow: 1 }} variant="h3">
              {t(tokens.dashboard.editExpense)}
            </Typography>
            <IconButton
              aria-label={t(tokens.common.cancel)}
              onClick={handleCloseExpenseEditDialog}
              sx={{ display: { xs: "none", sm: "inline-flex" } }}
            >
              <CloseOutlined />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1 }}>
            <Box component="form" onSubmit={handleSubmitEntry}>
              <Stack spacing={2}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <AppTextField
                    autoFocus
                    fullWidth
                    label={t(tokens.common.description)}
                    onChange={(event) =>
                      setFormValues({ ...formValues, description: event.target.value })
                    }
                    required
                    value={formValues.description}
                  />
                  <MoneyTextField
                    label={t(tokens.common.value)}
                    onChange={(event) => setFormValues({ ...formValues, amount: event })}
                    required
                    value={formValues.amount}
                  />
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <AppTextField
                    fullWidth
                    label={t(tokens.common.date)}
                    onChange={(event) =>
                      setFormValues({ ...formValues, entryDate: event.target.value })
                    }
                    required
                    type="date"
                    value={formValues.entryDate}
                  />
                  <AppTextField
                    fullWidth
                    label={t(tokens.common.notes)}
                    onChange={(event) =>
                      setFormValues({ ...formValues, notes: event.target.value })
                    }
                    value={formValues.notes}
                  />
                </Stack>
                <AppTextField
                  fullWidth
                  label={t(tokens.dashboard.changeReason)}
                  onChange={(event) =>
                    setFormValues({ ...formValues, changeReason: event.target.value })
                  }
                  placeholder={t(tokens.common.optional)}
                  value={formValues.changeReason}
                />

                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formValues.isRecurring}
                        onChange={(event) =>
                          setFormValues({
                            ...formValues,
                            isRecurring: event.target.checked,
                            recurrenceEndDate: event.target.checked
                              ? formValues.recurrenceEndDate
                              : "",
                          })
                        }
                      />
                    }
                    label={t(tokens.dashboard.recurring)}
                  />
                  {formValues.isRecurring && (
                    <AppTextField
                      fullWidth
                      helperText={t(tokens.dashboard.repeatUntilHelp)}
                      label={t(tokens.dashboard.repeatUntil)}
                      onChange={(event) =>
                        setFormValues({
                          ...formValues,
                          recurrenceEndDate: event.target.value,
                        })
                      }
                      type="date"
                      value={formValues.recurrenceEndDate}
                    />
                  )}
                </Stack>

                <Stack direction="row" justifyContent="flex-end" spacing={1}>
                  <Button onClick={handleCloseExpenseEditDialog}>
                    {t(tokens.common.back)}
                  </Button>
                  <Button
                    disabled={isSaving}
                    startIcon={<SaveOutlined />}
                    type="submit"
                    variant="contained"
                  >
                    {t(tokens.common.save)}
                  </Button>
                </Stack>
              </Stack>
            </Box>

            <Divider />

            <Box>
              <Typography sx={{ mb: 1 }} variant="h3">
                {t(tokens.dashboard.historyTitle)}
              </Typography>
              <AuditTimeline isLoading={expenseAuditLoading} logs={expenseAuditLogs} />
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog
        fullWidth
        fullScreen={isMobile}
        maxWidth="md"
        onClose={handleCloseIncomeEditDialog}
        open={incomeEditDialogOpen && Boolean(editingIncomeEntry)}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack alignItems="center" direction="row" spacing={1}>
            <IconButton
              aria-label={t(tokens.common.back)}
              edge="start"
              onClick={handleCloseIncomeEditDialog}
              sx={{ display: { xs: "inline-flex", sm: "none" } }}
            >
              <ArrowBackIosNewOutlined fontSize="small" />
            </IconButton>
            <Typography sx={{ flexGrow: 1 }} variant="h3">
              {t(tokens.dashboard.editIncome)}
            </Typography>
            <IconButton
              aria-label={t(tokens.common.cancel)}
              onClick={handleCloseIncomeEditDialog}
              sx={{ display: { xs: "none", sm: "inline-flex" } }}
            >
              <CloseOutlined />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1 }}>
            <Box component="form" onSubmit={handleSubmitIncomeEntry}>
              <Stack spacing={2}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <AppTextField
                    autoFocus
                    fullWidth
                    label={t(tokens.common.description)}
                    onChange={(event) =>
                      setIncomeFormValues({
                        ...incomeFormValues,
                        description: event.target.value,
                      })
                    }
                    placeholder={t(tokens.dashboard.incomePlaceholder)}
                    required
                    value={incomeFormValues.description}
                  />
                  <MoneyTextField
                    label={t(tokens.common.value)}
                    onChange={(event) =>
                      setIncomeFormValues({ ...incomeFormValues, amount: event })
                    }
                    required
                    value={incomeFormValues.amount}
                  />
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <AppTextField
                    fullWidth
                    label={t(tokens.common.date)}
                    onChange={(event) =>
                      setIncomeFormValues({
                        ...incomeFormValues,
                        entryDate: event.target.value,
                      })
                    }
                    required
                    type="date"
                    value={incomeFormValues.entryDate}
                  />
                  <AppTextField
                    fullWidth
                    label={t(tokens.common.notes)}
                    onChange={(event) =>
                      setIncomeFormValues({ ...incomeFormValues, notes: event.target.value })
                    }
                    value={incomeFormValues.notes}
                  />
                </Stack>

                <AppTextField
                  fullWidth
                  label={t(tokens.dashboard.changeReason)}
                  onChange={(event) =>
                    setIncomeFormValues({
                      ...incomeFormValues,
                      changeReason: event.target.value,
                    })
                  }
                  placeholder={t(tokens.common.optional)}
                  value={incomeFormValues.changeReason}
                />

                <Stack direction="row" justifyContent="flex-end" spacing={1}>
                  <Button onClick={handleCloseIncomeEditDialog}>{t(tokens.common.back)}</Button>
                  <Button
                    disabled={isSaving}
                    startIcon={<SaveOutlined />}
                    type="submit"
                    variant="contained"
                  >
                    {t(tokens.common.save)}
                  </Button>
                </Stack>
              </Stack>
            </Box>

            <Divider />

            <Box>
              <Typography sx={{ mb: 1 }} variant="h3">
                {t(tokens.dashboard.historyTitle)}
              </Typography>
              <AuditTimeline isLoading={incomeAuditLoading} logs={incomeAuditLogs} />
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} fullWidth>
        <DialogTitle>{t(tokens.dashboard.cancelExpense)}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography color="text.secondary">
              {t(tokens.dashboard.deletedExpenseHelp)}
            </Typography>
            <AppTextField
              autoFocus
              fullWidth
              label={t(tokens.dashboard.changeReason)}
              onChange={(event) => setDeleteReason(event.target.value)}
              value={deleteReason}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>{t(tokens.common.back)}</Button>
          <Button
            color="error"
            disabled={isSaving}
            onClick={handleSoftDelete}
            startIcon={<DeleteOutlineOutlined />}
            variant="contained"
          >
            {t(tokens.common.cancel)}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(incomeDeleteTarget)}
        onClose={() => setIncomeDeleteTarget(null)}
        fullWidth
      >
        <DialogTitle>{t(tokens.dashboard.cancelIncome)}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography color="text.secondary">
              {t(tokens.dashboard.deletedIncomeHelp)}
            </Typography>
            <AppTextField
              autoFocus
              fullWidth
              label={t(tokens.dashboard.changeReason)}
              onChange={(event) => setDeleteReason(event.target.value)}
              value={deleteReason}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIncomeDeleteTarget(null)}>
            {t(tokens.common.back)}
          </Button>
          <Button
            color="error"
            disabled={isSaving}
            onClick={handleSoftDeleteIncome}
            startIcon={<DeleteOutlineOutlined />}
            variant="contained"
          >
            {t(tokens.common.cancel)}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        fullWidth
        maxWidth="sm"
        onClose={() => setExpenseThemeDialogOpen(false)}
        open={expenseThemeDialogOpen}
      >
        <DialogTitle>{t(tokens.dashboard.selectExpenseTheme)}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography color="text.secondary">
              {t(tokens.dashboard.selectExpenseThemeSubtitle)}
            </Typography>
            {themeSummaries.length === 0 ? (
              <Alert severity="warning">{t(tokens.dashboard.noThemes)}</Alert>
            ) : (
              <Stack spacing={1}>
                {themeSummaries.map((summary) => (
                  <Button
                    key={summary.id}
                    onClick={() => {
                      setExpenseThemeDialogOpen(false);
                      handleOpenTheme(summary);
                    }}
                    sx={{
                      justifyContent: "space-between",
                      py: 1.25,
                      textAlign: "left",
                    }}
                    variant="outlined"
                  >
                    <Box component="span" sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {summary.name}
                    </Box>
                    <Box component="span">{centsToCurrency(summary.total_cents)}</Box>
                  </Button>
                ))}
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExpenseThemeDialogOpen(false)}>
            {t(tokens.common.cancel)}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

type IncomeDrawerProps = {
  activeEntries: MonthlyIncomeEntry[];
  deletedEntries: MonthlyIncomeEntry[];
  drawerTab: "active" | "deleted";
  editingEntry: MonthlyIncomeEntry | null;
  formValues: EntryFormValues;
  isSaving: boolean;
  onCancelEdit: () => void;
  onClose: () => void;
  onDelete: (entry: MonthlyIncomeEntry) => void;
  onEdit: (entry: MonthlyIncomeEntry) => void;
  onFormChange: (values: EntryFormValues) => void;
  onRestore: (entry: MonthlyIncomeEntry) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTabChange: (value: "active" | "deleted") => void;
  open: boolean;
  totalCents: number;
};

function IncomeDrawer({
  activeEntries,
  deletedEntries,
  drawerTab,
  editingEntry,
  formValues,
  isSaving,
  onCancelEdit,
  onClose,
  onDelete,
  onEdit,
  onFormChange,
  onRestore,
  onSubmit,
  onTabChange,
  open,
  totalCents,
}: IncomeDrawerProps) {
  const { t } = useTranslation();
  const visibleEntries = drawerTab === "active" ? activeEntries : deletedEntries;

  return (
    <Drawer
      anchor="right"
      onClose={onClose}
      open={open}
      PaperProps={{
        sx: {
          maxWidth: "100%",
          width: { xs: "100vw", sm: 680 },
        },
      }}
    >
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={3}>
          <Stack alignItems="center" direction="row" spacing={1}>
            <IconButton aria-label={t(tokens.common.back)} edge="start" onClick={onClose}>
              <ArrowBackIosNewOutlined fontSize="small" />
            </IconButton>
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap variant="h2">
                {t(tokens.dashboard.income)}
              </Typography>
              <Typography color="text.secondary">
                {t(tokens.dashboard.totalActive)}: {centsToCurrency(totalCents)}
              </Typography>
            </Box>
          </Stack>

          <Card variant="outlined">
            <CardContent>
              <Box component="form" onSubmit={onSubmit}>
                <Stack spacing={2}>
                  <Typography variant="h3">
                    {editingEntry
                      ? t(tokens.dashboard.editIncome)
                      : t(tokens.dashboard.newIncome)}
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <AppTextField
                      fullWidth
                      label={t(tokens.common.description)}
                      onChange={(event) =>
                        onFormChange({ ...formValues, description: event.target.value })
                      }
                      placeholder={t(tokens.dashboard.incomePlaceholder)}
                      required
                      value={formValues.description}
                    />
                    <MoneyTextField
                      label={t(tokens.common.value)}
                      onChange={(event) =>
                        onFormChange({ ...formValues, amount: event })
                      }
                      required
                      value={formValues.amount}
                    />
                  </Stack>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <AppTextField
                      fullWidth
                      label={t(tokens.common.date)}
                      onChange={(event) =>
                        onFormChange({ ...formValues, entryDate: event.target.value })
                      }
                      required
                      type="date"
                      value={formValues.entryDate}
                    />
                    <AppTextField
                      fullWidth
                      label={t(tokens.common.notes)}
                      onChange={(event) =>
                        onFormChange({ ...formValues, notes: event.target.value })
                      }
                      value={formValues.notes}
                    />
                  </Stack>
                  {editingEntry ? (
                    <AppTextField
                      fullWidth
                      label={t(tokens.dashboard.changeReason)}
                      onChange={(event) =>
                        onFormChange({
                          ...formValues,
                          changeReason: event.target.value,
                        })
                      }
                      placeholder={t(tokens.common.optional)}
                      value={formValues.changeReason}
                    />
                  ) : (
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={formValues.isRecurring}
                            onChange={(event) =>
                              onFormChange({
                                ...formValues,
                                isRecurring: event.target.checked,
                              })
                            }
                          />
                        }
                        label={t(tokens.dashboard.recurring)}
                      />
                      {formValues.isRecurring && (
                        <AppTextField
                          fullWidth
                          helperText={t(tokens.dashboard.repeatUntilHelp)}
                          label={t(tokens.dashboard.repeatUntil)}
                          onChange={(event) =>
                            onFormChange({
                              ...formValues,
                              recurrenceEndDate: event.target.value,
                            })
                          }
                          type="date"
                          value={formValues.recurrenceEndDate}
                        />
                      )}
                    </Stack>
                  )}
                  <Stack direction="row" justifyContent="flex-end" spacing={1}>
                    {editingEntry && (
                      <Button onClick={onCancelEdit}>{t(tokens.common.clear)}</Button>
                    )}
                    <Button
                      disabled={isSaving}
                      startIcon={editingEntry ? <SaveOutlined /> : <AddOutlined />}
                      type="submit"
                      variant="contained"
                    >
                      {editingEntry ? t(tokens.common.save) : t(tokens.common.add)}
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            </CardContent>
          </Card>

          <Box>
            <Tabs
              onChange={(_event, value: "active" | "deleted") => onTabChange(value)}
              value={drawerTab}
            >
              <Tab
                label={t(tokens.dashboard.incomeActiveTab, {
                  count: activeEntries.length,
                })}
                value="active"
              />
              <Tab
                icon={<HistoryOutlined />}
                iconPosition="start"
                label={t(tokens.dashboard.incomeCanceledTab, {
                  count: deletedEntries.length,
                })}
                value="deleted"
              />
            </Tabs>
            <Divider />
          </Box>

          <Stack spacing={1.25} sx={{ display: { xs: "flex", sm: "none" } }}>
            {visibleEntries.map((entry) => (
              <Card
                key={entry.id}
                variant="outlined"
                sx={{
                  bgcolor: entry.deleted_at ? "transparent" : financeColors.incomeSoft,
                  borderLeft: "4px solid",
                  borderLeftColor: entry.deleted_at ? "divider" : financeColors.income,
                }}
              >
                <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Stack spacing={1}>
                    <Stack alignItems="flex-start" direction="row" spacing={1}>
                      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Typography fontWeight={700} variant="body2">
                          {entry.description}
                        </Typography>
                        <Typography color="text.secondary" variant="caption">
                          {dayjs(entry.received_date).format("DD/MM/YYYY")}
                        </Typography>
                      </Box>
                      <Typography color={financeColors.income} fontWeight={800}>
                        {centsToCurrency(entry.amount_cents)}
                      </Typography>
                    </Stack>

                    {(entry.notes || entry.deleted_reason) && (
                      <Typography color="text.secondary" variant="caption">
                        {entry.notes || entry.deleted_reason}
                      </Typography>
                    )}

                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Chip
                        label={t(tokens.dashboard.income)}
                        size="small"
                        sx={{
                          bgcolor: financeColors.incomeSoft,
                          color: financeColors.income,
                          fontWeight: 700,
                        }}
                      />
                      {drawerTab === "active" ? (
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title={t(tokens.common.edit)}>
                            <IconButton onClick={() => onEdit(entry)} size="small">
                              <EditOutlined fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={t(tokens.common.cancel)}>
                            <IconButton
                              color="error"
                              onClick={() => onDelete(entry)}
                              size="small"
                            >
                              <DeleteOutlineOutlined fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      ) : (
                        <Tooltip title={t(tokens.common.restore)}>
                          <IconButton onClick={() => onRestore(entry)} size="small">
                            <ReplayOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
            {visibleEntries.length === 0 && (
              <Typography color="text.secondary" sx={{ py: 3 }} textAlign="center">
                {t(tokens.dashboard.incomeNotFound)}
              </Typography>
            )}
          </Stack>

          <Table size="small" sx={{ display: { xs: "none", sm: "table" } }}>
            <TableHead>
              <TableRow>
                <TableCell>{t(tokens.common.description)}</TableCell>
                <TableCell>{t(tokens.common.date)}</TableCell>
                <TableCell align="right">{t(tokens.common.value)}</TableCell>
                <TableCell align="right">{t(tokens.common.actions)}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleEntries.map((entry) => (
                <TableRow
                  key={entry.id}
                  sx={{
                    bgcolor: entry.deleted_at ? "transparent" : financeColors.incomeSoft,
                    borderLeft: "4px solid",
                    borderLeftColor: entry.deleted_at ? "divider" : financeColors.income,
                  }}
                >
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2">{entry.description}</Typography>
                      <Chip
                        label={t(tokens.dashboard.income)}
                        size="small"
                        sx={{
                          bgcolor: financeColors.incomeSoft,
                          color: financeColors.income,
                          fontWeight: 700,
                        }}
                      />
                    </Stack>
                    {(entry.notes || entry.deleted_reason) && (
                      <Typography color="text.secondary" variant="caption">
                        {entry.notes || entry.deleted_reason}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{dayjs(entry.received_date).format("DD/MM/YYYY")}</TableCell>
                  <TableCell align="right">
                    {centsToCurrency(entry.amount_cents)}
                  </TableCell>
                  <TableCell align="right">
                    {drawerTab === "active" ? (
                      <Stack direction="row" justifyContent="flex-end" spacing={0.5}>
                        <Tooltip title={t(tokens.common.edit)}>
                          <IconButton onClick={() => onEdit(entry)} size="small">
                            <EditOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t(tokens.common.cancel)}>
                          <IconButton
                            color="error"
                            onClick={() => onDelete(entry)}
                            size="small"
                          >
                            <DeleteOutlineOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    ) : (
                      <Tooltip title={t(tokens.common.restore)}>
                        <IconButton onClick={() => onRestore(entry)} size="small">
                          <ReplayOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {visibleEntries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography color="text.secondary" sx={{ py: 3 }} textAlign="center">
                      {t(tokens.dashboard.incomeNotFound)}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Stack>
      </Box>
    </Drawer>
  );
}

type EntryDrawerProps = {
  activeEntries: MonthlyThemeEntry[];
  deletedEntries: MonthlyThemeEntry[];
  drawerTab: "active" | "deleted";
  editingEntry: MonthlyThemeEntry | null;
  formValues: EntryFormValues & { themeId: string };
  isSaving: boolean;
  onCancelEdit: () => void;
  onClose: () => void;
  onDelete: (entry: MonthlyThemeEntry) => void;
  onEdit: (entry: MonthlyThemeEntry) => void;
  onFormChange: (values: EntryFormValues & { themeId: string }) => void;
  onRestore: (entry: MonthlyThemeEntry) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTabChange: (value: "active" | "deleted") => void;
  open: boolean;
  theme: ThemeSummary | null;
};

function EntryDrawer({
  activeEntries,
  deletedEntries,
  drawerTab,
  editingEntry,
  formValues,
  isSaving,
  onCancelEdit,
  onClose,
  onDelete,
  onEdit,
  onFormChange,
  onRestore,
  onSubmit,
  onTabChange,
  open,
  theme,
}: EntryDrawerProps) {
  const { t } = useTranslation();
  const visibleEntries = drawerTab === "active" ? activeEntries : deletedEntries;

  const handleEditClick = (entry: MonthlyThemeEntry) => {
    onEdit(entry);
  };

  return (
    <Drawer
      anchor="right"
      onClose={onClose}
      open={open}
      PaperProps={{
        sx: {
          maxWidth: "100%",
          width: { xs: "100vw", sm: 680 },
        },
      }}
    >
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={3}>
          <Stack alignItems="center" direction="row" spacing={1}>
            <IconButton aria-label={t(tokens.common.back)} edge="start" onClick={onClose}>
              <ArrowBackIosNewOutlined fontSize="small" />
            </IconButton>
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap variant="h2">
                {theme?.name}
              </Typography>
              <Typography color="text.secondary">
                {t(tokens.dashboard.totalActive)}: {centsToCurrency(theme?.total_cents ?? 0)}
              </Typography>
            </Box>
          </Stack>

          <Card variant="outlined">
            <CardContent>
              <Box component="form" id="expense-entry-form" onSubmit={onSubmit}>
                <Stack spacing={2}>
                  <Typography variant="h3">
                    {editingEntry
                      ? t(tokens.dashboard.editExpense)
                      : t(tokens.dashboard.newExpense)}
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <AppTextField
                      id="expense-description"
                      fullWidth
                      label={t(tokens.common.description)}
                      onChange={(event) =>
                        onFormChange({ ...formValues, description: event.target.value })
                      }
                      required
                      value={formValues.description}
                    />
                    <MoneyTextField
                      label={t(tokens.common.value)}
                      onChange={(event) =>
                        onFormChange({ ...formValues, amount: event })
                      }
                      required
                      value={formValues.amount}
                    />
                  </Stack>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <AppTextField
                      fullWidth
                      label={t(tokens.common.date)}
                      onChange={(event) =>
                        onFormChange({ ...formValues, entryDate: event.target.value })
                      }
                      required
                      type="date"
                      value={formValues.entryDate}
                    />
                    <AppTextField
                      fullWidth
                      label={t(tokens.common.notes)}
                      onChange={(event) =>
                        onFormChange({ ...formValues, notes: event.target.value })
                      }
                      value={formValues.notes}
                    />
                  </Stack>
                  {editingEntry && (
                    <AppTextField
                      fullWidth
                      label={t(tokens.dashboard.changeReason)}
                      onChange={(event) =>
                        onFormChange({
                          ...formValues,
                          changeReason: event.target.value,
                        })
                      }
                      placeholder={t(tokens.common.optional)}
                      value={formValues.changeReason}
                    />
                  )}

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={formValues.isRecurring}
                          onChange={(event) =>
                            onFormChange({
                              ...formValues,
                              isRecurring: event.target.checked,
                              recurrenceEndDate: event.target.checked
                                ? formValues.recurrenceEndDate
                                : "",
                            })
                          }
                        />
                      }
                      label={t(tokens.dashboard.recurring)}
                    />
                    {formValues.isRecurring && (
                      <AppTextField
                        fullWidth
                        helperText={t(tokens.dashboard.repeatUntilHelp)}
                        label={t(tokens.dashboard.repeatUntil)}
                        onChange={(event) =>
                          onFormChange({
                            ...formValues,
                            recurrenceEndDate: event.target.value,
                          })
                        }
                        type="date"
                        value={formValues.recurrenceEndDate}
                      />
                    )}
                  </Stack>
                  <Stack direction="row" justifyContent="flex-end" spacing={1}>
                    {editingEntry && (
                      <Button onClick={onCancelEdit}>{t(tokens.common.clear)}</Button>
                    )}
                    <Button
                      disabled={isSaving}
                      startIcon={editingEntry ? <SaveOutlined /> : <AddOutlined />}
                      type="submit"
                      variant="contained"
                    >
                      {editingEntry ? t(tokens.common.save) : t(tokens.common.add)}
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            </CardContent>
          </Card>

          <Box>
            <Tabs
              onChange={(_event, value: "active" | "deleted") => onTabChange(value)}
              value={drawerTab}
            >
              <Tab
                label={t(tokens.dashboard.expenseActiveTab, {
                  count: activeEntries.length,
                })}
                value="active"
              />
              <Tab
                icon={<HistoryOutlined />}
                iconPosition="start"
                label={t(tokens.dashboard.expenseCanceledTab, {
                  count: deletedEntries.length,
                })}
                value="deleted"
              />
            </Tabs>
            <Divider />
          </Box>

          <Stack spacing={1.25} sx={{ display: { xs: "flex", sm: "none" } }}>
            {visibleEntries.map((entry) => {
              const isPlanned = Boolean(entry.recurring_entry_id);
              const rowColor = isPlanned
                ? financeColors.planned
                : financeColors.unexpected;
              const softColor = isPlanned
                ? financeColors.plannedSoft
                : financeColors.unexpectedSoft;

              return (
                <Card
                  key={entry.id}
                  variant="outlined"
                  sx={{
                    bgcolor: entry.deleted_at ? "transparent" : softColor,
                    borderLeft: "4px solid",
                    borderLeftColor: entry.deleted_at ? "divider" : rowColor,
                  }}
                >
                  <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                    <Stack spacing={1}>
                      <Stack alignItems="flex-start" direction="row" spacing={1}>
                        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                          <Typography fontWeight={700} variant="body2">
                            {entry.description}
                          </Typography>
                          <Typography color="text.secondary" variant="caption">
                            {dayjs(entry.entry_date).format("DD/MM/YYYY")}
                          </Typography>
                        </Box>
                        <Typography color={rowColor} fontWeight={800}>
                          {centsToCurrency(entry.amount_cents)}
                        </Typography>
                      </Stack>

                      {(entry.notes || entry.deleted_reason) && (
                        <Typography color="text.secondary" variant="caption">
                          {entry.notes || entry.deleted_reason}
                        </Typography>
                      )}

                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Chip
                          label={
                            isPlanned
                              ? t(tokens.dashboard.planned)
                              : t(tokens.dashboard.unexpected)
                          }
                          size="small"
                          sx={{
                            bgcolor: softColor,
                            color: rowColor,
                            fontWeight: 700,
                          }}
                        />
                        {drawerTab === "active" ? (
                          <Stack direction="row" spacing={0.5}>
                            <Tooltip title={t(tokens.common.edit)}>
                              <IconButton
                                onClick={() => handleEditClick(entry)}
                                size="small"
                              >
                                <EditOutlined fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t(tokens.common.cancel)}>
                              <IconButton
                                color="error"
                                onClick={() => onDelete(entry)}
                                size="small"
                              >
                                <DeleteOutlineOutlined fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        ) : (
                          <Tooltip title={t(tokens.common.restore)}>
                            <IconButton onClick={() => onRestore(entry)} size="small">
                              <ReplayOutlined fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
            {visibleEntries.length === 0 && (
              <Typography color="text.secondary" sx={{ py: 3 }} textAlign="center">
                {t(tokens.dashboard.entryNotFound)}
              </Typography>
            )}
          </Stack>

          <Table size="small" sx={{ display: { xs: "none", sm: "table" } }}>
            <TableHead>
              <TableRow>
                <TableCell>{t(tokens.common.description)}</TableCell>
                <TableCell>{t(tokens.common.date)}</TableCell>
                <TableCell align="right">{t(tokens.common.value)}</TableCell>
                <TableCell align="right">{t(tokens.common.actions)}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleEntries.map((entry) => {
                const isPlanned = Boolean(entry.recurring_entry_id);
                const rowColor = isPlanned
                  ? financeColors.planned
                  : financeColors.unexpected;
                const softColor = isPlanned
                  ? financeColors.plannedSoft
                  : financeColors.unexpectedSoft;

                return (
                <TableRow
                  key={entry.id}
                  sx={{
                    bgcolor: entry.deleted_at ? "transparent" : softColor,
                    borderLeft: "4px solid",
                    borderLeftColor: entry.deleted_at ? "divider" : rowColor,
                  }}
                >
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2">{entry.description}</Typography>
                      <Chip
                        label={
                          isPlanned
                            ? t(tokens.dashboard.planned)
                            : t(tokens.dashboard.unexpected)
                        }
                        size="small"
                        sx={{
                          bgcolor: softColor,
                          color: rowColor,
                          fontWeight: 700,
                        }}
                      />
                    </Stack>
                    {(entry.notes || entry.deleted_reason) && (
                      <Typography color="text.secondary" variant="caption">
                        {entry.notes || entry.deleted_reason}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{dayjs(entry.entry_date).format("DD/MM/YYYY")}</TableCell>
                  <TableCell align="right">
                    {centsToCurrency(entry.amount_cents)}
                  </TableCell>
                  <TableCell align="right">
                    {drawerTab === "active" ? (
                      <Stack direction="row" justifyContent="flex-end" spacing={0.5}>
                        <Tooltip title={t(tokens.common.edit)}>
                          <IconButton onClick={() => handleEditClick(entry)} size="small">
                            <EditOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t(tokens.common.cancel)}>
                          <IconButton
                            color="error"
                            onClick={() => onDelete(entry)}
                            size="small"
                          >
                            <DeleteOutlineOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    ) : (
                      <Tooltip title={t(tokens.common.restore)}>
                        <IconButton onClick={() => onRestore(entry)} size="small">
                          <ReplayOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
                );
              })}
              {visibleEntries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography color="text.secondary" sx={{ py: 3 }} textAlign="center">
                      {t(tokens.dashboard.entryNotFound)}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Stack>
      </Box>
    </Drawer>
  );
}

type AuditTimelineProps = {
  isLoading: boolean;
  logs: AuditLog[];
};

function AuditTimeline({ isLoading, logs }: AuditTimelineProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ py: 2 }}>
        <CircularProgress size={22} />
      </Stack>
    );
  }

  if (logs.length === 0) {
    return (
      <Typography color="text.secondary" variant="body2">
        {t(tokens.dashboard.historyEmpty)}
      </Typography>
    );
  }

  const getActionLabel = (action: string) => {
    switch (action) {
      case "INSERT":
        return t(tokens.dashboard.auditInsert);
      case "UPDATE":
        return t(tokens.dashboard.auditUpdate);
      case "SOFT_DELETE":
        return t(tokens.dashboard.auditSoftDelete);
      case "RESTORE":
        return t(tokens.dashboard.auditRestore);
      case "DELETE":
        return t(tokens.dashboard.auditDelete);
      default:
        return action;
    }
  };

  const getChangedFields = (log: AuditLog): string[] => {
    if (!log.old_values || !log.new_values) {
      return [];
    }

    const excluded = new Set([
      "created_at",
      "updated_at",
      "change_reason",
      "user_id",
      "budget_month_id",
    ]);
    const keys = new Set([
      ...Object.keys(log.old_values),
      ...Object.keys(log.new_values),
    ]);

    return [...keys]
      .filter((key) => !excluded.has(key))
      .filter((key) => {
        const before = (log.old_values as Record<string, unknown>)[key];
        const after = (log.new_values as Record<string, unknown>)[key];
        return JSON.stringify(before) !== JSON.stringify(after);
      })
      .sort((a, b) => a.localeCompare(b));
  };

  const getFieldLabel = (field: string) => {
    const labels: Record<string, string> = {
      amount_cents: t(tokens.common.value),
      deleted_at: t(tokens.common.canceled),
      deleted_reason: t(tokens.dashboard.changeReason),
      description: t(tokens.common.description),
      entry_date: t(tokens.common.date),
      notes: t(tokens.common.notes),
      received_date: t(tokens.common.date),
      recurring_entry_id: t(tokens.dashboard.recurring),
      theme_id: "Tema",
    };

    return labels[field] ?? field.replaceAll("_", " ");
  };

  const formatAuditValue = (field: string, value: unknown) => {
    if (value === null || value === undefined || value === "") {
      return "-";
    }

    if (field === "amount_cents" && typeof value === "number") {
      return centsToCurrency(value);
    }

    if (
      (field === "entry_date" || field === "received_date") &&
      typeof value === "string"
    ) {
      return dayjs(value).format("DD/MM/YYYY");
    }

    if (field === "deleted_at" && typeof value === "string") {
      return dayjs(value).format("DD/MM/YYYY HH:mm");
    }

    if (typeof value === "boolean") {
      return value ? "Sim" : "Não";
    }

    return String(value);
  };

  return (
    <Stack spacing={1.25}>
      {logs.map((log) => {
        const changedFields = getChangedFields(log);

        return (
          <Box
            key={log.id}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              p: 1.5,
            }}
          >
            <Stack spacing={0.75}>
              <Stack
                alignItems={{ xs: "flex-start", sm: "center" }}
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                spacing={1}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label={getActionLabel(log.action)} size="small" />
                  <Typography variant="body2" fontWeight={700}>
                    {dayjs(log.created_at).format("DD/MM/YYYY HH:mm")}
                  </Typography>
                </Stack>

                {log.reason && (
                  <Typography color="text.secondary" variant="caption">
                    {t(tokens.dashboard.changeReason)}: {log.reason}
                  </Typography>
                )}
              </Stack>

              {changedFields.length > 0 && (
                <Stack spacing={0.5}>
                  <Typography color="text.secondary" variant="caption">
                    {t(tokens.dashboard.historyChangedFields)}
                  </Typography>
                  {changedFields.map((field) => {
                    const before = (log.old_values as Record<string, unknown>)[field];
                    const after = (log.new_values as Record<string, unknown>)[field];

                    return (
                      <Typography key={field} color="text.secondary" variant="caption">
                        {getFieldLabel(field)}: {formatAuditValue(field, before)} -&gt;{" "}
                        {formatAuditValue(field, after)}
                      </Typography>
                    );
                  })}
                </Stack>
              )}

              {changedFields.length === 0 && log.new_values && (
                <Typography color="text.secondary" variant="caption">
                  {t(tokens.dashboard.historyCurrentValue)}
                </Typography>
              )}
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}
