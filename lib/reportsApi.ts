import { apiFetch } from "./api";

type Dict = Record<string, unknown>;

export type TrialBalanceRow = {
  accountId: string;
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
};

export type TrialBalanceResult = {
  rows: TrialBalanceRow[];
  totals: {
    debit: number;
    credit: number;
    balanced: boolean;
  };
};

export type ProfitAndLossRow = {
  accountId: string;
  code: string;
  name: string;
  type: "income" | "expense";
  amount: number;
};

export type ProfitAndLossResult = {
  income: ProfitAndLossRow[];
  expenses: ProfitAndLossRow[];
  totals: {
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
  };
};

export type BalanceSheetRow = {
  accountId: string;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity";
  balance: number;
};

export type BalanceSheetResult = {
  asOf: string;
  assets: BalanceSheetRow[];
  liabilities: BalanceSheetRow[];
  equity: BalanceSheetRow[];
  totals: {
    assets: number;
    liabilities: number;
    equity: number;
    balanced: boolean;
  };
};

export type ArSummaryRow = {
  customerId: string;
  name: string;
  balance: number;
};

export type ArSummaryResult = {
  asOf: string;
  rows: ArSummaryRow[];
  totalAr: number;
};

export type ArAgingInvoice = {
  invoiceId: string;
  number: string;
  customerId: string | null;
  customer: string | null;
  dueDate: string | null;
  balanceDue: number;
  daysPastDue: number;
};

export type ArAgingResult = {
  asOf: string;
  totals: {
    current: number;
    bucket1_30: number;
    bucket31_60: number;
    bucket61_90: number;
    bucket90Plus: number;
  };
  details: {
    current: ArAgingInvoice[];
    bucket1_30: ArAgingInvoice[];
    bucket31_60: ArAgingInvoice[];
    bucket61_90: ArAgingInvoice[];
    bucket90Plus: ArAgingInvoice[];
  };
};

function isObject(value: unknown): value is Dict {
  return typeof value === "object" && value !== null;
}

function toString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "bigint") return value.toString();
  return fallback;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

function toBool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return fallback;
}

function qp(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  return search.toString();
}

function basePath(business: string): string {
  return `/api/app/${encodeURIComponent(business)}/reports`;
}

export async function getTrialBalance(
  business: string,
  params: { from?: string; to?: string; asOf?: string; includeZero?: boolean } = {}
): Promise<TrialBalanceResult> {
  const query = qp({
    from: params.from,
    to: params.to,
    as_of: params.asOf,
    include_zero: params.includeZero ? 1 : undefined,
  });
  const path = `${basePath(business)}/trial-balance${query ? `?${query}` : ""}`;
  const raw = await apiFetch<unknown>(path);
  const obj = isObject(raw) ? raw : {};
  const totalsRaw = isObject(obj.totals) ? obj.totals : {};
  const rowsRaw = Array.isArray(obj.rows) ? obj.rows : [];

  return {
    rows: rowsRaw.map((row) => {
      const r = isObject(row) ? row : {};
      return {
        accountId: toString(r.account_id, ""),
        code: toString(r.code, ""),
        name: toString(r.name, ""),
        type: toString(r.type, ""),
        debit: toNumber(r.debit, 0),
        credit: toNumber(r.credit, 0),
        balance: toNumber(r.balance, 0),
      };
    }),
    totals: {
      debit: toNumber(totalsRaw.debit, 0),
      credit: toNumber(totalsRaw.credit, 0),
      balanced: toBool(totalsRaw.balanced, false),
    },
  };
}

export async function getProfitAndLoss(
  business: string,
  params: { from: string; to: string }
): Promise<ProfitAndLossResult> {
  const query = qp({ from: params.from, to: params.to });
  const path = `${basePath(business)}/profit-loss?${query}`;
  const raw = await apiFetch<unknown>(path);
  const obj = isObject(raw) ? raw : {};
  const incomeRaw = Array.isArray(obj.income) ? obj.income : [];
  const expenseRaw = Array.isArray(obj.expenses) ? obj.expenses : [];
  const totalsRaw = isObject(obj.totals) ? obj.totals : {};

  const normalize = (row: unknown): ProfitAndLossRow => {
    const r = isObject(row) ? row : {};
    return {
      accountId: toString(r.account_id, ""),
      code: toString(r.code, ""),
      name: toString(r.name, ""),
      type: toString(r.type, "income") === "expense" ? "expense" : "income",
      amount: toNumber(r.amount, 0),
    };
  };

  return {
    income: incomeRaw.map(normalize),
    expenses: expenseRaw.map(normalize),
    totals: {
      totalIncome: toNumber(totalsRaw.total_income, 0),
      totalExpenses: toNumber(totalsRaw.total_expenses, 0),
      netProfit: toNumber(totalsRaw.net_profit, 0),
    },
  };
}

