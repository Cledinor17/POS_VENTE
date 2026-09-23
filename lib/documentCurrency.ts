import { convertAmount, normalizeCurrency, type ExchangeConfig, type SupportedCurrency } from "./currency";

export type DocumentCurrencySettings = ExchangeConfig & { currency: SupportedCurrency };

export type DocumentDraftItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  currency?: string;
};

export function calculateDocumentAmounts(items: DocumentDraftItem[], settings: DocumentCurrencySettings) {
  const currencies = [...new Set(items.filter((item) => item.name.trim()).map((item) =>
    normalizeCurrency(item.currency, settings.currency),
  ))];
  const currency = currencies.length === 1 ? currencies[0] : settings.currency;
  const amounts = items.map((item) => {
    const sourceCurrency = normalizeCurrency(item.currency, settings.currency);
    const unitPrice = convertAmount(item.unitPrice, sourceCurrency, currency, settings);
    const subtotal = item.quantity * unitPrice;
    const tax = subtotal * item.taxRate / 100;
    return { sourceCurrency, unitPrice, subtotal, tax, total: subtotal + tax };
  });
  const totals = amounts.reduce((sum, amount, index) => {
    if (!items[index].name.trim()) return sum;
    return { subtotal: sum.subtotal + amount.subtotal, tax: sum.tax + amount.tax, total: sum.total + amount.total };
  }, { subtotal: 0, tax: 0, total: 0 });

  return { currency, mixedCurrencies: currencies.length > 1, amounts, ...totals };
}
