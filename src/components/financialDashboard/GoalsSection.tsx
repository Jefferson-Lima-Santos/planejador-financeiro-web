import dayjs from "dayjs";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  LinearProgress,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { EditOutlined, FlagOutlined } from "@mui/icons-material";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { tokens } from "@/locales/tokens";
import type { Goal, GoalInvestment } from "@/types/finance";
import { centsToCurrency } from "@/utils/money";

type GoalsSectionProps = {
  goals: Goal[];
  isLoading: boolean;
  onAddGoal: () => void;
  onContributionAction: (
    goal: Goal,
    investment: GoalInvestment,
    status: "confirmed" | "skipped"
  ) => void;
  onEditGoal: (goal: Goal) => void;
  isSaving?: boolean;
};

const getInvestmentRateLabel = (
  investment: GoalInvestment,
  translate: TFunction
) => {
  const rate = (investment.return_rate_basis_points / 100).toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
  const periodLabel =
    investment.return_rate_period === "monthly"
      ? translate(tokens.dashboard.goalInvestmentReturnPeriodMonthly)
      : translate(tokens.dashboard.goalInvestmentReturnPeriodAnnual);

  return `${rate}% ${periodLabel.toLowerCase()}`;
};

const getProjectionAlertProps = (goal: Goal, translate: TFunction) => {
  switch (goal.target_status) {
    case "on_track":
      return {
        message: translate(tokens.dashboard.goalProjectionOnTrack),
        severity: "success" as const,
      };
    case "needs_more":
      return {
        message: translate(tokens.dashboard.goalProjectionNeedsMore),
        severity: "warning" as const,
      };
    case "expired":
      return {
        message: translate(tokens.dashboard.goalProjectionExpired),
        severity: "error" as const,
      };
    default:
      return {
        message: translate(tokens.dashboard.goalProjectionMissingDate),
        severity: "info" as const,
      };
  }
};

const getRemainingTimeLabel = (
  monthsToTarget: number
) => {
  const years = Math.floor(monthsToTarget / 12);
  const months = monthsToTarget % 12;
  const parts: string[] = [];

  if (years > 0) {
    parts.push(`${years} ${years === 1 ? "ano" : "anos"}`);
  }

  if (months > 0) {
    parts.push(`${months} ${months === 1 ? "mês" : "meses"}`);
  }

  if (parts.length === 0) {
    parts.push("0 meses");
  }

  return `${parts.join(" e ")} ${monthsToTarget === 1 ? "restante" : "restantes"}`;
};

