import { apiFetch } from "./api";

type Dict = Record<string, unknown>;

export type PurchaseOrderStatus = "draft" | "ordered" | "received" | "cancelled";

export type PurchaseOrderItem = {
  id: string;
  productId: string;
  productName: string;
  sku: string | null;
  quantity: number;
  receivedQuantity: number;
  unitCost: number;
  taxRate: number;
  lineTotal: number;
  taxAmount: number;
  notes: string | null;
};

export type PurchaseOrder = {
  id: string;
  businessId: string;
  supplierId: string | null;
  supplierName: string | null;
  number: string;
  status: PurchaseOrderStatus;
  orderDate: string | null;
  expectedAt: string | null;
  receivedAt: string | null;
  currency: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  items: PurchaseOrderItem[];
};

export type PurchaseOrderListParams = {
  page?: number;
  perPage?: number;
  q?: string;
  status?: string;
};

export type PurchaseOrderListResult = {
  items: PurchaseOrder[];
  currentPage: number;
  perPage: number;
  total: number;
  lastPage: number;
};

export type PurchaseOrderLineInput = {
  productId: string;
  quantity: number;
  unitCost: number;
  taxRate?: number;
  notes?: string;
};

export type CreatePurchaseOrderInput = {
  supplierId?: string | null;
  number?: string;
  status?: "draft" | "ordered";
  orderDate?: string;
  expectedAt?: string;
  currency?: string;
  notes?: string;
  items: PurchaseOrderLineInput[];
};

export type UpdatePurchaseOrderInput = Partial<CreatePurchaseOrderInput>;

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

function normalizeStatus(value: unknown): PurchaseOrderStatus {
  const normalized = toString(value, "draft").trim().toLowerCase();
  if (normalized === "ordered" || normalized === "received" || normalized === "cancelled") {
    return normalized;
  }
  return "draft";
}

function basePath(business: string): string {
  return `/api/app/${encodeURIComponent(business)}/purchase-orders`;
}

function getCollection(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!isObject(raw)) return [];
  if (Array.isArray(raw.data)) return raw.data;
  if (isObject(raw.data) && Array.isArray(raw.data.data)) return raw.data.data;
  if (Array.isArray(raw.purchase_orders)) return raw.purchase_orders;
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

function getResource(raw: unknown): unknown {
  if (!isObject(raw)) return raw;
  if (isObject(raw.purchase_order)) return raw.purchase_order;
  if (isObject(raw.purchaseOrder)) return raw.purchaseOrder;
  if (isObject(raw.data)) return raw.data;
  return raw;
}

function normalizeItem(raw: unknown): PurchaseOrderItem {
  const obj = isObject(raw) ? raw : {};
  return {
    id: toString(obj.id, ""),
    productId: toString(obj.product_id ?? obj.productId, ""),
    productName: toString(obj.product_name ?? obj.productName, "Produit"),
    sku: toString(obj.sku, "") || null,
    quantity: toNumber(obj.quantity, 0),
    receivedQuantity: toNumber(obj.received_quantity ?? obj.receivedQuantity, 0),
    unitCost: toNumber(obj.unit_cost ?? obj.unitCost, 0),
    taxRate: toNumber(obj.tax_rate ?? obj.taxRate, 0),
    lineTotal: toNumber(obj.line_total ?? obj.lineTotal, 0),
    taxAmount: toNumber(obj.tax_amount ?? obj.taxAmount, 0),
    notes: toString(obj.notes, "") || null,
  };
}

