import { apiFetch, apiFetchBlob } from "./api";

type Dict = Record<string, unknown>;

function asRecord(value: unknown): Dict {
  return value && typeof value === "object" ? (value as Dict) : {};
}

function toString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function buildReportPath(business: string, input?: { date?: string }) {
  const params = new URLSearchParams();
  if (input?.date) params.set("date", input.date);
  const suffix = params.toString();
  return `/api/app/${encodeURIComponent(business)}/me/daily-report${suffix ? `?${suffix}` : ""}`;
}

function buildReportPdfPath(business: string, input?: { date?: string }) {
  const params = new URLSearchParams();
  if (input?.date) params.set("date", input.date);
  const suffix = params.toString();
  return `/api/app/${encodeURIComponent(business)}/me/daily-report.pdf${suffix ? `?${suffix}` : ""}`;
}

export type DailyReportSaleItem = {
  id: string;
  type: string;
  label: string;
  reference: string;
  counterparty: string;
  amount: number;
  status: string;
  paymentMethod: string | null;
  occurredAt: string;
  source: string;
  note: string;
};

export type DailyReportReceiptItem = {
  id: string;
  type: string;
  label: string;
  reference: string;
  counterparty: string;
  amount: number;
  paymentMethod: string | null;
  occurredAt: string;
  source: string;
  note: string;
};

export type DailyReportClosure = {
  isClosed: boolean;
  reportDate: string;
  expectedCashAmount: number;
  expectedCashAmountByCurrency: Record<string, number>;
  currentExpectedCashAmount: number;
  currentExpectedCashAmountByCurrency: Record<string, number>;
  submittedCashAmount: number | null;
  submittedCashAmountByCurrency: Record<string, number> | null;
  differenceAmount: number | null;
  differenceAmountByCurrency: Record<string, number> | null;
  notes: string;
  submittedAt: string | null;
};

export type CurrentUserDailyReport = {
  date: string;
  timezone: string;
  currency: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
  summary: {
    salesCount: number;
    salesTotal: number;
    receiptsCount: number;
    receiptsTotal: number;
    cashToSubmit: number;
    cashToSubmitByCurrency: Record<string, number>;
    nonCashTotal: number;
  };
  paymentMethods: Record<string, number>;
  closure: DailyReportClosure;
  sales: DailyReportSaleItem[];
  receipts: DailyReportReceiptItem[];
};

export type SaveCurrentUserDailyClosureInput = {
  date: string;
  submittedCashAmountByCurrency: Record<string, number>;
  notes?: string;
};

function normalizeCurrencyBreakdown(raw: unknown): Record<string, number> {
  const obj = asRecord(raw);
  return {
    HTG: toNumber(obj.HTG, 0),
    USD: toNumber(obj.USD, 0),
  };
}

function normalizeNullableCurrencyBreakdown(raw: unknown): Record<string, number> | null {
  if (raw === null || raw === undefined) return null;
  return normalizeCurrencyBreakdown(raw);
}

function normalizeItem(raw: unknown): DailyReportSaleItem {
  const obj = asRecord(raw);
  return {
    id: toString(obj.id),
    type: toString(obj.type),
    label: toString(obj.label),
    reference: toString(obj.reference),
    counterparty: toString(obj.counterparty),
    amount: toNumber(obj.amount, 0),
    status: toString(obj.status),
    paymentMethod: toString(obj.payment_method, "") || null,
    occurredAt: toString(obj.occurred_at),
    source: toString(obj.source),
    note: toString(obj.note),
  };
}

function normalizeReceipt(raw: unknown): DailyReportReceiptItem {
  const obj = asRecord(raw);
  return {
    id: toString(obj.id),
    type: toString(obj.type),
    label: toString(obj.label),
    reference: toString(obj.reference),
    counterparty: toString(obj.counterparty),
    amount: toNumber(obj.amount, 0),
    paymentMethod: toString(obj.payment_method, "") || null,
    occurredAt: toString(obj.occurred_at),
    source: toString(obj.source),
    note: toString(obj.note),
  };
}

