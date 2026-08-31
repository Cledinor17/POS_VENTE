import { apiFetch } from "./api";

type Dict = Record<string, unknown>;

export type EmployeeDeductionItem = {
  id: string;
  label: string;
  type: "fixed" | "percent";
  amount: number;
  isActive: boolean;
};

export type CreateDeductionInput = {
  label: string;
  type: "fixed" | "percent";
  amount: number;
  isActive?: boolean;
};

export type PayslipItem = {
  id: string;
  employeeId: string;
  employeeName: string;
  jobTitle: string;
  grossAmount: number;
  totalDeductions: number;
  netAmount: number;
  currency: string;
  breakdown: Array<{ label: string; type: string; rate: number; amount: number }>;
};

export type PayrollRunDetail = {
  id: string;
  number: string;
  periodStart: string;
  periodEnd: string;
  status: "draft" | "finalized";
  currency: string;
  finalizedAt: string | null;
  payslips: PayslipItem[];
  totals: { gross: number; deductions: number; net: number; hasMixedCurrencies: boolean };
};

export type PayrollRunSummary = {
  id: string;
  number: string;
  periodStart: string;
  periodEnd: string;
  status: "draft" | "finalized";
  currency: string;
  payslipsCount: number;
  finalizedAt: string | null;
};

export type PayrollRunListResult = {
  items: PayrollRunSummary[];
  currentPage: number;
  perPage: number;
  total: number;
  lastPage: number;
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

function toBool(value: unknown, fallback = true): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "1" || normalized === "true") return true;
    if (normalized === "0" || normalized === "false") return false;
  }
  return fallback;
}

function getCollection(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!isObject(raw)) return [];
  if (Array.isArray(raw.data)) return raw.data;
  return [];
}

function getMeta(raw: unknown, itemCount: number) {
  const defaults = { currentPage: 1, perPage: itemCount || 20, total: itemCount, lastPage: 1 };
  if (!isObject(raw)) return defaults;
  const source = isObject(raw.meta) ? raw.meta : raw;

  return {
    currentPage: Math.max(1, Math.trunc(toNumber(source.current_page, defaults.currentPage))),
    perPage: Math.max(1, Math.trunc(toNumber(source.per_page, defaults.perPage))),
    total: Math.max(0, Math.trunc(toNumber(source.total, defaults.total))),
    lastPage: Math.max(1, Math.trunc(toNumber(source.last_page, defaults.lastPage))),
  };
}

function employeeBasePath(business: string, employeeId: string): string {
  return `/api/app/${encodeURIComponent(business)}/employees/${encodeURIComponent(employeeId)}`;
}

function payrollBasePath(business: string): string {
  return `/api/app/${encodeURIComponent(business)}/payroll-runs`;
}

function normalizeDeduction(raw: unknown): EmployeeDeductionItem {
  const obj = isObject(raw) ? raw : {};
  const type = toString(obj.type, "fixed") === "percent" ? "percent" : "fixed";
  return {
    id: toString(obj.id, ""),
    label: toString(obj.label, ""),
    type,
    amount: toNumber(obj.amount, 0),
    isActive: toBool(obj.is_active, true),
  };
}

function normalizePayslip(raw: unknown): PayslipItem {
  const obj = isObject(raw) ? raw : {};
  const breakdownRaw = Array.isArray(obj.breakdown) ? obj.breakdown : [];
  return {
    id: toString(obj.id, ""),
    employeeId: toString(obj.employee_id, ""),
    employeeName: toString(obj.employee_name, ""),
    jobTitle: toString(obj.job_title, ""),
    grossAmount: toNumber(obj.gross_amount, 0),
    totalDeductions: toNumber(obj.total_deductions, 0),
    netAmount: toNumber(obj.net_amount, 0),
    currency: toString(obj.currency, "USD"),
    breakdown: breakdownRaw.map((row) => {
      const r = isObject(row) ? row : {};
      return {
        label: toString(r.label, ""),
        type: toString(r.type, "fixed"),
        rate: toNumber(r.rate, 0),
        amount: toNumber(r.amount, 0),
      };
    }),
  };
}

