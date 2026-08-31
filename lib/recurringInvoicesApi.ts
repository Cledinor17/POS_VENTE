import { apiFetch } from "./api";

type Dict = Record<string, unknown>;

export const RECURRING_FREQUENCIES = ["weekly", "monthly", "quarterly", "yearly"] as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

export type RecurringInvoiceItemInput = {
  productId?: number | null;
  name: string;
  sku?: string;
  description?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  taxRate?: number;
};

export type RecurringInvoiceItem = RecurringInvoiceItemInput & { id: string };

export type RecurringInvoiceDetail = {
  id: string;
  customerId: string | null;
  customerName: string;
  title: string;
  currency: string;
  exchangeRate: number;
  paymentTermsDays: number | null;
  frequency: RecurringFrequency;
  intervalCount: number;
  startDate: string;
  nextRunDate: string;
  endDate: string | null;
  status: "active" | "paused" | "cancelled";
  autoSend: boolean;
  lastGeneratedAt: string | null;
  items: RecurringInvoiceItem[];
};

export type RecurringInvoiceSummary = {
  id: string;
  title: string;
  customerName: string;
  frequency: RecurringFrequency;
  nextRunDate: string;
  status: "active" | "paused" | "cancelled";
  itemsCount: number;
};

export type RecurringInvoiceListResult = {
  items: RecurringInvoiceSummary[];
  currentPage: number;
  perPage: number;
  total: number;
  lastPage: number;
};

export type CreateRecurringInvoiceInput = {
  customerId?: number | null;
  title?: string;
  currency?: string;
  exchangeRate?: number;
  paymentTermsDays?: number | null;
  frequency: RecurringFrequency;
  intervalCount?: number;
  startDate: string;
  endDate?: string | null;
  autoSend?: boolean;
  items: RecurringInvoiceItemInput[];
};

export type UpdateRecurringInvoiceInput = Partial<CreateRecurringInvoiceInput>;

function isObject(value: unknown): value is Dict {
  return typeof value === "object" && value !== null;
}

function toString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
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

function basePath(business: string): string {
  return `/api/app/${encodeURIComponent(business)}/recurring-invoices`;
}

function normalizeFrequency(value: unknown): RecurringFrequency {
  const s = toString(value, "monthly");
  return (RECURRING_FREQUENCIES as readonly string[]).includes(s) ? (s as RecurringFrequency) : "monthly";
}

function normalizeStatus(value: unknown): "active" | "paused" | "cancelled" {
  const s = toString(value, "active");
  return s === "paused" ? "paused" : s === "cancelled" ? "cancelled" : "active";
}

function normalizeItem(raw: unknown): RecurringInvoiceItem {
  const obj = isObject(raw) ? raw : {};
  return {
    id: toString(obj.id, ""),
    productId: obj.product_id != null ? toNumber(obj.product_id) : null,
    name: toString(obj.name, ""),
    sku: toString(obj.sku, ""),
    description: toString(obj.description, ""),
    quantity: toNumber(obj.quantity, 1),
    unit: toString(obj.unit, ""),
    unitPrice: toNumber(obj.unit_price, 0),
    taxRate: toNumber(obj.tax_rate, 0),
  };
}

function normalizeDetail(raw: unknown): RecurringInvoiceDetail {
  const obj = isObject(raw) ? raw : {};
  const itemsRaw = Array.isArray(obj.items) ? obj.items : [];
  return {
    id: toString(obj.id, ""),
    customerId: obj.customer_id != null ? toString(obj.customer_id) : null,
    customerName: toString(obj.customer_name, ""),
    title: toString(obj.title, ""),
    currency: toString(obj.currency, "USD"),
    exchangeRate: toNumber(obj.exchange_rate, 1),
    paymentTermsDays: obj.payment_terms_days != null ? Math.trunc(toNumber(obj.payment_terms_days)) : null,
    frequency: normalizeFrequency(obj.frequency),
    intervalCount: Math.max(1, Math.trunc(toNumber(obj.interval_count, 1))),
    startDate: toString(obj.start_date, ""),
    nextRunDate: toString(obj.next_run_date, ""),
    endDate: toString(obj.end_date, "") || null,
    status: normalizeStatus(obj.status),
    autoSend: toBool(obj.auto_send, false),
    lastGeneratedAt: toString(obj.last_generated_at, "") || null,
    items: itemsRaw.map(normalizeItem),
  };
}

