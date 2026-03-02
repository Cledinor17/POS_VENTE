import { apiFetch } from "./api";

type Dict = Record<string, unknown>;

export type EmployeeItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  salaryAmount: number;
  salaryCurrency: string | null;
  payFrequency: string;
  hiredAt: string | null;
  isActive: boolean;
  notes: string | null;
  totalPaidAmount: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type EmployeeListResult = {
  items: EmployeeItem[];
  currentPage: number;
  perPage: number;
  total: number;
  lastPage: number;
};

export type ListEmployeesParams = {
  page?: number;
  perPage?: number;
  q?: string;
  isActive?: boolean;
};

export type CreateEmployeeInput = {
  name: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  salaryAmount?: number;
  salaryCurrency?: string;
  payFrequency?: "monthly" | "biweekly" | "weekly" | "hourly";
  hiredAt?: string;
  isActive?: boolean;
  notes?: string;
};

export type UpdateEmployeeInput = Partial<CreateEmployeeInput>;

export type EmployeePaymentItem = {
  id: string;
  employeeId: string;
  amount: number;
  currency: string | null;
  paidAt: string | null;
  method: string | null;
  reference: string | null;
  notes: string | null;
  recordedBy: string | null;
  recordedByName: string | null;
  createdAt: string | null;
};

export type EmployeePaymentListResult = {
  items: EmployeePaymentItem[];
  currentPage: number;
  perPage: number;
  total: number;
  lastPage: number;
  employee: { id: string; name: string } | null;
};

export type CreateEmployeePaymentInput = {
  amount: number;
  currency?: string;
  paidAt?: string;
  method?: string;
  reference?: string;
  notes?: string;
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

function employeeBasePath(business: string): string {
  return `/api/app/${encodeURIComponent(business)}/employees`;
}

function getCollection(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!isObject(raw)) return [];
  if (Array.isArray(raw.data)) return raw.data;
  if (isObject(raw.data) && Array.isArray(raw.data.data)) return raw.data.data;
  return [];
}

function getMeta(raw: unknown, itemCount: number) {
  const defaults = {
    currentPage: 1,
    perPage: itemCount || 20,
    total: itemCount,
    lastPage: 1,
  };

  if (!isObject(raw)) return defaults;
  const source = isObject(raw.meta) ? raw.meta : raw;

  return {
    currentPage: Math.max(
      1,
      Math.trunc(toNumber(source.current_page ?? source.currentPage, defaults.currentPage)),
    ),
    perPage: Math.max(
      1,
      Math.trunc(toNumber(source.per_page ?? source.perPage, defaults.perPage)),
    ),
    total: Math.max(0, Math.trunc(toNumber(source.total, defaults.total))),
    lastPage: Math.max(
      1,
      Math.trunc(toNumber(source.last_page ?? source.lastPage, defaults.lastPage)),
    ),
  };
}

function normalizeEmployee(raw: unknown): EmployeeItem {
  const obj = isObject(raw) ? raw : {};
  return {
    id: toString(obj.id, ""),
    name: toString(obj.name, ""),
    email: toString(obj.email, "") || null,
    phone: toString(obj.phone, "") || null,
    jobTitle: toString(obj.job_title ?? obj.jobTitle, "") || null,
    salaryAmount: toNumber(obj.salary_amount ?? obj.salaryAmount, 0),
    salaryCurrency: toString(obj.salary_currency ?? obj.salaryCurrency, "") || null,
    payFrequency: toString(obj.pay_frequency ?? obj.payFrequency, "monthly"),
    hiredAt: toString(obj.hired_at ?? obj.hiredAt, "") || null,
    isActive: toBool(obj.is_active ?? obj.isActive, true),
    notes: toString(obj.notes, "") || null,
    totalPaidAmount: toNumber(obj.total_paid_amount ?? obj.totalPaidAmount, 0),
    createdAt: toString(obj.created_at ?? obj.createdAt, "") || null,
    updatedAt: toString(obj.updated_at ?? obj.updatedAt, "") || null,
  };
}

function normalizeEmployeePayment(raw: unknown): EmployeePaymentItem {
  const obj = isObject(raw) ? raw : {};
  return {
    id: toString(obj.id, ""),
    employeeId: toString(obj.employee_id ?? obj.employeeId, ""),
    amount: toNumber(obj.amount, 0),
    currency: toString(obj.currency, "") || null,
    paidAt: toString(obj.paid_at ?? obj.paidAt, "") || null,
    method: toString(obj.method, "") || null,
    reference: toString(obj.reference, "") || null,
    notes: toString(obj.notes, "") || null,
    recordedBy: toString(obj.recorded_by ?? obj.recordedBy, "") || null,
    recordedByName: toString(obj.recorded_by_name ?? obj.recordedByName, "") || null,
    createdAt: toString(obj.created_at ?? obj.createdAt, "") || null,
  };
}

