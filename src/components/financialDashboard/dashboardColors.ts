import type { ThemeSummary } from "@/types/finance";

export const financeColors = {
  income: "#15803d",
  incomeSoft: "rgba(21, 128, 61, 0.1)",
  planned: "#b45309",
  plannedSoft: "rgba(180, 83, 9, 0.11)",
  unexpected: "#b91c1c",
  unexpectedSoft: "rgba(185, 28, 28, 0.1)",
};

export const expenseHealthColors = {
  critical: {
    border: "#b91c1c",
    main: "#b91c1c",
    soft: "rgba(185, 28, 28, 0.1)",
  },
  ok: {
    border: "#15803d",
    main: "#15803d",
    soft: "rgba(21, 128, 61, 0.1)",
  },
  over: {
    border: "#b45309",
    main: "#b45309",
    soft: "rgba(180, 83, 9, 0.11)",
  },
};

export type ExpenseHealth = "ok" | "over" | "critical";

export const getExpenseHealth = (summary: ThemeSummary): ExpenseHealth => {
  if (summary.recommended_cents <= 0) {
    return summary.total_cents > 0 ? "critical" : "ok";
  }

  const usage = summary.total_cents / summary.recommended_cents;

  if (usage > 1.2) {
    return "critical";
  }

  if (usage > 1) {
    return "over";
  }

  return "ok";
};
