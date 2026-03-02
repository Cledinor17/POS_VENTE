import { apiFetch } from "./api";

type Dict = Record<string, unknown>;

export type CustomerItem = {
  id: string;
  code: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  isActive: boolean;
  paymentTermsDays: number | null;
  creditLimit: number | null;
  createdAt: string | null;
};

export type CustomerListParams = {
  page?: number;
  perPage?: number;
  q?: string;
  isActive?: boolean;
};

export type CustomerListResult = {
  items: CustomerItem[];
  currentPage: number;
  perPage: number;
  total: number;
  lastPage: number;
};

export type CreateCustomerInput = {
  code?: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  isActive?: boolean;
  paymentTermsDays?: number;
  creditLimit?: number;
};

export type UpdateCustomerInput = Partial<CreateCustomerInput>;

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

function basePath(business: string): string {
  return `/api/app/${encodeURIComponent(business)}/customers`;
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
    currentPage: Math.max(1, Math.trunc(toNumber(source.current_page ?? source.currentPage, defaults.currentPage))),
    perPage: Math.max(1, Math.trunc(toNumber(source.per_page ?? source.perPage, defaults.perPage))),
    total: Math.max(0, Math.trunc(toNumber(source.total, defaults.total))),
    lastPage: Math.max(1, Math.trunc(toNumber(source.last_page ?? source.lastPage, defaults.lastPage))),
  };
}

function normalizeCustomer(raw: unknown): CustomerItem {
  const obj = isObject(raw) ? raw : {};
  return {
    id: toString(obj.id, ""),
    code: toString(obj.code, "") || null,
    name: toString(obj.name, "Client"),
    email: toString(obj.email, "") || null,
    phone: toString(obj.phone, "") || null,
    notes: toString(obj.notes, "") || null,
    isActive: toBool(obj.is_active ?? obj.isActive, true),
    paymentTermsDays: Number.isFinite(toNumber(obj.payment_terms_days ?? obj.paymentTermsDays, NaN))
      ? toNumber(obj.payment_terms_days ?? obj.paymentTermsDays, 0)
      : null,
    creditLimit: Number.isFinite(toNumber(obj.credit_limit ?? obj.creditLimit, NaN))
      ? toNumber(obj.credit_limit ?? obj.creditLimit, 0)
      : null,
    createdAt: toString(obj.created_at ?? obj.createdAt, "") || null,
  };
}

function toCreatePayload(input: CreateCustomerInput): Record<string, unknown> {
  return {
    code: input.code ?? null,
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    notes: input.notes ?? null,
    is_active: typeof input.isActive === "boolean" ? input.isActive : true,
    payment_terms_days: input.paymentTermsDays ?? null,
    credit_limit: input.creditLimit ?? null,
  };
}

function toUpdatePayload(input: UpdateCustomerInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if ("code" in input) payload.code = input.code ?? null;
  if ("name" in input) payload.name = input.name;
  if ("email" in input) payload.email = input.email ?? null;
  if ("phone" in input) payload.phone = input.phone ?? null;
  if ("notes" in input) payload.notes = input.notes ?? null;
  if ("paymentTermsDays" in input) payload.payment_terms_days = input.paymentTermsDays ?? null;
  if ("creditLimit" in input) payload.credit_limit = input.creditLimit ?? null;
  if ("isActive" in input && typeof input.isActive === "boolean") payload.is_active = input.isActive;

  return payload;
}

export async function listCustomers(
  business: string,
  params: CustomerListParams = {}
): Promise<CustomerListResult> {
  const qp = new URLSearchParams();
  if (params.page && params.page > 0) qp.set("page", String(params.page));
  if (params.perPage && params.perPage > 0) qp.set("per_page", String(params.perPage));
  if (params.q && params.q.trim().length > 0) qp.set("q", params.q.trim());
  if (typeof params.isActive === "boolean") qp.set("is_active", params.isActive ? "1" : "0");

  const query = qp.toString();
  const path = query ? `${basePath(business)}?${query}` : basePath(business);
  const raw = await apiFetch<unknown>(path);
  const items = getCollection(raw).map(normalizeCustomer);
  const meta = getMeta(raw, items.length);

  return {
    items,
    currentPage: meta.currentPage,
    perPage: meta.perPage,
    total: meta.total,
    lastPage: meta.lastPage,
  };
}

export async function createCustomer(
  business: string,
  input: CreateCustomerInput
): Promise<CustomerItem> {
  const raw = await apiFetch<unknown>(basePath(business), {
    method: "POST",
    json: toCreatePayload(input),
  });
  return normalizeCustomer(raw);
}

export async function updateCustomer(
  business: string,
  customerId: string,
  input: UpdateCustomerInput
): Promise<CustomerItem> {
  const raw = await apiFetch<unknown>(`${basePath(business)}/${encodeURIComponent(customerId)}`, {
    method: "PUT",
    json: toUpdatePayload(input),
  });
  return normalizeCustomer(raw);
}

export async function deleteCustomer(business: string, customerId: string): Promise<void> {
  await apiFetch<unknown>(`${basePath(business)}/${encodeURIComponent(customerId)}`, {
    method: "DELETE",
  });
}