function normalizePurchaseOrder(raw: unknown): PurchaseOrder {
  const obj = isObject(raw) ? raw : {};
  const supplier = isObject(obj.supplier) ? obj.supplier : {};
  const items = Array.isArray(obj.items) ? obj.items.map(normalizeItem) : [];
  return {
    id: toString(obj.id, ""),
    businessId: toString(obj.business_id ?? obj.businessId, ""),
    supplierId: toString(obj.supplier_id ?? obj.supplierId, "") || null,
    supplierName:
      toString(obj.supplier_name ?? obj.supplierName, "") ||
      toString(supplier.name, "") ||
      null,
    number: toString(obj.number, "PO"),
    status: normalizeStatus(obj.status),
    orderDate: toString(obj.order_date ?? obj.orderDate, "") || null,
    expectedAt: toString(obj.expected_at ?? obj.expectedAt, "") || null,
    receivedAt: toString(obj.received_at ?? obj.receivedAt, "") || null,
    currency: toString(obj.currency, "USD"),
    subtotal: toNumber(obj.subtotal, 0),
    taxTotal: toNumber(obj.tax_total ?? obj.taxTotal, 0),
    total: toNumber(obj.total, 0),
    notes: toString(obj.notes, "") || null,
    createdAt: toString(obj.created_at ?? obj.createdAt, "") || null,
    updatedAt: toString(obj.updated_at ?? obj.updatedAt, "") || null,
    items,
  };
}

function toPayload(input: CreatePurchaseOrderInput | UpdatePurchaseOrderInput): Dict {
  const payload: Dict = {};
  if (input.supplierId !== undefined) payload.supplier_id = input.supplierId || null;
  if (typeof input.number === "string") payload.number = input.number;
  if (typeof input.status === "string") payload.status = input.status;
  if (typeof input.orderDate === "string") payload.order_date = input.orderDate || null;
  if (typeof input.expectedAt === "string") payload.expected_at = input.expectedAt || null;
  if (typeof input.currency === "string") payload.currency = input.currency;
  if (typeof input.notes === "string") payload.notes = input.notes;
  if (Array.isArray(input.items)) {
    payload.items = input.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      unit_cost: item.unitCost,
      tax_rate: item.taxRate ?? 0,
      notes: item.notes ?? null,
    }));
  }
  return payload;
}

export async function listPurchaseOrders(
  business: string,
  params: PurchaseOrderListParams = {}
): Promise<PurchaseOrderListResult> {
  const qp = new URLSearchParams();
  if (params.page && params.page > 0) qp.set("page", String(params.page));
  if (params.perPage && params.perPage > 0) qp.set("per_page", String(params.perPage));
  if (params.q && params.q.trim().length > 0) qp.set("q", params.q.trim());
  if (params.status && params.status.trim().length > 0) qp.set("status", params.status.trim());

  const query = qp.toString();
  const path = query ? `${basePath(business)}?${query}` : basePath(business);
  const raw = await apiFetch<unknown>(path);
  const items = getCollection(raw).map(normalizePurchaseOrder);
  const meta = getMeta(raw, items.length);

  return {
    items,
    currentPage: meta.currentPage,
    perPage: meta.perPage,
    total: meta.total,
    lastPage: meta.lastPage,
  };
}

export async function getPurchaseOrder(
  business: string,
  purchaseOrderId: string
): Promise<PurchaseOrder> {
  const raw = await apiFetch<unknown>(`${basePath(business)}/${encodeURIComponent(purchaseOrderId)}`);
  return normalizePurchaseOrder(getResource(raw));
}

export async function createPurchaseOrder(
  business: string,
  input: CreatePurchaseOrderInput
): Promise<PurchaseOrder> {
  const raw = await apiFetch<unknown>(basePath(business), {
    method: "POST",
    json: toPayload(input),
  });
  return normalizePurchaseOrder(getResource(raw));
}

export async function updatePurchaseOrder(
  business: string,
  purchaseOrderId: string,
  input: UpdatePurchaseOrderInput
): Promise<PurchaseOrder> {
  const raw = await apiFetch<unknown>(`${basePath(business)}/${encodeURIComponent(purchaseOrderId)}`, {
    method: "PATCH",
    json: toPayload(input),
  });
  return normalizePurchaseOrder(getResource(raw));
}

export async function receivePurchaseOrder(
  business: string,
  purchaseOrderId: string
): Promise<PurchaseOrder> {
  const raw = await apiFetch<unknown>(`${basePath(business)}/${encodeURIComponent(purchaseOrderId)}/receive`, {
    method: "POST",
  });
  return normalizePurchaseOrder(getResource(raw));
}

export async function cancelPurchaseOrder(business: string, purchaseOrderId: string): Promise<void> {
  await apiFetch<unknown>(`${basePath(business)}/${encodeURIComponent(purchaseOrderId)}`, {
    method: "DELETE",
  });
}
