import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/pt-br";
import {
  AddOutlined,
  ArrowBackIosNewOutlined,
  ArrowForwardIosOutlined,
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
  LinearProgress,
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
} from "@mui/material";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { AppTextField, MoneyTextField } from "@/components/form-fields";
import { AuthGuard } from "@/guards/auth-guard";
import { DashboardLayout } from "@/layouts/dashboard-layout";
import { useAuth } from "@/contexts/auth-context";
import { tokens } from "@/locales/tokens";
import {
  createEntry,
  createIncomeEntry,
  ensureBudgetMonth,
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
  BudgetMonth,
  BudgetTheme,
  EntryFormValues,
  MonthlyComparison,
  MonthlyIncomeEntry,
  MonthlyThemeEntry,
  ThemeSummary,
} from "@/types/finance";
import {
  basisPointsToPercentage,
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

const financeColors = {
  income: "#15803d",
  incomeSoft: "rgba(21, 128, 61, 0.1)",
  planned: "#b45309",
  plannedSoft: "rgba(180, 83, 9, 0.11)",
  unexpected: "#b91c1c",
  unexpectedSoft: "rgba(185, 28, 28, 0.1)",
};

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
  const [currentMonth, setCurrentMonth] = useState<Dayjs>(dayjs().startOf("month"));
  const [budgetMonth, setBudgetMonth] = useState<BudgetMonth | null>(null);
  const [comparisons, setComparisons] = useState<MonthlyComparison[]>([]);
  const [themes, setThemes] = useState<BudgetTheme[]>([]);
  const [entries, setEntries] = useState<MonthlyThemeEntry[]>([]);
  const [incomeEntries, setIncomeEntries] = useState<MonthlyIncomeEntry[]>([]);
  const [incomeDrawerOpen, setIncomeDrawerOpen] = useState(false);
  const [incomeDrawerTab, setIncomeDrawerTab] = useState<"active" | "deleted">("active");
  const [incomeFormValues, setIncomeFormValues] = useState(emptyIncomeForm());
  const [editingIncomeEntry, setEditingIncomeEntry] =
    useState<MonthlyIncomeEntry | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<ThemeSummary | null>(null);
  const [drawerTab, setDrawerTab] = useState<"active" | "deleted">("active");
  const [formValues, setFormValues] = useState(emptyEntryForm());
  const [editingEntry, setEditingEntry] = useState<MonthlyThemeEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MonthlyThemeEntry | null>(null);
  const [incomeDeleteTarget, setIncomeDeleteTarget] =
    useState<MonthlyIncomeEntry | null>(null);
  const [expenseThemeDialogOpen, setExpenseThemeDialogOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadMonth = useCallback(async () => {
    if (!user) {
      return;
    }

    setIsLoading(true);

    try {
      const month = await ensureBudgetMonth(
        user.id,
        currentMonth.year(),
        currentMonth.month() + 1
      );
      await materializeRecurringEntries(
        month.id,
        currentMonth.year(),
        currentMonth.month() + 1
      );
      const [themeRows, entryRows, incomeRows, comparisonRows] = await Promise.all([
        listBudgetThemes(),
        listMonthEntries(month.id),
        listMonthIncomeEntries(month.id),
        listMonthlyComparisons(currentMonth.year(), currentMonth.month() + 1),
      ]);

      setBudgetMonth(month);
      setComparisons(comparisonRows);
      setThemes(themeRows);
      setEntries(entryRows);
      setIncomeEntries(incomeRows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(tokens.dashboard.loadDataError));
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth, t, user]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

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

  const handleOpenTheme = (summary: ThemeSummary) => {
    setSelectedTheme(summary);
    setDrawerTab("active");
    setEditingEntry(null);
    setFormValues(emptyEntryForm(summary.id));
  };

  const handleEditIncomeEntry = (entry: MonthlyIncomeEntry) => {
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
  };

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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(tokens.dashboard.saveIncomeError));
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditEntry = (entry: MonthlyThemeEntry) => {
    setEditingEntry(entry);
    setFormValues({
      amount: centsToInputValue(entry.amount_cents),
      changeReason: "",
      description: entry.description,
      entryDate: entry.entry_date,
      isRecurring: false,
      notes: entry.notes ?? "",
      recurrenceEndDate: "",
      themeId: entry.theme_id,
    });
  };

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
          notes: formValues.notes,
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(tokens.dashboard.saveExpenseError));
    } finally {
      setIsSaving(false);
    }
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

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 12 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Head>
        <title>
          {t(tokens.common.dashboard)} | {t(tokens.common.appName)}
        </title>
      </Head>

      <Stack spacing={3}>
        <Card
          sx={{
            background:
              "linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(37, 99, 235, 0.72))",
            color: "common.white",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Stack
              alignItems={{ xs: "stretch", md: "center" }}
              direction={{ xs: "column", md: "row" }}
              spacing={3}
            >
              <Box sx={{ flexGrow: 1 }}>
                <Typography sx={{ opacity: 0.72 }} variant="body2">
                  {t(tokens.dashboard.financialOverview)}
                </Typography>
                <Typography sx={{ mt: 0.5 }} variant="h1">
                  {t(tokens.dashboard.monthBudget)}
                </Typography>
                <Typography sx={{ color: "rgba(255,255,255,0.76)", mt: 1 }}>
                  {currentMonth.format("MMMM [de] YYYY")}
                </Typography>
              </Box>

              <Stack
                alignItems="center"
                direction="row"
                spacing={1}
                sx={{
                  bgcolor: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  borderRadius: 2,
                  p: 1,
                }}
              >
                <Tooltip title={t(tokens.dashboard.previousMonth)}>
                  <IconButton
                    onClick={() =>
                      setCurrentMonth((value) => value.subtract(1, "month"))
                    }
                    sx={{ color: "common.white" }}
                  >
                    <ArrowBackIosNewOutlined />
                  </IconButton>
                </Tooltip>
                <Button
                  onClick={() => setCurrentMonth(dayjs().startOf("month"))}
                  sx={{
                    bgcolor: "rgba(255,255,255,0.14)",
                    color: "common.white",
                    "&:hover": { bgcolor: "rgba(255,255,255,0.22)" },
                  }}
                  variant="text"
                >
                  {t(tokens.dashboard.currentMonth)}
                </Button>
                <Tooltip title={t(tokens.dashboard.nextMonth)}>
                  <IconButton
                    onClick={() => setCurrentMonth((value) => value.add(1, "month"))}
                    sx={{ color: "common.white" }}
                  >
                    <ArrowForwardIosOutlined />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              lg: "1.1fr repeat(4, minmax(0, 1fr))",
            },
          }}
        >
          <Card>
            <CardContent>
              <Stack
                alignItems={{ xs: "stretch", sm: "center" }}
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
              >
                <Box sx={{ flexGrow: 1 }}>
                  <Typography color="text.secondary" variant="body2">
                    {t(tokens.dashboard.income)}
                  </Typography>
                  <Typography variant="h2">
                    {centsToCurrency(totals.income)}
                  </Typography>
                  <Typography color="text.secondary" variant="caption">
                    {t(tokens.dashboard.incomeActiveCount, {
                      count: activeIncomeEntries.length,
                    })}
                  </Typography>
                </Box>
                <Button
                  disabled={isSaving}
                  onClick={() => setIncomeDrawerOpen(true)}
                  startIcon={<AddOutlined />}
                  variant="contained"
                >
                  {t(tokens.common.manage)}
                </Button>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack
                alignItems={{ xs: "stretch", sm: "center" }}
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
              >
                <Box sx={{ flexGrow: 1 }}>
                  <Typography color="text.secondary" variant="body2">
                    {t(tokens.dashboard.spent)}
                  </Typography>
                  <Typography color="error.main" variant="h2">
                    {centsToCurrency(totals.spent)}
                  </Typography>
                </Box>
                <Button
                  color="error"
                  disabled={isSaving}
                  onClick={() => setExpenseThemeDialogOpen(true)}
                  startIcon={<AddOutlined />}
                  variant="outlined"
                >
                  {t(tokens.dashboard.addExpense)}
                </Button>
              </Stack>
            </CardContent>
          </Card>

          <MetricCard
            label={t(tokens.dashboard.planned)}
            tone="warning"
            value={centsToCurrency(totals.planned)}
          />
          <MetricCard
            label={t(tokens.dashboard.unexpected)}
            tone="error"
            value={centsToCurrency(totals.unexpected)}
          />
          <MetricCard
            label={t(tokens.dashboard.balance)}
            tone={totals.balance < 0 ? "error" : "success"}
            value={centsToCurrency(totals.balance)}
          />
        </Box>

        <MonthlyComparisonChart data={comparisons} />

        {totals.balance < 0 ? (
          <Alert severity="error">{t(tokens.dashboard.statusOver)}</Alert>
        ) : (
          <Alert severity="success">{t(tokens.dashboard.statusOk)}</Alert>
        )}

        <Stack
          alignItems={{ xs: "stretch", md: "center" }}
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Typography variant="h2">{t(tokens.dashboard.expensesByTheme)}</Typography>
            <Typography color="text.secondary">
              {t(tokens.dashboard.expensesByThemeSubtitle)}
            </Typography>
          </Box>
          <Button
            onClick={() => setExpenseThemeDialogOpen(true)}
            startIcon={<AddOutlined />}
            sx={{
              alignSelf: { xs: "stretch", md: "center" },
              transition: "transform 160ms ease, box-shadow 160ms ease",
              "&:hover": {
                boxShadow: "0 14px 24px rgba(37, 99, 235, 0.22)",
                transform: "translateY(-2px)",
              },
            }}
            variant="contained"
          >
            {t(tokens.dashboard.addExpense)}
          </Button>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              lg: "repeat(3, minmax(0, 1fr))",
            },
          }}
        >
          {themeSummaries.length === 0 ? (
            <Alert severity="warning" sx={{ gridColumn: "1 / -1" }}>
              {t(tokens.dashboard.noThemes)}
            </Alert>
          ) : (
            themeSummaries.map((summary) => {
              const progress =
                summary.recommended_cents > 0
                  ? Math.min((summary.total_cents / summary.recommended_cents) * 100, 140)
                  : 0;
              const isOver = summary.total_cents > summary.recommended_cents;

              return (
                <Card
                  key={summary.id}
                  onClick={() => handleOpenTheme(summary)}
                  sx={{
                    cursor: "pointer",
                    transition: "border-color 160ms ease, transform 160ms ease",
                    border: "1px solid",
                    borderColor: isOver ? "error.light" : "divider",
                    "&:hover": {
                      borderColor: "primary.main",
                      transform: "translateY(-2px)",
                    },
                  }}
                >
                  <CardContent>
                    <Stack spacing={2}>
                      <Stack direction="row" justifyContent="space-between" spacing={2}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography noWrap variant="h3">
                            {summary.name}
                          </Typography>
                          <Typography color="text.secondary" noWrap variant="body2">
                            {summary.description}
                          </Typography>
                        </Box>
                        <Chip
                          color={isOver ? "error" : "default"}
                          label={basisPointsToPercentage(summary.default_percentage_bp)}
                          size="small"
                        />
                      </Stack>

                      <Box>
                        <Typography color="text.secondary" variant="body2">
                          {t(tokens.dashboard.themeSpent)}
                        </Typography>
                        <Typography variant="h2">
                          {centsToCurrency(summary.total_cents)}
                        </Typography>
                      </Box>

                      <LinearProgress
                        color={isOver ? "error" : "primary"}
                        value={progress}
                        variant="determinate"
                      />

                      <Stack direction="row" justifyContent="space-between">
                        <Typography color="text.secondary" variant="body2">
                          {t(tokens.dashboard.themeRecommended)}
                        </Typography>
                        <Typography variant="body2">
                          {centsToCurrency(summary.recommended_cents)}
                        </Typography>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })
          )}
        </Box>
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
          setEditingEntry(null);
          setFormValues(emptyEntryForm(selectedTheme?.id));
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
          setEditingIncomeEntry(null);
          setIncomeFormValues(emptyIncomeForm());
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

type MetricCardProps = {
  label: string;
  value: string;
  tone?: "default" | "success" | "error" | "warning";
};

type MonthlyComparisonChartProps = {
  data: MonthlyComparison[];
};

function MonthlyComparisonChart({ data }: MonthlyComparisonChartProps) {
  const { t } = useTranslation();
  const maxValue = Math.max(
    1,
    ...data.flatMap((month) => [
      month.income_cents,
      month.planned_expense_cents,
      month.unexpected_expense_cents,
    ])
  );

  return (
    <Card>
      <CardContent>
        <Stack spacing={2.5}>
          <Stack
            alignItems={{ xs: "stretch", sm: "center" }}
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            spacing={1}
          >
            <Box>
              <Typography variant="h3">{t(tokens.dashboard.comparisonTitle)}</Typography>
              <Typography color="text.secondary" variant="body2">
                {t(tokens.dashboard.comparisonSubtitle)}
              </Typography>
            </Box>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              <LegendDot color={financeColors.income} label={t(tokens.dashboard.income)} />
              <LegendDot color={financeColors.planned} label={t(tokens.dashboard.planned)} />
              <LegendDot
                color={financeColors.unexpected}
                label={t(tokens.dashboard.unexpected)}
              />
            </Stack>
          </Stack>

          {data.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4 }} textAlign="center">
              {t(tokens.dashboard.comparisonEmpty)}
            </Typography>
          ) : (
            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: {
                  xs: "1fr",
                  md: `repeat(${Math.min(data.length, 6)}, minmax(0, 1fr))`,
                },
              }}
            >
              {data.map((month) => (
                <Box
                  key={month.budget_month_id}
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                    p: 1.5,
                  }}
                >
                  <Stack spacing={1.25}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography fontWeight={700} variant="body2">
                        {month.label}
                      </Typography>
                      <Typography
                        color={month.balance_cents < 0 ? "error.main" : "success.main"}
                        fontWeight={700}
                        variant="body2"
                      >
                        {centsToCurrency(month.balance_cents)}
                      </Typography>
                    </Stack>
                    <ChartBar
                      color={financeColors.income}
                      label={t(tokens.dashboard.income)}
                      maxValue={maxValue}
                      value={month.income_cents}
                    />
                    <ChartBar
                      color={financeColors.planned}
                      label={t(tokens.dashboard.planned)}
                      maxValue={maxValue}
                      value={month.planned_expense_cents}
                    />
                    <ChartBar
                      color={financeColors.unexpected}
                      label={t(tokens.dashboard.unexpected)}
                      maxValue={maxValue}
                      value={month.unexpected_expense_cents}
                    />
                  </Stack>
                </Box>
              ))}
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

