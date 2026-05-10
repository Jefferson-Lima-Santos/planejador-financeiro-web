import { KeyboardEvent } from "react";
import { Box, Card, CardContent, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { tokens } from "@/locales/tokens";
import type { ThemeSummary } from "@/types/finance";
import { basisPointsToPercentage, centsToCurrency } from "@/utils/money";
import { expenseHealthColors, getExpenseHealth } from "./dashboardColors";

type ThemeSummaryCardProps = {
  onOpen: () => void;
  summary: ThemeSummary;
};

export function ThemeSummaryCard({ onOpen, summary }: ThemeSummaryCardProps) {
  const { t } = useTranslation();
  const progress =
    summary.recommended_cents > 0
      ? Math.min((summary.total_cents / summary.recommended_cents) * 100, 100)
      : 0;
  const health = getExpenseHealth(summary);
  const healthColors = expenseHealthColors[health];
  const healthLabel = {
    critical: t(tokens.dashboard.expenseStatusCritical),
    ok: t(tokens.dashboard.expenseStatusOk),
    over: t(tokens.dashboard.expenseStatusOver),
  }[health];

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      sx={{
        borderLeft: "4px solid",
        borderLeftColor: healthColors.border,
        bgcolor: healthColors.soft,
        cursor: "pointer",
        transition: "transform 160ms ease, box-shadow 160ms ease",
        "&:hover": {
          boxShadow: "0 18px 42px rgba(15, 23, 42, 0.12)",
          transform: "translateY(-2px)",
        },
      }}
    >
      <CardContent>
        <Stack spacing={2}>
          <Stack alignItems="flex-start" direction="row" justifyContent="space-between" spacing={2}>
            <Box sx={{ minWidth: 0 }}>
              <Typography fontWeight={800}>{summary.name}</Typography>
              <Typography color="text.secondary" variant="body2">
                {basisPointsToPercentage(summary.default_percentage_bp)}{" "}
                {t(tokens.dashboard.themeRecommended)}
              </Typography>
            </Box>
            <Chip
              label={healthLabel}
              size="small"
              sx={{
                bgcolor: healthColors.main,
                color: "common.white",
                flexShrink: 0,
                fontWeight: 800,
              }}
            />
          </Stack>

          <Box>
            <Typography color="text.secondary" variant="body2">
              {t(tokens.dashboard.spent)}
            </Typography>
            <Typography color={healthColors.main} variant="h2">
              {centsToCurrency(summary.total_cents)}
            </Typography>
          </Box>

          <LinearProgress
            sx={{
              bgcolor: "rgba(15, 23, 42, 0.12)",
              "& .MuiLinearProgress-bar": { bgcolor: healthColors.main },
            }}
            value={progress}
            variant="determinate"
          />

          <Stack direction="row" justifyContent="space-between" spacing={1}>
            <Typography color="text.secondary" variant="caption">
              {basisPointsToPercentage(summary.spent_percentage_bp)}
            </Typography>
            <Typography color="text.secondary" variant="caption">
              {t(tokens.dashboard.themeRecommended)} {centsToCurrency(summary.recommended_cents)}
            </Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
