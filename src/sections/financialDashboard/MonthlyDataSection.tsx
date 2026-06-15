import { Alert, Skeleton, Stack } from "@mui/material";
import { Dayjs } from "dayjs";
import { useTranslation } from "react-i18next";
import { AnimatedMonthSection } from "@/components/financialDashboard/AnimatedMonthSection";
import { GoalsSection } from "@/components/financialDashboard/GoalsSection";
import { MonthlyComparisonChart } from "@/components/financialDashboard/MonthlyComparisonChart";
import { tokens } from "@/locales/tokens";
import type { Goal, GoalInvestment, MonthlyComparison } from "@/types/finance";

type DashboardTotals = {
  balance: number;
  income: number;
  planned: number;
  spent: number;
  unexpected: number;
};

type MonthlyDataSectionProps = {
  animationSx: object;
  comparisons: MonthlyComparison[];
  currentMonth: Dayjs;
  goals: Goal[];
  isLoading: boolean;
  onAddGoal: () => void;
  onContributionAction: (goal: Goal, investment: GoalInvestment, status: "confirmed" | "skipped") => void;
  onEditGoal: (goal: Goal) => void;
  isSaving?: boolean;
  totals: DashboardTotals;
};

export const MonthlyDataSection = ({
  animationSx,
  comparisons,
  currentMonth,
  goals,
  isLoading,
  onAddGoal,
  onContributionAction,
  onEditGoal,
  isSaving,
  totals,
}: MonthlyDataSectionProps) => {
  const { t } = useTranslation();

  return (
    <AnimatedMonthSection animationSx={animationSx} sectionKey={`monthly-data-${currentMonth.format("YYYY-MM")}`}>
      <Stack spacing={3}>
        <MonthlyComparisonChart data={comparisons} isLoading={isLoading} />

        {isLoading ? (
          <Skeleton height={48} sx={{ borderRadius: 2 }} variant="rectangular" />
        ) : totals.balance < 0 ? (
          <Alert severity="error">{t(tokens.dashboard.statusOver)}</Alert>
        ) : (
          <Alert severity="success">{t(tokens.dashboard.statusOk)}</Alert>
        )}

        <GoalsSection
          goals={goals}
          isLoading={isLoading}
          onAddGoal={onAddGoal}
          onContributionAction={onContributionAction}
          onEditGoal={onEditGoal}
          isSaving={isSaving}
        />
      </Stack>
    </AnimatedMonthSection>
  );
};