function normalizeClosure(raw: unknown, fallbackDate: string, fallbackExpected: number): DailyReportClosure {
  const obj = asRecord(raw);
  return {
    isClosed: Boolean(obj.is_closed),
    reportDate: toString(obj.report_date, fallbackDate),
    expectedCashAmount: toNumber(obj.expected_cash_amount, fallbackExpected),
    expectedCashAmountByCurrency: normalizeCurrencyBreakdown(obj.expected_cash_amount_by_currency),
    currentExpectedCashAmount: toNumber(obj.current_expected_cash_amount, fallbackExpected),
    currentExpectedCashAmountByCurrency: normalizeCurrencyBreakdown(obj.current_expected_cash_amount_by_currency),
    submittedCashAmount:
      obj.submitted_cash_amount === null || obj.submitted_cash_amount === undefined
        ? null
        : toNumber(obj.submitted_cash_amount, 0),
    submittedCashAmountByCurrency: normalizeNullableCurrencyBreakdown(obj.submitted_cash_amount_by_currency),
    differenceAmount:
      obj.difference_amount === null || obj.difference_amount === undefined
        ? null
        : toNumber(obj.difference_amount, 0),
    differenceAmountByCurrency: normalizeNullableCurrencyBreakdown(obj.difference_amount_by_currency),
    notes: toString(obj.notes),
    submittedAt: toString(obj.submitted_at, "") || null,
  };
}

function normalizeReport(raw: unknown): CurrentUserDailyReport {
  const obj = asRecord(raw);
  const user = asRecord(obj.user);
  const summary = asRecord(obj.summary);
  const paymentMethodsRaw = asRecord(obj.payment_methods);
  const paymentMethods: Record<string, number> = {};

  Object.entries(paymentMethodsRaw).forEach(([key, value]) => {
    paymentMethods[key] = toNumber(value, 0);
  });

  const normalizedSummary = {
    salesCount: toNumber(summary.sales_count, 0),
    salesTotal: toNumber(summary.sales_total, 0),
    receiptsCount: toNumber(summary.receipts_count, 0),
    receiptsTotal: toNumber(summary.receipts_total, 0),
    cashToSubmit: toNumber(summary.cash_to_submit, 0),
    cashToSubmitByCurrency: {
      HTG: toNumber(asRecord(summary.cash_to_submit_by_currency).HTG, 0),
      USD: toNumber(asRecord(summary.cash_to_submit_by_currency).USD, 0),
    },
    nonCashTotal: toNumber(summary.non_cash_total, 0),
  };

  return {
    date: toString(obj.date),
    timezone: toString(obj.timezone),
    currency: toString(obj.currency, "USD"),
    user: {
      id: toNumber(user.id, 0),
      name: toString(user.name),
      email: toString(user.email),
    },
    summary: normalizedSummary,
    paymentMethods,
    closure: normalizeClosure(obj.closure, toString(obj.date), normalizedSummary.cashToSubmit),
    sales: Array.isArray(obj.sales) ? obj.sales.map(normalizeItem) : [],
    receipts: Array.isArray(obj.receipts) ? obj.receipts.map(normalizeReceipt) : [],
  };
}

export async function getCurrentUserDailyReport(
  business: string,
  input?: { date?: string }
): Promise<CurrentUserDailyReport> {
  const raw = await apiFetch<unknown>(buildReportPath(business, input));
  return normalizeReport(raw);
}

export async function saveCurrentUserDailyClosure(
  business: string,
  input: SaveCurrentUserDailyClosureInput
): Promise<CurrentUserDailyReport> {
  const raw = await apiFetch<unknown>(
    `/api/app/${encodeURIComponent(business)}/me/daily-report/closure`,
    {
      method: "POST",
      json: {
        date: input.date,
        submitted_cash_amount_by_currency: input.submittedCashAmountByCurrency,
        notes: input.notes ?? "",
      },
    }
  );

  return normalizeReport(raw);
}

export async function fetchCurrentUserDailyReportPdf(
  business: string,
  input?: { date?: string }
): Promise<Blob> {
  return apiFetchBlob(buildReportPdfPath(business, input));
}
