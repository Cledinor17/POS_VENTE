import { apiFetch } from "./api";

type Dict = Record<string, unknown>;

export type SupplierItem = {
  id: string;
  businessId: string;
  businessName: string | null;
  businessSlug: string | null;
  department: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  address: string | null;
  balance: number;
  createdAt: string | null;
};

export type SupplierListParams = {
  page?: number;
  perPage?: number;
  q?: string;
};

export type SupplierListResult = {
  items: SupplierItem[];
  currentPage: number;
  perPage: number;
  total: number;
  lastPage: number;
};

export type CreateSupplierInput = {
  department?: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
  balance?: number;
};

export type UpdateSupplierInput = Partial<CreateSupplierInput>;

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

function basePath(business: string): string {
  return `/api/app/${encodeURIComponent(business)}/suppliers`;
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

function normalizeSupplier(raw: unknown): SupplierItem {
  const obj = isObject(raw) ? raw : {};
  const business = isObject(obj.business) ? obj.business : {};
  return {
    id: toString(obj.id, ""),
    businessId: toString(obj.business_id ?? obj.businessId, ""),
    businessName: toString(business.name, "") || null,
    businessSlug: toString(business.slug, "") || null,
    department: toString(obj.department, "General"),
    name: toString(obj.name, "Fournisseur"),
    contactPerson: toString(obj.contact_person ?? obj.contactPerson, "") || null,
    phone: toString(obj.phone, "") || null,
    address: toString(obj.address, "") || null,
    balance: toNumber(obj.balance, 0),
    createdAt: toString(obj.created_at ?? obj.createdAt, "") || null,
  };
}

function toPayload(input: CreateSupplierInput | UpdateSupplierInput): Record<string, unknown> {
  return {
    department: input.department ?? null,
    name: input.name,
    contact_person: input.contactPerson ?? null,
    phone: input.phone ?? null,
    address: input.address ?? null,
    balance: input.balance ?? null,
  };
}

export async function listSuppliers(
  business: string,
  params: SupplierListParams = {}
): Promise<SupplierListResult> {
  const qp = new URLSearchParams();
  if (params.page && params.page > 0) qp.set("page", String(params.page));
  if (params.perPage && params.perPage > 0) qp.set("per_page", String(params.perPage));
  if (params.q && params.q.trim().length > 0) qp.set("q", params.q.trim());

  const query = qp.toString();
  const path = query ? `${basePath(business)}?${query}` : basePath(business);
  const raw = await apiFetch<unknown>(path);
  const items = getCollection(raw).map(normalizeSupplier);
  const meta = getMeta(raw, items.length);

  return {
    items,
    currentPage: meta.currentPage,
    perPage: meta.perPage,
    total: meta.total,
    lastPage: meta.lastPage,
  };
}

export async function createSupplier(
  business: string,
  input: CreateSupplierInput
): Promise<SupplierItem> {
  const raw = await apiFetch<unknown>(basePath(business), {
    method: "POST",
    json: toPayload(input),
  });
  return normalizeSupplier(raw);
}

export async function updateSupplier(
  business: string,
  supplierId: string,
  input: UpdateSupplierInput
): Promise<SupplierItem> {
  const raw = await apiFetch<unknown>(`${basePath(business)}/${encodeURIComponent(supplierId)}`, {
    method: "PUT",
    json: toPayload(input),
  });
  return normalizeSupplier(raw);
}

export async function deleteSupplier(business: string, supplierId: string): Promise<void> {
  await apiFetch<unknown>(`${basePath(business)}/${encodeURIComponent(supplierId)}`, {
    method: "DELETE",
  });
}
