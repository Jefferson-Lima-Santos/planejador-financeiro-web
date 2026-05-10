import { Box, Card, CardContent, Skeleton, Typography } from "@mui/material";
import { Dayjs } from "dayjs";
import { useTranslation } from "react-i18next";
import { AnimatedMonthSection } from "@/components/financialDashboard/AnimatedMonthSection";
import { SummaryActionCard } from "@/components/financialDashboard/SummaryActionCard";
import { tokens } from "@/locales/tokens";
import { centsToCurrency } from "@/utils/money";

type DashboardTotals = {
  balance: number;
  income: number;
  planned: number;
  spent: number;
  unexpected: number;
};

type SummarySectionProps = {
  activeIncomeCount: number;
  animationSx: object;
  currentMonth: Dayjs;
  isLoading: boolean;
  onOpenIncome: () => void;
  onScrollToExpenses: () => void;
  totals: DashboardTotals;
};

export function SummarySection({
  activeIncomeCount,
  animationSx,
  currentMonth,
  isLoading,
  onOpenIncome,
  onScrollToExpenses,
  totals,
}: SummarySectionProps) {
  const { t } = useTranslation();

  return (
    <AnimatedMonthSection animationSx={animationSx} sectionKey={`summary-${currentMonth.format("YYYY-MM")}`}>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
        }}
      >
        <SummaryActionCard
          actionLabel={t(tokens.common.manage)}
          detail={t(tokens.dashboard.incomeActiveCount, { count: activeIncomeCount })}
          isLoading={isLoading}
          label={t(tokens.dashboard.income)}
          onAction={onOpenIncome}
          value={centsToCurrency(totals.income)}
          valueColor="text.primary"
        />
        <SummaryActionCard
          actionLabel={t(tokens.common.manage)}
          detail={t(tokens.dashboard.expensesByThemeSubtitle)}
          isLoading={isLoading}
          label={t(tokens.dashboard.spent)}
          onAction={onScrollToExpenses}
          value={centsToCurrency(totals.spent)}
          valueColor={totals.spent > totals.income ? "error.main" : "text.primary"}
        />
        <Card>
          <CardContent>
            <Typography color="text.secondary">{t(tokens.dashboard.balance)}</Typography>
            {isLoading ? (
              <Skeleton height={38} sx={{ mt: 0.5 }} width="58%" />
            ) : (
              <Typography color={totals.balance < 0 ? "error.main" : "success.main"} variant="h2">
                {centsToCurrency(totals.balance)}
              </Typography>
            )}
          </CardContent>
        </Card>
      </Box>
    </AnimatedMonthSection>
  );
}