type ChartBarProps = {
  color: string;
  label: string;
  maxValue: number;
  value: number;
};

function ChartBar({ color, label, maxValue, value }: ChartBarProps) {
  const width = `${Math.max(3, Math.round((value / maxValue) * 100))}%`;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" spacing={1}>
        <Typography color="text.secondary" variant="caption">
          {label}
        </Typography>
        <Typography color="text.secondary" variant="caption">
          {centsToCurrency(value)}
        </Typography>
      </Stack>
      <Box
        sx={{
          bgcolor: "rgba(15, 23, 42, 0.08)",
          borderRadius: 999,
          height: 8,
          mt: 0.5,
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            bgcolor: color,
            borderRadius: 999,
            height: "100%",
            transition: "width 220ms ease",
            width,
          }}
        />
      </Box>
    </Box>
  );
}

type LegendDotProps = {
  color: string;
  label: string;
};

function LegendDot({ color, label }: LegendDotProps) {
  return (
    <Stack alignItems="center" direction="row" spacing={0.75}>
      <Box sx={{ bgcolor: color, borderRadius: "50%", height: 10, width: 10 }} />
      <Typography color="text.secondary" variant="caption">
        {label}
      </Typography>
    </Stack>
  );
}

function MetricCard({ label, tone = "default", value }: MetricCardProps) {
  const toneMap = {
    default: {
      bgcolor: "background.paper",
      color: "text.primary",
      line: "primary.main",
    },
    error: {
      bgcolor: financeColors.unexpectedSoft,
      color: "error.main",
      line: financeColors.unexpected,
    },
    success: {
      bgcolor: financeColors.incomeSoft,
      color: "success.main",
      line: financeColors.income,
    },
    warning: {
      bgcolor: financeColors.plannedSoft,
      color: "warning.main",
      line: financeColors.planned,
    },
  }[tone];

  return (
    <Card sx={{ bgcolor: toneMap.bgcolor, borderLeft: "4px solid", borderColor: toneMap.line }}>
      <CardContent>
        <Typography color="text.secondary" variant="body2">
          {label}
        </Typography>
        <Typography color={toneMap.color} variant="h2">
          {value}
        </Typography>
      </CardContent>
    </Card>
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
          width: 680,
        },
      }}
    >
      <Box sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h2">{t(tokens.dashboard.income)}</Typography>
            <Typography color="text.secondary">
              {t(tokens.dashboard.totalActive)}: {centsToCurrency(totalCents)}
            </Typography>
          </Box>

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

          <Table size="small">
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

    if (typeof document === "undefined") {
      return;
    }

    requestAnimationFrame(() => {
      document
        .getElementById("expense-entry-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      (document.getElementById("expense-description") as HTMLInputElement | null)?.focus();
    });
  };

  return (
    <Drawer
      anchor="right"
      onClose={onClose}
      open={open}
      PaperProps={{
        sx: {
          maxWidth: "100%",
          width: 680,
        },
      }}
    >
      <Box sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h2">{theme?.name}</Typography>
            <Typography color="text.secondary">
              {t(tokens.dashboard.totalActive)}: {centsToCurrency(theme?.total_cents ?? 0)}
            </Typography>
          </Box>

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

          <Table size="small">
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
