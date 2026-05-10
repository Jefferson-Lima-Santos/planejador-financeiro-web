import { Box, Card, CardContent, Skeleton, Stack } from "@mui/material";

export const ThemeSummarySkeleton = () => {
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" spacing={2}>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Skeleton height={24} width="62%" />
              <Skeleton height={18} width="82%" />
            </Box>
            <Skeleton height={24} sx={{ borderRadius: 4 }} width={54} />
          </Stack>
          <Box>
            <Skeleton height={18} width="24%" />
            <Skeleton height={34} width="48%" />
          </Box>
          <Skeleton height={8} sx={{ borderRadius: 999 }} variant="rectangular" />
          <Stack direction="row" justifyContent="space-between">
            <Skeleton height={18} width="32%" />
            <Skeleton height={18} width="28%" />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};
