import { convertAmount, normalizeCurrency, type ExchangeConfig, type SupportedCurrency } from "./currency";
import { pricePosCart } from "./posCurrency";

export type ParkedBalanceItem = {
  price: number;
  qty: number;
  taxRate: number;
  currency?: string;
  discountType?: "percent" | "fixed" | null;
  discountValue?: number;
  discountCurrency?: string;
};

export type ParkedBalance = {
  currency: SupportedCurrency;
  total: number | null;
  deposit: number | null;
  remaining: number | null;
  overpayment: number | null;
};

/**
 * A parked tab stores its line items, not final checkout-level discounts,
 * coupons or exchange-rate snapshots. This is an *indicative* balance only.
 * Never use it as a payment, accounting entry or final invoice balance.
 */
export function calculateParkedBalance(
  items: ParkedBalanceItem[],
  deposits: { HTG: number; USD: number },
  preferredCurrency: SupportedCurrency,
  exchange: ExchangeConfig,
): ParkedBalance {
  const priced = pricePosCart(items, preferredCurrency, preferredCurrency, exchange);
  const currency = normalizeCurrency(priced.currency, preferredCurrency);
  const hasRate = [exchange.exchangeBuyRate, exchange.exchangeSellRate, exchange.exchangeRateValue]
    .some(value => Number.isFinite(Number(value)) && Number(value) > 0);
  const needItemConversion = items.some(item => normalizeCurrency(item.currency, "HTG") !== currency);
  const needDepositConversion = currency === "HTG" ? deposits.USD > 0 : deposits.HTG > 0;

  // Showing a numeric difference with an implicit 1:1 exchange rate would be misleading.
  if (!hasRate && (needItemConversion || needDepositConversion)) {
    return { currency, total: null, deposit: null, remaining: null, overpayment: null };
  }

  const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const total = round(priced.items.reduce((sum, item) => {
    const gross = Math.max(0, item.qty * item.price);
    const discountValue = Math.max(0, item.discountValue ?? 0);
    const discount = item.discountType === "percent"
      ? Math.min(gross, gross * discountValue / 100)
      : item.discountType === "fixed" ? Math.min(gross, discountValue) : 0;
    const tax = gross * Math.max(0, item.taxRate) / 100;
    return sum + gross - discount + tax;
  }, 0));
  const deposit = round(
    currency === "HTG"
      ? deposits.HTG + convertAmount(deposits.USD, "USD", "HTG", exchange)
      : deposits.USD + convertAmount(deposits.HTG, "HTG", "USD", exchange),
  );
  return {
    currency,
    total,
    deposit,
    remaining: round(Math.max(0, total - deposit)),
    overpayment: round(Math.max(0, deposit - total)),
  };
}