export const GoalsSection = ({
  goals,
  isLoading,
  onAddGoal,
  onContributionAction,
  onEditGoal,
  isSaving = false,
}: GoalsSectionProps) => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack
            alignItems={{ xs: "flex-start", sm: "center" }}
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            spacing={2}
          >
            <Stack alignItems="center" direction="row" spacing={1.5}>
              <Avatar sx={{ bgcolor: "primary.main", height: 36, width: 36 }}>
                <FlagOutlined fontSize="small" />
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h3">{t(tokens.dashboard.goalsTitle)}</Typography>
                <Typography color="text.secondary" variant="body2">
                  {t(tokens.dashboard.goalsSubtitle)}
                </Typography>
              </Box>
            </Stack>

            <Button onClick={onAddGoal} startIcon={<FlagOutlined />} variant="contained">
              {t(tokens.dashboard.addGoal)}
            </Button>
          </Stack>

          {isLoading ? (
            <Stack spacing={1.5}>
              {Array.from({ length: 2 }).map((_, index) => (
                <Card key={index} variant="outlined">
                  <CardContent sx={{ "&:last-child": { pb: 2 } }}>
                    <Stack spacing={1.5}>
                      <Skeleton height={26} width="28%" />
                      <Skeleton height={34} width="22%" />
                      <Skeleton height={10} sx={{ borderRadius: 999 }} variant="rectangular" />
                      <Skeleton height={64} sx={{ borderRadius: 2 }} variant="rectangular" />
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          ) : goals.length === 0 ? (
            <Alert severity="info">{t(tokens.dashboard.goalsEmpty)}</Alert>
          ) : (
            <Stack spacing={1.5}>
              {goals.map((goal) => {
                const progress =
                  goal.target_value_cents > 0
                    ? Math.min(((goal.total_saved_cents ?? goal.current_value_cents) /
                        goal.target_value_cents) *
                        100, 100)
                    : 0;
                const investments = goal.investments ?? [];
                const additionalPerInvestmentCents =
                  goal.required_additional_monthly_contribution_cents &&
                  investments.length > 0
                    ? Math.ceil(
                        goal.required_additional_monthly_contribution_cents /
                          investments.length
                      )
                    : 0;
                const alertProps = getProjectionAlertProps(goal, t);

                return (
                  <Card key={goal.id} variant="outlined">
                    <CardContent sx={{ "&:last-child": { pb: 2 } }}>
                      <Stack spacing={2}>
                        <Stack
                          alignItems={{ xs: "flex-start", md: "center" }}
                          direction={{ xs: "column", md: "row" }}
                          justifyContent="space-between"
                          spacing={1.5}
                        >
                          <Box>
                            <Typography fontWeight={800} variant="h3">
                              {goal.name}
                            </Typography>
                            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
                              <Chip
                                label={goal.target_date
                                  ? `${t(tokens.dashboard.goalTargetDate)}: ${dayjs(
                                      goal.target_date
                                    ).format("DD/MM/YYYY")}`
                                  : t(tokens.dashboard.goalProjectionMissingDate)}
                                size="small"
                              />
                              {goal.months_to_target !== null &&
                                goal.months_to_target > 0 && (
                                  <Chip
                                    color="primary"
                                    label={getRemainingTimeLabel(goal.months_to_target)}
                                    size="small"
                                    variant="outlined"
                                  />
                                )}
                            </Stack>
                          </Box>

                          <Stack alignItems={{ xs: "flex-start", md: "flex-end" }} spacing={1}>
                            <Button
                              onClick={() => onEditGoal(goal)}
                              size="small"
                              startIcon={<EditOutlined />}
                              variant="outlined"
                            >
                              {t(tokens.dashboard.editGoal)}
                            </Button>
                            <Typography color="primary.main" variant="h2">
                              {centsToCurrency(goal.total_saved_cents ?? goal.current_value_cents)}
                            </Typography>
                            <Typography color="text.secondary" variant="body2">
                              {centsToCurrency(goal.target_value_cents)}
                            </Typography>
                          </Stack>
                        </Stack>

                        <Box>
                          <LinearProgress value={progress} variant="determinate" />
                          <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.75 }}>
                            <Typography color="text.secondary" variant="caption">
                              {Math.round(progress)}%
                            </Typography>
                            <Typography color="text.secondary" variant="caption">
                              {t(tokens.dashboard.goalProjectedValue)}:{" "}
                              {centsToCurrency(
                                goal.projected_value_cents ?? goal.current_value_cents
                              )}
                            </Typography>
                          </Stack>
                        </Box>

                        <Stack
                          direction={{ xs: "column", xl: "row" }}
                          divider={<Divider flexItem orientation="vertical" />}
                          spacing={2}
                        >
                          <Stack
                            spacing={1.25}
                            sx={{ display: "grid", flex: 1, gap: 1.25, gridTemplateColumns: {
                              xs: "1fr",
                              sm: "repeat(2, minmax(0, 1fr))",
                            } }}
                          >
                            <SummaryMetric
                              label={t(tokens.dashboard.goalManualSaved)}
                              value={centsToCurrency(
                                goal.manual_current_value_cents ?? 0
                              )}
                            />
                            <SummaryMetric
                              label={t(tokens.dashboard.goalLinkedSavings)}
                              value={centsToCurrency(goal.linked_savings_cents ?? 0)}
                            />
                            <SummaryMetric
                              label={t(tokens.dashboard.goalInvestmentTotal)}
                              value={centsToCurrency(goal.investment_total_cents ?? 0)}
                            />
                            <SummaryMetric
                              label={t(tokens.dashboard.goalRequiredMonthly)}
                              value={goal.required_monthly_contribution_cents === null
                                ? "-"
                                : centsToCurrency(goal.required_monthly_contribution_cents)}
                            />
                            <SummaryMetric
                              label={t(tokens.dashboard.goalAdditionalMonthly)}
                              value={goal.required_additional_monthly_contribution_cents === null
                                ? "-"
                                : centsToCurrency(
                                    goal.required_additional_monthly_contribution_cents
                                  )}
                            />
                          </Stack>

                          <Stack flex={1} spacing={1.5}>
                            <Alert severity={alertProps.severity}>{alertProps.message}</Alert>

                            <Box
                              sx={{
                                bgcolor: "rgba(37, 99, 235, 0.08)",
                                border: "1px solid",
                                borderColor: "primary.light",
                                borderRadius: 2,
                                p: 1.5,
                              }}
                            >
                              <Typography
                                color="primary.main"
                                fontWeight={800}
                                variant="h3"
                              >
                                {goal.target_date
                                  ? t(tokens.dashboard.goalProjectedValueMessage, {
                                      date: dayjs(goal.target_date).format("DD/MM/YYYY"),
                                      value: centsToCurrency(
                                        goal.projected_value_cents ??
                                          goal.current_value_cents
                                      ),
                                    })
                                  : t(tokens.dashboard.goalProjectedValue)}
                              </Typography>

                              {additionalPerInvestmentCents > 0 && (
                                <Typography color="text.secondary" sx={{ mt: 0.75 }} variant="body2">
                                  {t(tokens.dashboard.goalProjectionSplitHint, {
                                    value: centsToCurrency(additionalPerInvestmentCents),
                                  })}
                                </Typography>
                              )}
                            </Box>

                            {investments.length === 0 ? (
                              <Alert severity="info">
                                {t(tokens.dashboard.goalNoInvestments)}
                              </Alert>
                            ) : (
                              <Stack spacing={1}>
                                {investments.map((investment) => (
                                  <Box
                                    key={investment.id}
                                    sx={{
                                      border: "1px solid",
                                      borderColor: "divider",
                                      borderRadius: 2,
                                      p: 1.5,
                                    }}
                                  >
                                    <Stack
                                      alignItems={{ xs: "flex-start", sm: "center" }}
                                      direction={{ xs: "column", sm: "row" }}
                                      justifyContent="space-between"
                                      spacing={1}
                                    >
                                      <Box>
                                        <Typography fontWeight={700}>
                                          {investment.name}
                                        </Typography>
                                        <Typography color="text.secondary" variant="caption">
                                          {getInvestmentRateLabel(investment, t)}
                                        </Typography>
                                      </Box>
                                      <Stack
                                        direction={{ xs: "column", sm: "row" }}
                                        spacing={2}
                                      >
                                        <MiniMetric
                                          label={t(tokens.dashboard.goalInvestmentCurrentValue)}
                                          value={centsToCurrency(
                                            investment.current_value_cents
                                          )}
                                        />
                                        <MiniMetric
                                          label={t(
                                            tokens.dashboard.goalInvestmentMonthlyContribution
                                          )}
                                          value={centsToCurrency(
                                            investment.monthly_contribution_cents
                                          )}
                                        />
                                        {investment.monthly_contribution_cents > 0 && (
                                          <MiniMetric
                                            label={t(
                                              tokens.dashboard.goalInvestmentConfirmedAmount
                                            )}
                                            value={centsToCurrency(
                                              investment.contribution
                                                ?.confirmed_amount_cents ?? 0
                                            )}
                                          />
                                        )}
                                      </Stack>
                                    </Stack>

                                    {investment.monthly_contribution_cents > 0 && (
                                      <Stack spacing={1.25} sx={{ mt: 1.5 }}>
                                        <Typography color="text.secondary" variant="body2">
                                          {t(tokens.dashboard.goalInvestmentMonthPrompt)}
                                        </Typography>
                                        <Stack
                                          alignItems={{ xs: "flex-start", sm: "center" }}
                                          direction={{ xs: "column", sm: "row" }}
                                          justifyContent="space-between"
                                          spacing={1}
                                        >
                                          <Chip
                                            color={
                                              investment.contribution?.status === "confirmed"
                                                ? "success"
                                                : investment.contribution?.status === "skipped"
                                                ? "default"
                                                : "warning"
                                            }
                                            label={
                                              investment.contribution?.status === "confirmed"
                                                ? t(
                                                    tokens.dashboard.goalInvestmentConfirmed
                                                  )
                                                : investment.contribution?.status ===
                                                  "skipped"
                                                ? t(tokens.dashboard.goalInvestmentNotDone)
                                                : t(tokens.dashboard.goalInvestmentPending)
                                            }
                                            size="small"
                                            variant="outlined"
                                          />
                                          <Stack
                                            direction={{ xs: "column", sm: "row" }}
                                            spacing={1}
                                          >
                                            <Button
                                              disabled={isSaving}
                                              onClick={() =>
                                                onContributionAction(
                                                  goal,
                                                  investment,
                                                  "confirmed"
                                                )
                                              }
                                              size="small"
                                              variant="contained"
                                            >
                                              {t(tokens.dashboard.goalInvestmentConfirmMonth)}
                                            </Button>
                                            {investment.contribution?.status !== "skipped" && (
                                              <Button
                                                disabled={isSaving}
                                                onClick={() =>
                                                  onContributionAction(
                                                    goal,
                                                    investment,
                                                    "skipped"
                                                  )
                                                }
                                                size="small"
                                                variant="outlined"
                                              >
                                                {t(tokens.dashboard.goalInvestmentNotDone)}
                                              </Button>
                                            )}
                                          </Stack>
                                        </Stack>
                                      </Stack>
                                    )}
                                  </Box>
                                ))}
                              </Stack>
                            )}
                          </Stack>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

type MetricProps = {
  label: string;
  value: string;
};

const SummaryMetric = ({ label, value }: MetricProps) => (
  <Box
    sx={{
      border: "1px solid",
      borderColor: "divider",
      borderRadius: 2,
      p: 1.5,
    }}
  >
    <Typography color="text.secondary" variant="caption">
      {label}
    </Typography>
    <Typography fontWeight={800}>{value}</Typography>
  </Box>
);

const MiniMetric = ({ label, value }: MetricProps) => (
  <Box sx={{ minWidth: 140 }}>
    <Typography color="text.secondary" variant="caption">
      {label}
    </Typography>
    <Typography fontWeight={700} variant="body2">
      {value}
    </Typography>
  </Box>
);