function toEmployeePayload(input: CreateEmployeeInput | UpdateEmployeeInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if ("name" in input) payload.name = input.name;
  if ("email" in input) payload.email = input.email ?? null;
  if ("phone" in input) payload.phone = input.phone ?? null;
  if ("jobTitle" in input) payload.job_title = input.jobTitle ?? null;
  if ("salaryAmount" in input) payload.salary_amount = input.salaryAmount ?? null;
  if ("salaryCurrency" in input) payload.salary_currency = input.salaryCurrency ?? null;
  if ("payFrequency" in input) payload.pay_frequency = input.payFrequency ?? null;
  if ("hiredAt" in input) payload.hired_at = input.hiredAt ?? null;
  if ("isActive" in input && typeof input.isActive === "boolean") payload.is_active = input.isActive;
  if ("notes" in input) payload.notes = input.notes ?? null;
  return payload;
}

export async function listEmployees(
  business: string,
  params: ListEmployeesParams = {},
): Promise<EmployeeListResult> {
  const qp = new URLSearchParams();
  if (params.page && params.page > 0) qp.set("page", String(params.page));
  if (params.perPage && params.perPage > 0) qp.set("per_page", String(params.perPage));
  if (params.q && params.q.trim().length > 0) qp.set("q", params.q.trim());
  if (typeof params.isActive === "boolean") qp.set("is_active", params.isActive ? "1" : "0");

  const query = qp.toString();
  const path = query ? `${employeeBasePath(business)}?${query}` : employeeBasePath(business);
  const raw = await apiFetch<unknown>(path);
  const items = getCollection(raw).map(normalizeEmployee);
  const meta = getMeta(raw, items.length);

  return {
    items,
    currentPage: meta.currentPage,
    perPage: meta.perPage,
    total: meta.total,
    lastPage: meta.lastPage,
  };
}

export async function createEmployee(
  business: string,
  input: CreateEmployeeInput,
): Promise<EmployeeItem> {
  const raw = await apiFetch<unknown>(employeeBasePath(business), {
    method: "POST",
    json: toEmployeePayload(input),
  });
  return normalizeEmployee(raw);
}

export async function updateEmployee(
  business: string,
  employeeId: string,
  input: UpdateEmployeeInput,
): Promise<EmployeeItem> {
  const raw = await apiFetch<unknown>(`${employeeBasePath(business)}/${encodeURIComponent(employeeId)}`, {
    method: "PUT",
    json: toEmployeePayload(input),
  });
  return normalizeEmployee(raw);
}

export async function deleteEmployee(
  business: string,
  employeeId: string,
): Promise<void> {
  await apiFetch<unknown>(`${employeeBasePath(business)}/${encodeURIComponent(employeeId)}`, {
    method: "DELETE",
  });
}

export async function listEmployeePayments(
  business: string,
  employeeId: string,
  params: { page?: number; perPage?: number; from?: string; to?: string } = {},
): Promise<EmployeePaymentListResult> {
  const qp = new URLSearchParams();
  if (params.page && params.page > 0) qp.set("page", String(params.page));
  if (params.perPage && params.perPage > 0) qp.set("per_page", String(params.perPage));
  if (params.from && params.from.trim().length > 0) qp.set("from", params.from.trim());
  if (params.to && params.to.trim().length > 0) qp.set("to", params.to.trim());

  const query = qp.toString();
  const base = `${employeeBasePath(business)}/${encodeURIComponent(employeeId)}/payments`;
  const path = query ? `${base}?${query}` : base;
  const raw = await apiFetch<unknown>(path);

  const items = getCollection(raw).map(normalizeEmployeePayment);
  const meta = getMeta(raw, items.length);
  const employee = isObject(raw) && isObject(raw.employee)
    ? { id: toString(raw.employee.id, ""), name: toString(raw.employee.name, "") }
    : null;

  return {
    items,
    currentPage: meta.currentPage,
    perPage: meta.perPage,
    total: meta.total,
    lastPage: meta.lastPage,
    employee,
  };
}

export async function createEmployeePayment(
  business: string,
  employeeId: string,
  input: CreateEmployeePaymentInput,
): Promise<EmployeePaymentItem> {
  const raw = await apiFetch<unknown>(
    `${employeeBasePath(business)}/${encodeURIComponent(employeeId)}/payments`,
    {
      method: "POST",
      json: {
        amount: input.amount,
        currency: input.currency ?? null,
        paid_at: input.paidAt ?? null,
        method: input.method ?? null,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
      },
    },
  );

  return normalizeEmployeePayment(raw);
}
