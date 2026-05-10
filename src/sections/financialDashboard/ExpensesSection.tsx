import { forwardRef } from "react";
import { AddOutlined } from "@mui/icons-material";
import { Box, Button, Stack, Typography } from "@mui/material";
import { Dayjs } from "dayjs";
import { useTranslation } from "react-i18next";
import { AnimatedMonthSection } from "@/components/financialDashboard/AnimatedMonthSection";
import { ExpenseChartsSection } from "@/components/financialDashboard/ExpenseChartsSection";
import { ThemeSummaryCard } from "@/components/financialDashboard/ThemeSummaryCard";
import { ThemeSummarySkeleton } from "@/components/financialDashboard/ThemeSummarySkeleton";
import { tokens } from "@/locales/tokens";
import type { ThemeSummary } from "@/types/finance";

type ExpensesSectionProps = {
  animationSx: object;
  currentMonth: Dayjs;
  isLoading: boolean;
  onAddExpense: () => void;
  onOpenTheme: (summary: ThemeSummary) => void;
  themeSummaries: ThemeSummary[];
};

export const ExpensesSection = forwardRef<HTMLDivElement, ExpensesSectionProps>(function ExpensesSection(
  { animationSx, currentMonth, isLoading, onAddExpense, onOpenTheme, themeSummaries },
  ref
) {
  const { t } = useTranslation();

  return (
    <AnimatedMonthSection animationSx={animationSx} sectionKey={`expenses-${currentMonth.format("YYYY-MM")}`}>
      <Stack ref={ref} spacing={2}>
        <Stack
          alignItems={{ xs: "stretch", sm: "center" }}
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          spacing={1.5}
        >
          <Box>
            <Typography variant="h2">{t(tokens.dashboard.expensesByTheme)}</Typography>
            <Typography color="text.secondary" variant="body2">
              {t(tokens.dashboard.expensesByThemeSubtitle)}
            </Typography>
          </Box>
          <Button
            disabled={isLoading}
            onClick={onAddExpense}
            startIcon={<AddOutlined />}
            variant="contained"
          >
            {t(tokens.dashboard.addExpense)}
          </Button>
        </Stack>

        <ExpenseChartsSection isLoading={isLoading} themeSummaries={themeSummaries} />

        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
          }}
        >
          {isLoading
            ? Array.from({ length: 6 }).map((_, index) => <ThemeSummarySkeleton key={index} />)
            : themeSummaries.map((summary) => (
                <ThemeSummaryCard
                  key={summary.id}
                  onOpen={() => onOpenTheme(summary)}
                  summary={summary}
                />
              ))}
        </Box>
      </Stack>
    </AnimatedMonthSection>
  );
});
