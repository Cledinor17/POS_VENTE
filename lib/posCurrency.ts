import { convertAmount, normalizeCurrency, type ExchangeConfig } from "./currency";

type PricedLine = { price: number; currency?: string; discountType?: "percent" | "fixed" | null; discountValue?: number; discountCurrency?: string };

export function pricePosCart<T extends PricedLine>(source: T[], paymentCurrency: string, businessCurrency: string, config: ExchangeConfig) {
  const currencies = [...new Set(source.map(item => normalizeCurrency(item.currency, "HTG")))];
  // A mixed POS basket is priced directly in the chosen payment currency.
  // Converting via HTG and back to USD would charge the spread twice.
  const currency = currencies.length === 1 ? currencies[0] : normalizeCurrency(paymentCurrency, normalizeCurrency(businessCurrency));
  return { currency, items: source.map(item => ({
    ...item,
    price: convertAmount(item.price, item.currency || "HTG", currency, config),
    discountValue: item.discountType === "fixed"
      ? convertAmount(item.discountValue ?? 0, item.discountCurrency || item.currency || "HTG", currency, config)
      : item.discountValue,
  })) };
}
