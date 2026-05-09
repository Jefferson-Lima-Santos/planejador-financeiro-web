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
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
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
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import toast from "react-hot-toast";
import { AuthGuard } from "@/guards/auth-guard";
import { DashboardLayout } from "@/layouts/dashboard-layout";
import { useAuth } from "@/contexts/auth-context";
import {
  createEntry,
  ensureBudgetMonth,
  listBudgetThemes,
  listMonthEntries,
  restoreEntry,
  softDeleteEntry,
  updateEntry,
  updateMonthSalary,
} from "@/lib/finance-repository";
import type {
  BudgetMonth,
  BudgetTheme,
  EntryFormValues,
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
  description: "",
  entryDate: dayjs().format("YYYY-MM-DD"),
  notes: "",
  themeId,
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
  const [salaryInput, setSalaryInput] = useState("0,00");
  const [selectedTheme, setSelectedTheme] = useState<ThemeSummary | null>(null);
  const [drawerTab, setDrawerTab] = useState<"active" | "deleted">("active");
  const [formValues, setFormValues] = useState(emptyEntryForm());
  const [editingEntry, setEditingEntry] = useState<MonthlyThemeEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MonthlyThemeEntry | null>(null);
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
      const [themeRows, entryRows] = await Promise.all([
        listBudgetThemes(),
        listMonthEntries(month.id),
      ]);

      setBudgetMonth(month);
      setThemes(themeRows);
      setEntries(entryRows);
      setSalaryInput(centsToInputValue(month.salary_cents));
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

  const themeSummaries = useMemo<ThemeSummary[]>(() => {
    const salary = budgetMonth?.salary_cents ?? 0;

    return themes.map((theme) => {
      const total = activeEntries
        .filter((entry) => entry.theme_id === theme.id)
        .reduce((sum, entry) => sum + entry.amount_cents, 0);
      const recommended = Math.round((salary * theme.default_percentage_bp) / 10000);
      const spentPercentage = salary > 0 ? Math.round((total / salary) * 10000) : 0;

      return {
        ...theme,
        recommended_cents: recommended,
        spent_percentage_bp: spentPercentage,
        total_cents: total,
      };
    });
  }, [activeEntries, budgetMonth?.salary_cents, themes]);

  const totals = useMemo(() => {
    const spent = activeEntries.reduce((sum, entry) => sum + entry.amount_cents, 0);
    const salary = budgetMonth?.salary_cents ?? 0;

    return {
      balance: salary - spent,
      salary,
      spent,
    };
  }, [activeEntries, budgetMonth?.salary_cents]);

  const openedThemeEntries = useMemo(() => {
    if (!selectedTheme) {
      return [];
    }

    return entries.filter((entry) => entry.theme_id === selectedTheme.id);
  }, [entries, selectedTheme]);

  const openedActiveEntries = openedThemeEntries.filter((entry) => !entry.deleted_at);
  const openedDeletedEntries = openedThemeEntries.filter((entry) => entry.deleted_at);

  const handleSaveSalary = async () => {
    if (!budgetMonth) {
      return;
    }

    setIsSaving(true);

    try {
      const salaryCents = currencyInputToCents(salaryInput);
      await updateMonthSalary(budgetMonth.id, salaryCents);
      setBudgetMonth({ ...budgetMonth, salary_cents: salaryCents });
      toast.success("Salario salvo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar salario.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenTheme = (summary: ThemeSummary) => {
    setSelectedTheme(summary);
    setDrawerTab("active");
    setEditingEntry(null);
    setFormValues(emptyEntryForm(summary.id));
  };

  const handleEditEntry = (entry: MonthlyThemeEntry) => {
    setEditingEntry(entry);
    setFormValues({
      amount: centsToInputValue(entry.amount_cents),
      description: entry.description,
      entryDate: entry.entry_date,
      notes: entry.notes ?? "",
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
          notes: formValues.notes,
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
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  fullWidth
                  label="Salario do mes"
                  onChange={(event) => setSalaryInput(event.target.value)}
                  value={salaryInput}
                />
                <Button
                  disabled={isSaving}
                  onClick={handleSaveSalary}
                  startIcon={<SaveOutlined />}
                  variant="contained"
                >
                  Salvar
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

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} fullWidth>
        <DialogTitle>Cancelar lancamento</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography color="text.secondary">
              O item continuara no historico e deixara de entrar no total do tema.
            </Typography>
            <TextField
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
                    <TextField
                      fullWidth
                      label="Descricao"
                      onChange={(event) =>
                        onFormChange({ ...formValues, description: event.target.value })
                      }
                      required
                      value={formValues.description}
                    />
                    <TextField
                      label="Valor"
                      onChange={(event) =>
                        onFormChange({ ...formValues, amount: event.target.value })
                      }
                      required
                      value={formValues.amount}
                    />
                  </Stack>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField
                      fullWidth
                      label="Data"
                      onChange={(event) =>
                        onFormChange({ ...formValues, entryDate: event.target.value })
                      }
                      required
                      type="date"
                      value={formValues.entryDate}
                    />
                    <TextField
                      fullWidth
                      label="Observacoes"
                      onChange={(event) =>
                        onFormChange({ ...formValues, notes: event.target.value })
                      }
                      value={formValues.notes}
                    />
                  </Stack>
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
