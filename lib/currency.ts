export const USD = "USD";
export const HTG = "HTG";
export type SupportedCurrency = typeof USD | typeof HTG;

export type ExchangeConfig = {
  exchangeRateDirection?: string;
  exchangeRateValue?: number;
  exchangeBuyRate?: number;
  exchangeSellRate?: number;
};

export function normalizeCurrency(
  currency: string | null | undefined,
  fallback: SupportedCurrency = USD
): SupportedCurrency {
  const value = String(currency || "").trim().toUpperCase();
  return value === HTG || value === USD ? value : fallback;
}

export function getUsdToHtgRate(config?: ExchangeConfig | null): number {
  if (Number(config?.exchangeSellRate) > 0) return Number(config?.exchangeSellRate);
  const direction = String(config?.exchangeRateDirection || "usd_to_htg").trim().toLowerCase();
  const rawValue = Number(config?.exchangeRateValue || 1);
  const value = Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 1;

  if (direction === "htg_to_usd") {
    return value > 0 ? Number((1 / value).toFixed(6)) : 1;
  }

  return Number(value.toFixed(6));
}

export function getExchangeRate(
  fromCurrency: string | null | undefined,
  toCurrency: string | null | undefined,
  config?: ExchangeConfig | null
): number {
  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);
  if (from === to) return 1;

  const usdToHtg = getUsdToHtgRate(config);
  if (from === USD && to === HTG) return usdToHtg;
  if (from === HTG && to === USD) return 1 / getBuyRate(config);
  return 1;
}

export function getBuyRate(config?: ExchangeConfig | null): number {
  return Number(config?.exchangeBuyRate) > 0 ? Number(config?.exchangeBuyRate) : getUsdToHtgRate(config);
}

export function convertPayment(amount: number, paymentCurrency: string, invoiceCurrency: string, config?: ExchangeConfig | null): number {
  return Number((amount / getExchangeRate(invoiceCurrency, paymentCurrency, config)).toFixed(2));
}

export function convertAmount(
  amount: number,
  fromCurrency: string | null | undefined,
  toCurrency: string | null | undefined,
  config?: ExchangeConfig | null
): number {
  const value = Number.isFinite(amount) ? amount : 0;
  const rate = getExchangeRate(fromCurrency, toCurrency, config);
  return Number((value * rate).toFixed(2));
}

export function formatMoney(amount: number, currency: string | null | undefined): string {
  const normalizedCurrency = normalizeCurrency(currency);
  const value = Number.isFinite(amount) ? amount : 0;

  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: normalizedCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${normalizedCurrency}`;
  }
}

export function formatExchangeRateSummary(config?: ExchangeConfig | null): string {
  const usdToHtg = getUsdToHtgRate(config);
  return `1 USD : achat ${getBuyRate(config).toFixed(2)} HTG · vente ${usdToHtg.toFixed(2)} HTG`;
}
