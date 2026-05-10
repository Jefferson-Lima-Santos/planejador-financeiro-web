import { Alert, Box, Card, CardContent, Skeleton, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { tokens } from "@/locales/tokens";
import type { ThemeSummary } from "@/types/finance";
import { centsToCurrency } from "@/utils/money";
import { expenseHealthColors, getExpenseHealth } from "./dashboardColors";

type ExpenseChartsSectionProps = {
  isLoading: boolean;
  themeSummaries: ThemeSummary[];
};

export const ExpenseChartsSection = ({
  isLoading,
  themeSummaries,
}: ExpenseChartsSectionProps) => {
  const { t } = useTranslation();
  const totalSpent = themeSummaries.reduce((sum, summary) => sum + summary.total_cents, 0);
  const spentData = themeSummaries
    .filter((summary) => summary.total_cents > 0)
    .map((summary) => ({
      color: expenseHealthColors[getExpenseHealth(summary)].main,
      name: summary.name,
      percentage: totalSpent > 0 ? Math.round((summary.total_cents / totalSpent) * 100) : 0,
      value: summary.total_cents,
    }));
  const usageData = themeSummaries.map((summary) => ({
    color: expenseHealthColors[getExpenseHealth(summary)].main,
    name: summary.name,
    usage:
      summary.recommended_cents > 0
        ? Math.round((summary.total_cents / summary.recommended_cents) * 100)
        : summary.total_cents > 0
        ? 130
        : 0,
  }));

  if (isLoading) {
    return (
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
        }}
      >
        <Skeleton height={320} sx={{ borderRadius: 1 }} variant="rectangular" />
        <Skeleton height={320} sx={{ borderRadius: 1 }} variant="rectangular" />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
      }}
    >
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h3">{t(tokens.dashboard.expenseDistributionTitle)}</Typography>
              <Typography color="text.secondary" variant="body2">
                {t(tokens.dashboard.expenseDistributionSubtitle)}
              </Typography>
            </Box>
            {spentData.length === 0 ? (
              <Alert severity="info">{t(tokens.dashboard.comparisonEmpty)}</Alert>
            ) : (
              <Box
                sx={{
                  alignItems: "center",
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", md: "minmax(220px, 0.85fr) 1fr" },
                }}
              >
                <Box sx={{ height: 260, minWidth: 0 }}>
                  <ResponsiveContainer height="100%" width="100%">
                    <PieChart>
                      <Pie
                        cx="50%"
                        cy="50%"
                        data={spentData}
                        dataKey="value"
                        innerRadius={62}
                        nameKey="name"
                        outerRadius={96}
                        paddingAngle={2}
                      >
                        {spentData.map((entry) => (
                          <Cell fill={entry.color} key={entry.name} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(value, _name, item) => {
                          const payload = item.payload as { percentage?: number };

                          return [
                            `${centsToCurrency(Number(value))} (${payload.percentage ?? 0}%)`,
                            t(tokens.dashboard.themeSpent),
                          ];
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
                <Stack spacing={1.25}>
                  {spentData.map((entry) => (
                    <Stack
                      alignItems="center"
                      direction="row"
                      key={entry.name}
                      spacing={1}
                      sx={{ borderBottom: "1px solid", borderColor: "divider", pb: 1 }}
                    >
                      <Box
                        sx={{
                          bgcolor: entry.color,
                          borderRadius: "50%",
                          flexShrink: 0,
                          height: 10,
                          width: 10,
                        }}
                      />
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography fontWeight={800} noWrap variant="body2">
                          {entry.name}
                        </Typography>
                        <Typography color="text.secondary" variant="caption">
                          {entry.percentage}% {t(tokens.dashboard.themeSpent).toLowerCase()}
                        </Typography>
                      </Box>
                      <Typography fontWeight={800} variant="body2">
                        {centsToCurrency(entry.value)}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h3">{t(tokens.dashboard.expenseLimitTitle)}</Typography>
              <Typography color="text.secondary" variant="body2">
                {t(tokens.dashboard.expenseLimitSubtitle)}
              </Typography>
            </Box>
            <Box sx={{ height: 260 }}>
              <ResponsiveContainer height="100%" width="100%">
                <BarChart data={usageData} margin={{ bottom: 18, left: -24, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" interval={0} tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => `${value}%`}
                    tickLine={false}
                  />
                  <RechartsTooltip formatter={(value) => `${value}%`} />
                  <Bar dataKey="usage" radius={[6, 6, 0, 0]}>
                    {usageData.map((entry) => (
                      <Cell fill={entry.color} key={entry.name} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};
