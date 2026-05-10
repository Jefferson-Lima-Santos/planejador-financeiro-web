import {
  Alert,
  Avatar,
  Box,
  Card,
  CardContent,
  LinearProgress,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { FlagOutlined } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { tokens } from "@/locales/tokens";
import type { Goal } from "@/types/finance";
import { centsToCurrency } from "@/utils/money";

type GoalsSectionProps = {
  goals: Goal[];
  isLoading: boolean;
};

export const GoalsSection = ({ goals, isLoading }: GoalsSectionProps) => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
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

          {isLoading ? (
            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
              }}
            >
              {Array.from({ length: 3 }).map((_, index) => (
                <Card key={index} variant="outlined">
                  <CardContent sx={{ "&:last-child": { pb: 2 } }}>
                    <Stack spacing={1}>
                      <Skeleton height={22} width="72%" />
                      <Skeleton height={30} width="52%" />
                      <Skeleton height={8} sx={{ borderRadius: 999 }} variant="rectangular" />
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Box>
          ) : goals.length === 0 ? (
            <Alert severity="info">{t(tokens.dashboard.goalsEmpty)}</Alert>
          ) : (
            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
              }}
            >
              {goals.map((goal) => {
                const progress =
                  goal.target_value_cents > 0
                    ? Math.min((goal.current_value_cents / goal.target_value_cents) * 100, 100)
                    : 0;

                return (
                  <Card key={goal.id} variant="outlined">
                    <CardContent sx={{ "&:last-child": { pb: 2 } }}>
                      <Stack spacing={1}>
                        <Typography fontWeight={800}>{goal.name}</Typography>
                        <Typography color="primary.main" variant="h3">
                          {centsToCurrency(goal.current_value_cents)}
                        </Typography>
                        <LinearProgress value={progress} variant="determinate" />
                        <Stack direction="row" justifyContent="space-between">
                          <Typography color="text.secondary" variant="caption">
                            {Math.round(progress)}%
                          </Typography>
                          <Typography color="text.secondary" variant="caption">
                            {centsToCurrency(goal.target_value_cents)}
                          </Typography>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};