function normalizeSummary(raw: unknown): RecurringInvoiceSummary {
  const obj = isObject(raw) ? raw : {};
  return {
    id: toString(obj.id, ""),
    title: toString(obj.title, ""),
    customerName: toString(obj.customer_name, ""),
    frequency: normalizeFrequency(obj.frequency),
    nextRunDate: toString(obj.next_run_date, ""),
    status: normalizeStatus(obj.status),
    itemsCount: Math.trunc(toNumber(obj.items_count, 0)),
  };
}

function toItemPayload(item: RecurringInvoiceItemInput): Record<string, unknown> {
  return {
    product_id: item.productId ?? null,
    name: item.name,
    sku: item.sku || null,
    description: item.description || null,
    quantity: item.quantity,
    unit: item.unit || null,
    unit_price: item.unitPrice,
    tax_rate: item.taxRate ?? 0,
  };
}

function toPayload(input: CreateRecurringInvoiceInput | UpdateRecurringInvoiceInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if ("customerId" in input) payload.customer_id = input.customerId ?? null;
  if ("title" in input) payload.title = input.title ?? null;
  if ("currency" in input) payload.currency = input.currency;
  if ("exchangeRate" in input) payload.exchange_rate = input.exchangeRate;
  if ("paymentTermsDays" in input) payload.payment_terms_days = input.paymentTermsDays ?? null;
  if ("frequency" in input) payload.frequency = input.frequency;
  if ("intervalCount" in input) payload.interval_count = input.intervalCount;
  if ("startDate" in input) payload.start_date = input.startDate;
  if ("endDate" in input) payload.end_date = input.endDate ?? null;
  if ("autoSend" in input) payload.auto_send = input.autoSend ?? false;
  if ("items" in input && input.items) payload.items = input.items.map(toItemPayload);
  return payload;
}

export async function listRecurringInvoices(
  business: string,
  params: { page?: number; status?: string } = {}
): Promise<RecurringInvoiceListResult> {
  const qp = new URLSearchParams();
  if (params.page && params.page > 0) qp.set("page", String(params.page));
  if (params.status) qp.set("status", params.status);
  const query = qp.toString();
  const path = query ? `${basePath(business)}?${query}` : basePath(business);
  const raw = await apiFetch<unknown>(path);
  const items = getCollection(raw).map(normalizeSummary);
  const meta = getMeta(raw, items.length);
  return { items, currentPage: meta.currentPage, perPage: meta.perPage, total: meta.total, lastPage: meta.lastPage };
}

export async function getRecurringInvoice(business: string, id: string): Promise<RecurringInvoiceDetail> {
  const raw = await apiFetch<unknown>(`${basePath(business)}/${encodeURIComponent(id)}`);
  return normalizeDetail(raw);
}

export async function createRecurringInvoice(
  business: string,
  input: CreateRecurringInvoiceInput
): Promise<RecurringInvoiceDetail> {
  const raw = await apiFetch<unknown>(basePath(business), { method: "POST", json: toPayload(input) });
  return normalizeDetail(raw);
}

export async function updateRecurringInvoice(
  business: string,
  id: string,
  input: UpdateRecurringInvoiceInput
): Promise<RecurringInvoiceDetail> {
  const raw = await apiFetch<unknown>(`${basePath(business)}/${encodeURIComponent(id)}`, {
    method: "PUT",
    json: toPayload(input),
  });
  return normalizeDetail(raw);
}

export async function deleteRecurringInvoice(business: string, id: string): Promise<void> {
  await apiFetch<unknown>(`${basePath(business)}/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function pauseRecurringInvoice(business: string, id: string): Promise<RecurringInvoiceDetail> {
  const raw = await apiFetch<unknown>(`${basePath(business)}/${encodeURIComponent(id)}/pause`, { method: "POST" });
  return normalizeDetail(raw);
}

export async function resumeRecurringInvoice(business: string, id: string): Promise<RecurringInvoiceDetail> {
  const raw = await apiFetch<unknown>(`${basePath(business)}/${encodeURIComponent(id)}/resume`, { method: "POST" });
  return normalizeDetail(raw);
}
