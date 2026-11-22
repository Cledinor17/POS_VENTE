import type { UnpostedDepositMemo } from "./posDepositMemosApi";

export function parseDepositAmount(input: string): string | null {
  const normalized = input.trim().replace(",", ".");
  if (!/^(?:0|[1-9][0-9]{0,8})(?:\.[0-9]{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0.01 && amount <= 999999999.99
    ? amount.toFixed(2) : null;
}

export function depositTotalsForCart(memos: UnpostedDepositMemo[], cartReference: string) {
  const totals = { HTG: 0, USD: 0 };
  for (const memo of memos) {
    if (memo.cart_reference !== cartReference || !["HTG", "USD"].includes(memo.currency)) continue;
    const value = Number(memo.amount);
    if (Number.isFinite(value) && value >= 0) totals[memo.currency] += value;
  }
  return totals;
}