function normalizeRunDetail(raw: unknown): PayrollRunDetail {
  const obj = isObject(raw) ? raw : {};
  const totalsRaw = isObject(obj.totals) ? obj.totals : {};
  const payslipsRaw = Array.isArray(obj.payslips) ? obj.payslips : [];
  const status = toString(obj.status, "draft") === "finalized" ? "finalized" : "draft";

  return {
    id: toString(obj.id, ""),
    number: toString(obj.number, ""),
    periodStart: toString(obj.period_start, ""),
    periodEnd: toString(obj.period_end, ""),
    status,
    currency: toString(obj.currency, "USD"),
    finalizedAt: toString(obj.finalized_at, "") || null,
    payslips: payslipsRaw.map(normalizePayslip),
    totals: {
      gross: toNumber(totalsRaw.gross, 0),
      deductions: toNumber(totalsRaw.deductions, 0),
      net: toNumber(totalsRaw.net, 0),
      hasMixedCurrencies: toBool(totalsRaw.has_mixed_currencies, false),
    },
  };
}

function normalizeRunSummary(raw: unknown): PayrollRunSummary {
  const obj = isObject(raw) ? raw : {};
  const status = toString(obj.status, "draft") === "finalized" ? "finalized" : "draft";
  return {
    id: toString(obj.id, ""),
    number: toString(obj.number, ""),
    periodStart: toString(obj.period_start, ""),
    periodEnd: toString(obj.period_end, ""),
    status,
    currency: toString(obj.currency, "USD"),
    payslipsCount: Math.trunc(toNumber(obj.payslips_count, 0)),
    finalizedAt: toString(obj.finalized_at, "") || null,
  };
}

export async function listDeductions(business: string, employeeId: string): Promise<EmployeeDeductionItem[]> {
  const raw = await apiFetch<unknown>(`${employeeBasePath(business, employeeId)}/deductions`);
  return getCollection(raw).map(normalizeDeduction);
}

export async function createDeduction(
  business: string,
  employeeId: string,
  input: CreateDeductionInput
): Promise<EmployeeDeductionItem> {
  const raw = await apiFetch<unknown>(`${employeeBasePath(business, employeeId)}/deductions`, {
    method: "POST",
    json: {
      label: input.label,
      type: input.type,
      amount: input.amount,
      is_active: input.isActive ?? true,
    },
  });
  return normalizeDeduction(raw);
}

export async function deleteDeduction(business: string, employeeId: string, deductionId: string): Promise<void> {
  await apiFetch<unknown>(`${employeeBasePath(business, employeeId)}/deductions/${encodeURIComponent(deductionId)}`, {
    method: "DELETE",
  });
}

export async function listPayrollRuns(
  business: string,
  params: { page?: number; perPage?: number } = {}
): Promise<PayrollRunListResult> {
  const qp = new URLSearchParams();
  if (params.page && params.page > 0) qp.set("page", String(params.page));
  if (params.perPage && params.perPage > 0) qp.set("per_page", String(params.perPage));
  const query = qp.toString();
  const path = query ? `${payrollBasePath(business)}?${query}` : payrollBasePath(business);
  const raw = await apiFetch<unknown>(path);
  const items = getCollection(raw).map(normalizeRunSummary);
  const meta = getMeta(raw, items.length);

  return { items, currentPage: meta.currentPage, perPage: meta.perPage, total: meta.total, lastPage: meta.lastPage };
}

export async function getPayrollRun(business: string, runId: string): Promise<PayrollRunDetail> {
  const raw = await apiFetch<unknown>(`${payrollBasePath(business)}/${encodeURIComponent(runId)}`);
  return normalizeRunDetail(raw);
}

export async function createPayrollRun(
  business: string,
  input: { periodStart: string; periodEnd: string }
): Promise<PayrollRunDetail> {
  const raw = await apiFetch<unknown>(payrollBasePath(business), {
    method: "POST",
    json: { period_start: input.periodStart, period_end: input.periodEnd },
  });
  return normalizeRunDetail(raw);
}

export async function finalizePayrollRun(business: string, runId: string): Promise<PayrollRunDetail> {
  const raw = await apiFetch<unknown>(`${payrollBasePath(business)}/${encodeURIComponent(runId)}/finalize`, {
    method: "POST",
  });
  return normalizeRunDetail(raw);
}

export async function deletePayrollRun(business: string, runId: string): Promise<void> {
  await apiFetch<unknown>(`${payrollBasePath(business)}/${encodeURIComponent(runId)}`, {
    method: "DELETE",
  });
}
