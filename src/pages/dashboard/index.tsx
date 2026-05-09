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
import { AppTextField, MoneyTextField } from "@/components/form-fields";
import { AuthGuard } from "@/guards/auth-guard";
import { DashboardLayout } from "@/layouts/dashboard-layout";
import { useAuth } from "@/contexts/auth-context";
import {
  createEntry,
  createIncomeEntry,
  ensureBudgetMonth,
  listBudgetThemes,
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
  const [currentMonth, setCurrentMonth] = useState<Dayjs>(dayjs().startOf("month"));
  const [budgetMonth, setBudgetMonth] = useState<BudgetMonth | null>(null);
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
      const [themeRows, entryRows, incomeRows] = await Promise.all([
        listBudgetThemes(),
        listMonthEntries(month.id),
        listMonthIncomeEntries(month.id),
      ]);

      setBudgetMonth(month);
      setThemes(themeRows);
      setEntries(entryRows);
      setIncomeEntries(incomeRows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar dados.");
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth, user]);

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

    return {
      balance: incomeTotalCents - spent,
      income: incomeTotalCents,
      spent,
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
        toast.success("Receita atualizada.");
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
        toast.success("Receita adicionada.");
      }

      setEditingIncomeEntry(null);
      setIncomeFormValues(emptyIncomeForm());
      setIncomeEntries(await listMonthIncomeEntries(budgetMonth.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar receita.");
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
        toast.success("Lancamento atualizado.");
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
        toast.success("Lancamento adicionado.");
      }

      setEditingEntry(null);
      setFormValues(emptyEntryForm(selectedTheme.id));
      setEntries(await listMonthEntries(budgetMonth.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar lancamento.");
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
      toast.success("Lancamento cancelado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao cancelar lancamento.");
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
      toast.success("Receita cancelada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao cancelar receita.");
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
      toast.success("Lancamento restaurado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao restaurar lancamento.");
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
      toast.success("Receita restaurada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao restaurar receita.");
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
        <title>Dashboard | Planejador Financeiro</title>
      </Head>

      <Stack spacing={3}>
        <Stack
          alignItems={{ xs: "stretch", md: "center" }}
          direction={{ xs: "column", md: "row" }}
          spacing={2}
        >
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h1">Orcamento mensal</Typography>
            <Typography color="text.secondary">
              {currentMonth.format("MMMM [de] YYYY")}
            </Typography>
          </Box>

          <Stack alignItems="center" direction="row" spacing={1}>
            <Tooltip title="Mes anterior">
              <IconButton onClick={() => setCurrentMonth((value) => value.subtract(1, "month"))}>
                <ArrowBackIosNewOutlined />
              </IconButton>
            </Tooltip>
            <Button
              onClick={() => setCurrentMonth(dayjs().startOf("month"))}
              variant="outlined"
            >
              Mes atual
            </Button>
            <Tooltip title="Proximo mes">
              <IconButton onClick={() => setCurrentMonth((value) => value.add(1, "month"))}>
                <ArrowForwardIosOutlined />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "1fr",
              md: "1.1fr 1fr 1fr",
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
                    Receitas do mes
                  </Typography>
                  <Typography variant="h2">
                    {centsToCurrency(totals.income)}
                  </Typography>
                  <Typography color="text.secondary" variant="caption">
                    {activeIncomeEntries.length} entradas ativas
                  </Typography>
                </Box>
                <Button
                  disabled={isSaving}
                  onClick={() => setIncomeDrawerOpen(true)}
                  startIcon={<AddOutlined />}
                  variant="contained"
                >
                  Gerenciar
                </Button>
              </Stack>
            </CardContent>
          </Card>

          <MetricCard label="Gasto total" value={centsToCurrency(totals.spent)} />
          <MetricCard
            label="Saldo"
            tone={totals.balance < 0 ? "error" : "success"}
            value={centsToCurrency(totals.balance)}
          />
        </Box>

        {totals.balance < 0 ? (
          <Alert severity="error">Atencao: voce gastou mais do que ganha neste mes.</Alert>
        ) : (
          <Alert severity="success">Voce esta dentro do orcamento deste mes.</Alert>
        )}

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
          {themeSummaries.map((summary) => {
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
                        Gasto
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
                        Recomendado
                      </Typography>
                      <Typography variant="body2">
                        {centsToCurrency(summary.recommended_cents)}
                      </Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
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
        <DialogTitle>Cancelar lancamento</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography color="text.secondary">
              O item continuara no historico e deixara de entrar no total do tema.
            </Typography>
            <AppTextField
              autoFocus
              fullWidth
              label="Motivo"
              onChange={(event) => setDeleteReason(event.target.value)}
              value={deleteReason}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Voltar</Button>
          <Button
            color="error"
            disabled={isSaving}
            onClick={handleSoftDelete}
            startIcon={<DeleteOutlineOutlined />}
            variant="contained"
          >
            Cancelar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(incomeDeleteTarget)}
        onClose={() => setIncomeDeleteTarget(null)}
        fullWidth
      >
        <DialogTitle>Cancelar receita</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography color="text.secondary">
              O item continuara no historico e deixara de entrar no total do mes.
            </Typography>
            <AppTextField
              autoFocus
              fullWidth
              label="Motivo"
              onChange={(event) => setDeleteReason(event.target.value)}
              value={deleteReason}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIncomeDeleteTarget(null)}>Voltar</Button>
          <Button
            color="error"
            disabled={isSaving}
            onClick={handleSoftDeleteIncome}
            startIcon={<DeleteOutlineOutlined />}
            variant="contained"
          >
            Cancelar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
  tone?: "default" | "success" | "error";
};

function MetricCard({ label, tone = "default", value }: MetricCardProps) {
  return (
    <Card>
      <CardContent>
        <Typography color="text.secondary" variant="body2">
          {label}
        </Typography>
        <Typography
          color={
            tone === "success"
              ? "success.main"
              : tone === "error"
                ? "error.main"
                : "text.primary"
          }
          variant="h2"
        >
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
            <Typography variant="h2">Receitas do mes</Typography>
            <Typography color="text.secondary">
              Total ativo: {centsToCurrency(totalCents)}
            </Typography>
          </Box>

          <Card variant="outlined">
            <CardContent>
              <Box component="form" onSubmit={onSubmit}>
                <Stack spacing={2}>
                  <Typography variant="h3">
                    {editingEntry ? "Editar receita" : "Nova receita"}
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <AppTextField
                      fullWidth
                      label="Descricao"
                      onChange={(event) =>
                        onFormChange({ ...formValues, description: event.target.value })
                      }
                      placeholder="Salario, bonificacao, extra..."
                      required
                      value={formValues.description}
                    />
                    <MoneyTextField
                      label="Valor"
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
                      label="Data"
                      onChange={(event) =>
                        onFormChange({ ...formValues, entryDate: event.target.value })
                      }
                      required
                      type="date"
                      value={formValues.entryDate}
                    />
                    <AppTextField
                      fullWidth
                      label="Observacoes"
                      onChange={(event) =>
                        onFormChange({ ...formValues, notes: event.target.value })
                      }
                      value={formValues.notes}
                    />
                  </Stack>
                  {editingEntry ? (
                    <AppTextField
                      fullWidth
                      label="Motivo da alteracao"
                      onChange={(event) =>
                        onFormChange({
                          ...formValues,
                          changeReason: event.target.value,
                        })
                      }
                      placeholder="Opcional"
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
                        label="Recorrente"
                      />
                      {formValues.isRecurring && (
                        <AppTextField
                          fullWidth
                          helperText="Deixe em branco para repetir sem data final."
                          label="Repetir ate"
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
                    {editingEntry && <Button onClick={onCancelEdit}>Limpar</Button>}
                    <Button
                      disabled={isSaving}
                      startIcon={editingEntry ? <SaveOutlined /> : <AddOutlined />}
                      type="submit"
                      variant="contained"
                    >
                      {editingEntry ? "Salvar" : "Adicionar"}
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
              <Tab label={`Ativas (${activeEntries.length})`} value="active" />
              <Tab
                icon={<HistoryOutlined />}
                iconPosition="start"
                label={`Canceladas (${deletedEntries.length})`}
                value="deleted"
              />
            </Tabs>
            <Divider />
          </Box>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Descricao</TableCell>
                <TableCell>Data</TableCell>
                <TableCell align="right">Valor</TableCell>
                <TableCell align="right">Acoes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <Typography variant="body2">{entry.description}</Typography>
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
                        <Tooltip title="Editar">
                          <IconButton onClick={() => onEdit(entry)} size="small">
                            <EditOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Cancelar">
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
                      <Tooltip title="Restaurar">
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
                      Nenhuma receita encontrada.
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
            <Typography variant="h2">{theme?.name}</Typography>
            <Typography color="text.secondary">
              Total ativo: {centsToCurrency(theme?.total_cents ?? 0)}
            </Typography>
          </Box>

          <Card variant="outlined">
            <CardContent>
              <Box component="form" onSubmit={onSubmit}>
                <Stack spacing={2}>
                  <Typography variant="h3">
                    {editingEntry ? "Editar lancamento" : "Novo lancamento"}
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <AppTextField
                      fullWidth
                      label="Descricao"
                      onChange={(event) =>
                        onFormChange({ ...formValues, description: event.target.value })
                      }
                      required
                      value={formValues.description}
                    />
                    <MoneyTextField
                      label="Valor"
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
                      label="Data"
                      onChange={(event) =>
                        onFormChange({ ...formValues, entryDate: event.target.value })
                      }
                      required
                      type="date"
                      value={formValues.entryDate}
                    />
                    <AppTextField
                      fullWidth
                      label="Observacoes"
                      onChange={(event) =>
                        onFormChange({ ...formValues, notes: event.target.value })
                      }
                      value={formValues.notes}
                    />
                  </Stack>
                  {editingEntry ? (
                    <AppTextField
                      fullWidth
                      label="Motivo da alteracao"
                      onChange={(event) =>
                        onFormChange({
                          ...formValues,
                          changeReason: event.target.value,
                        })
                      }
                      placeholder="Opcional"
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
                        label="Recorrente"
                      />
                      {formValues.isRecurring && (
                        <AppTextField
                          fullWidth
                          helperText="Deixe em branco para repetir sem data final."
                          label="Repetir ate"
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
                      <Button onClick={onCancelEdit}>Limpar</Button>
                    )}
                    <Button
                      disabled={isSaving}
                      startIcon={editingEntry ? <SaveOutlined /> : <AddOutlined />}
                      type="submit"
                      variant="contained"
                    >
                      {editingEntry ? "Salvar" : "Adicionar"}
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
              <Tab label={`Ativos (${activeEntries.length})`} value="active" />
              <Tab
                icon={<HistoryOutlined />}
                iconPosition="start"
                label={`Cancelados (${deletedEntries.length})`}
                value="deleted"
              />
            </Tabs>
            <Divider />
          </Box>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Descricao</TableCell>
                <TableCell>Data</TableCell>
                <TableCell align="right">Valor</TableCell>
                <TableCell align="right">Acoes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <Typography variant="body2">{entry.description}</Typography>
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
                        <Tooltip title="Editar">
                          <IconButton onClick={() => onEdit(entry)} size="small">
                            <EditOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Cancelar">
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
                      <Tooltip title="Restaurar">
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
                      Nenhum lancamento encontrado.
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