export async function getBalanceSheet(
  business: string,
  params: { asOf?: string } = {}
): Promise<BalanceSheetResult> {
  const query = qp({ as_of: params.asOf });
  const path = `${basePath(business)}/balance-sheet${query ? `?${query}` : ""}`;
  const raw = await apiFetch<unknown>(path);
  const obj = isObject(raw) ? raw : {};
  const totalsRaw = isObject(obj.totals) ? obj.totals : {};

  const normalize = (row: unknown, fallbackType: "asset" | "liability" | "equity"): BalanceSheetRow => {
    const r = isObject(row) ? row : {};
    const typeRaw = toString(r.type, fallbackType);
    const type = typeRaw === "liability" ? "liability" : typeRaw === "equity" ? "equity" : "asset";
    return {
      accountId: toString(r.account_id, ""),
      code: toString(r.code, ""),
      name: toString(r.name, ""),
      type,
      balance: toNumber(r.balance, 0),
    };
  };

  const assetsRaw = Array.isArray(obj.assets) ? obj.assets : [];
  const liabilitiesRaw = Array.isArray(obj.liabilities) ? obj.liabilities : [];
  const equityRaw = Array.isArray(obj.equity) ? obj.equity : [];

  return {
    asOf: toString(obj.as_of, ""),
    assets: assetsRaw.map((row) => normalize(row, "asset")),
    liabilities: liabilitiesRaw.map((row) => normalize(row, "liability")),
    equity: equityRaw.map((row) => normalize(row, "equity")),
    totals: {
      assets: toNumber(totalsRaw.assets, 0),
      liabilities: toNumber(totalsRaw.liabilities, 0),
      equity: toNumber(totalsRaw.equity, 0),
      balanced: toBool(totalsRaw.balanced, false),
    },
  };
}

export async function getArSummary(
  business: string,
  params: { asOf?: string } = {}
): Promise<ArSummaryResult> {
  const query = qp({ as_of: params.asOf });
  const path = `${basePath(business)}/ar-summary${query ? `?${query}` : ""}`;
  const raw = await apiFetch<unknown>(path);
  const obj = isObject(raw) ? raw : {};
  const rowsRaw = Array.isArray(obj.rows) ? obj.rows : [];

  return {
    asOf: toString(obj.as_of, ""),
    rows: rowsRaw.map((row) => {
      const r = isObject(row) ? row : {};
      return {
        customerId: toString(r.customer_id, ""),
        name: toString(r.name, "Client"),
        balance: toNumber(r.ar_balance, 0),
      };
    }),
    totalAr: toNumber(obj.total_ar, 0),
  };
}

function normalizeAgingRows(rows: unknown[]): ArAgingInvoice[] {
  return rows.map((row) => {
    const r = isObject(row) ? row : {};
    return {
      invoiceId: toString(r.invoice_id, ""),
      number: toString(r.number, ""),
      customerId: toString(r.customer_id, "") || null,
      customer: toString(r.customer, "") || null,
      dueDate: toString(r.due_date, "") || null,
      balanceDue: toNumber(r.balance_due, 0),
      daysPastDue: Math.trunc(toNumber(r.days_past_due, 0)),
    };
  });
}

export async function getArAging(
  business: string,
  params: { asOf?: string } = {}
): Promise<ArAgingResult> {
  const query = qp({ as_of: params.asOf });
  const path = `${basePath(business)}/ar-aging${query ? `?${query}` : ""}`;
  const raw = await apiFetch<unknown>(path);
  const obj = isObject(raw) ? raw : {};
  const totalsRaw = isObject(obj.totals) ? obj.totals : {};
  const detailsRaw = isObject(obj.details) ? obj.details : {};

  return {
    asOf: toString(obj.as_of, ""),
    totals: {
      current: toNumber(totalsRaw.current, 0),
      bucket1_30: toNumber(totalsRaw["1_30"], 0),
      bucket31_60: toNumber(totalsRaw["31_60"], 0),
      bucket61_90: toNumber(totalsRaw["61_90"], 0),
      bucket90Plus: toNumber(totalsRaw["90_plus"], 0),
    },
    details: {
      current: normalizeAgingRows(Array.isArray(detailsRaw.current) ? detailsRaw.current : []),
      bucket1_30: normalizeAgingRows(Array.isArray(detailsRaw["1_30"]) ? detailsRaw["1_30"] : []),
      bucket31_60: normalizeAgingRows(Array.isArray(detailsRaw["31_60"]) ? detailsRaw["31_60"] : []),
      bucket61_90: normalizeAgingRows(Array.isArray(detailsRaw["61_90"]) ? detailsRaw["61_90"] : []),
      bucket90Plus: normalizeAgingRows(Array.isArray(detailsRaw["90_plus"]) ? detailsRaw["90_plus"] : []),
    },
  };
}
