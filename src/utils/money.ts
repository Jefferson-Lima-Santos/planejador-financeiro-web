export const centsToCurrency = (value: number): string =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);

export const currencyInputToCents = (value: string): number => {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);

  if (Number.isNaN(parsed)) {
    return 0;
  }

  return Math.round(parsed * 100);
};

export const centsToInputValue = (value: number): string =>
  (value / 100).toFixed(2).replace(".", ",");

export const basisPointsToPercentage = (value: number): string =>
  `${(value / 100).toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  })}%`;
