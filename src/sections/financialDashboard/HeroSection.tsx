import dayjs, { Dayjs } from "dayjs";
import {
  ArrowBackIosNewOutlined,
  ArrowForwardIosOutlined,
  CalendarMonthOutlined,
  ReplayOutlined,
} from "@mui/icons-material";
import { Box, Button, Card, CardContent, Chip, IconButton, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { tokens } from "@/locales/tokens";

type HeroSectionProps = {
  currentMonth: Dayjs;
  isCurrentMonth: boolean;
  isLoading: boolean;
  isMonthTransitioning: boolean;
  onChangeMonth: (month: Dayjs) => void;
};

export function HeroSection({
  currentMonth,
  isCurrentMonth,
  isLoading,
  isMonthTransitioning,
  onChangeMonth,
}: HeroSectionProps) {
  const { t } = useTranslation();
  const controlsDisabled = isLoading || isMonthTransitioning;

  return (
    <Card
      sx={{
        background: "linear-gradient(135deg, #1f2f55 0%, #5f8df7 100%)",
        color: "common.white",
        overflow: "hidden",
      }}
    >
      <CardContent sx={{ p: { xs: 2.5, md: 4 }, "&:last-child": { pb: { xs: 2.5, md: 4 } } }}>
        <Stack
          alignItems={{ xs: "stretch", sm: "center" }}
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          spacing={3}
        >
          <Box>
            <Typography fontWeight={700} sx={{ opacity: 0.82 }} variant="body2">
              {t(tokens.dashboard.financialOverview)}
            </Typography>
            <Typography sx={{ mt: 0.5 }} variant="h1">
              {t(tokens.dashboard.monthBudget)}
            </Typography>
            <Typography sx={{ mt: 1, opacity: 0.88 }} variant="h3">
              {currentMonth.format("MMMM [de] YYYY")}
            </Typography>
          </Box>

          <Stack alignItems={{ xs: "stretch", sm: "flex-end" }} spacing={1.25}>
            <Box
              sx={{
                alignItems: "center",
                bgcolor: "rgba(255, 255, 255, 0.14)",
                border: "1px solid rgba(255, 255, 255, 0.22)",
                borderRadius: 2,
                display: "grid",
                gap: 0.75,
                gridTemplateColumns: "auto minmax(0, 1fr) auto",
                p: 0.75,
              }}
            >
              <IconButton
                aria-label={t(tokens.dashboard.previousMonth)}
                disabled={controlsDisabled}
                onClick={() => onChangeMonth(currentMonth.subtract(1, "month"))}
                sx={{ color: "common.white" }}
              >
                <ArrowBackIosNewOutlined fontSize="small" />
              </IconButton>
              <Stack alignItems="center" spacing={0.25} sx={{ minWidth: { xs: 0, sm: 170 } }}>
                <CalendarMonthOutlined fontSize="small" />
                <Typography fontWeight={800} noWrap>
                  {currentMonth.format("MMMM YYYY")}
                </Typography>
              </Stack>
              <IconButton
                aria-label={t(tokens.dashboard.nextMonth)}
                disabled={controlsDisabled}
                onClick={() => onChangeMonth(currentMonth.add(1, "month"))}
                sx={{ color: "common.white" }}
              >
                <ArrowForwardIosOutlined fontSize="small" />
              </IconButton>
            </Box>

            {isCurrentMonth ? (
              <Chip
                color="default"
                label={t(tokens.dashboard.currentMonthBadge)}
                sx={{
                  alignSelf: { xs: "stretch", sm: "flex-end" },
                  bgcolor: "rgba(255, 255, 255, 0.18)",
                  color: "common.white",
                  fontWeight: 700,
                }}
              />
            ) : (
              <Button
                color="inherit"
                disabled={controlsDisabled}
                onClick={() => onChangeMonth(dayjs().startOf("month"))}
                startIcon={<ReplayOutlined />}
                sx={{
                  alignSelf: { xs: "stretch", sm: "flex-end" },
                  bgcolor: "rgba(255, 255, 255, 0.18)",
                  color: "common.white",
                  "&:hover": { bgcolor: "rgba(255, 255, 255, 0.26)" },
                }}
                variant="contained"
              >
                {t(tokens.dashboard.backToCurrentMonth)}
              </Button>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
