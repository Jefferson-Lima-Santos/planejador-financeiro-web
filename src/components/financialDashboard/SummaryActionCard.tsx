import { KeyboardEvent } from "react";
import { Box, Card, CardContent, Skeleton, Stack, Typography } from "@mui/material";

type SummaryActionCardProps = {
  actionLabel: string;
  detail: string;
  isLoading: boolean;
  label: string;
  onAction: () => void;
  value: string;
  valueColor: string;
};

export const SummaryActionCard = ({
  actionLabel,
  detail,
  isLoading,
  label,
  onAction,
  value,
  valueColor,
}: SummaryActionCardProps) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isLoading) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onAction();
    }
  };

  return (
    <Card
      aria-disabled={isLoading}
      onClick={isLoading ? undefined : onAction}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={isLoading ? -1 : 0}
      sx={{
        cursor: isLoading ? "default" : "pointer",
        transition: "box-shadow 160ms ease, transform 160ms ease",
        "&:hover": isLoading
          ? undefined
          : {
              boxShadow: "0 18px 42px rgba(15, 23, 42, 0.12)",
              transform: "translateY(-2px)",
            },
        "&:focus-visible": {
          outline: "3px solid rgba(37, 99, 235, 0.34)",
          outlineOffset: 2,
        },
      }}
    >
      <CardContent sx={{ minHeight: 132 }}>
        <Stack spacing={1} sx={{ height: "100%" }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography color="text.secondary">{label}</Typography>
            {isLoading ? (
              <Skeleton height={38} sx={{ mt: 0.5 }} width={150} />
            ) : (
              <Typography color={valueColor} variant="h2">
                {value}
              </Typography>
            )}
            <Typography color="text.secondary" variant="body2">
              {isLoading ? <Skeleton width={120} /> : detail}
            </Typography>
          </Box>
          <Typography
            color={isLoading ? "text.disabled" : "primary.main"}
            fontWeight={800}
            sx={{
              alignSelf: "flex-end",
              textDecoration: "underline",
              textUnderlineOffset: "4px",
            }}
            variant="body2"
          >
            {actionLabel}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
};
