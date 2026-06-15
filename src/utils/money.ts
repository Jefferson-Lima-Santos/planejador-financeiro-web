export const centsToCurrency = (value: number): string =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);

export const currencyInputToCents = (value: string): number => {
  const digits = value.replace(/\D/g, "");

  if (!digits) {
    return 0;
  }

  return Number(digits);
};

export const centsToInputValue = (value: number): string =>
  (value / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const formatCurrencyInput = (value: string): string => {
  const digits = value.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  const cents = Number(digits);

  return centsToInputValue(cents);
};

export const basisPointsToPercentage = (value: number): string =>
  `${(value / 100).toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  })}%`;
