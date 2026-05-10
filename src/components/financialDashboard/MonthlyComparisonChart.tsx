import { Box, Card, CardContent, Skeleton, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { tokens } from "@/locales/tokens";
import type { MonthlyComparison } from "@/types/finance";
import { centsToCurrency } from "@/utils/money";
import { financeColors } from "./dashboardColors";

type MonthlyComparisonChartProps = {
  data: MonthlyComparison[];
  isLoading?: boolean;
};

export function MonthlyComparisonChart({ data, isLoading = false }: MonthlyComparisonChartProps) {
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
              <LegendDot color={financeColors.unexpected} label={t(tokens.dashboard.unexpected)} />
            </Stack>
          </Stack>

          {isLoading ? (
            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
              }}
            >
              {Array.from({ length: 3 }).map((_, index) => (
                <Box
                  key={index}
                  sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1.5 }}
                >
                  <Stack spacing={1.25}>
                    <Stack direction="row" justifyContent="space-between">
                      <Skeleton height={20} width="34%" />
                      <Skeleton height={20} width="28%" />
                    </Stack>
                    <Skeleton height={26} />
                    <Skeleton height={26} />
                    <Skeleton height={26} />
                  </Stack>
                </Box>
              ))}
            </Box>
          ) : data.length === 0 ? (
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
                  sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1.5 }}
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
