import { ApiError, apiFetch, getToken } from "./api";

type Dict = Record<string, unknown>;

export type InventorySummary = {
  totalProducts: number;
  trackedProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  stockUnits: number;
  stockValue: number;
  potentialRevenue: number;
};

export type LowStockProduct = {
  id: string;
  name: string;
  sku: string;
  stock: number;
  alertQuantity: number;
};

export type InventorySummaryResult = {
  summary: InventorySummary;
  lowStockProducts: LowStockProduct[];
};

export type InventoryMovement = {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  direction: "in" | "out";
  reason: string;
  quantity: number;
  unitCost: number;
  sourceType: string | null;
  sourceId: string | null;
  notes: string | null;
  createdAt: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
};

export type InventoryMovementParams = {
  page?: number;
  perPage?: number;
  q?: string;
  productId?: string | number;
  direction?: "in" | "out" | "";
  reason?: string;
  from?: string;
  to?: string;
};

export type InventoryMovementResult = {
  items: InventoryMovement[];
  currentPage: number;
  perPage: number;
  total: number;
  lastPage: number;
};

export type InventoryAdjustmentInput = {
  productId: string | number;
  operation: "increase" | "decrease" | "set";
  quantity: number;
  reason?: string;
  notes?: string;
  unitCost?: number;
};

export type InventoryAdjustmentResult = {
  product: {
    id: string;
    name: string;
    sku: string;
    oldStock: number;
    newStock: number;
  };
  movement: {
    id: string | null;
    direction: "in" | "out";
    reason: string;
    quantity: number;
    unitCost: number;
    createdBy: string | null;
    createdByName: string | null;
    createdByEmail: string | null;
  };
};

function isObject(value: unknown): value is Dict {
  return typeof value === "object" && value !== null;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

function toString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "bigint") return value.toString();
  return fallback;
}

function basePath(business: string): string {
  return `/api/app/${encodeURIComponent(business)}/inventory`;
}

function getCollection(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!isObject(raw)) return [];

  if (Array.isArray(raw.data)) return raw.data;
  if (isObject(raw.data) && Array.isArray(raw.data.data)) return raw.data.data;

  return [];
}

function normalizeSummary(raw: unknown): InventorySummaryResult {
  const obj = isObject(raw) ? raw : {};
  const summaryRaw = isObject(obj.summary) ? obj.summary : {};
  const lowRaw = Array.isArray(obj.low_stock_products) ? obj.low_stock_products : [];

  return {
    summary: {
      totalProducts: toNumber(summaryRaw.total_products, 0),
      trackedProducts: toNumber(summaryRaw.tracked_products, 0),
      lowStockCount: toNumber(summaryRaw.low_stock_count, 0),
      outOfStockCount: toNumber(summaryRaw.out_of_stock_count, 0),
      stockUnits: toNumber(summaryRaw.stock_units, 0),
      stockValue: toNumber(summaryRaw.stock_value, 0),
      potentialRevenue: toNumber(summaryRaw.potential_revenue, 0),
    },
    lowStockProducts: lowRaw.map((item) => {
      const row = isObject(item) ? item : {};
      return {
        id: toString(row.id, ""),
        name: toString(row.name, "Produit"),
        sku: toString(row.sku, ""),
        stock: toNumber(row.stock, 0),
        alertQuantity: toNumber(row.alert_quantity, 0),
      };
    }),
  };
}

function normalizeMovement(raw: unknown): InventoryMovement {
  const obj = isObject(raw) ? raw : {};
  const direction = toString(obj.direction, "in").toLowerCase();

  return {
    id: toString(obj.id, `M-${Date.now()}`),
    productId: toString(obj.product_id, ""),
    productName: toString(obj.product_name, "Produit"),
    productSku: toString(obj.product_sku, ""),
    direction: direction === "out" ? "out" : "in",
    reason: toString(obj.reason, ""),
    quantity: toNumber(obj.quantity, 0),
    unitCost: toNumber(obj.unit_cost, 0),
    sourceType: toString(obj.source_type, "") || null,
    sourceId: toString(obj.source_id, "") || null,
    notes: toString(obj.notes, "") || null,
    createdAt: toString(obj.created_at, "") || null,
    createdBy: toString(obj.created_by, "") || null,
    createdByName: toString(obj.created_by_name, "") || null,
    createdByEmail: toString(obj.created_by_email, "") || null,
  };
}

function normalizeMovementResult(raw: unknown): InventoryMovementResult {
  const obj = isObject(raw) ? raw : {};
  const items = getCollection(raw).map(normalizeMovement);
  const meta = isObject(obj.meta) ? obj.meta : {};

  return {
    items,
    currentPage: Math.max(1, Math.trunc(toNumber(meta.current_page, 1))),
    perPage: Math.max(1, Math.trunc(toNumber(meta.per_page, items.length || 20))),
    total: Math.max(0, Math.trunc(toNumber(meta.total, items.length))),
    lastPage: Math.max(1, Math.trunc(toNumber(meta.last_page, 1))),
  };
}

function normalizeAdjustment(raw: unknown): InventoryAdjustmentResult {
  const obj = isObject(raw) ? raw : {};
  const data = isObject(obj.data) ? obj.data : {};
  const product = isObject(data.product) ? data.product : {};
  const movement = isObject(data.movement) ? data.movement : {};
  const direction = toString(movement.direction, "in").toLowerCase();

  return {
    product: {
      id: toString(product.id, ""),
      name: toString(product.name, "Produit"),
      sku: toString(product.sku, ""),
      oldStock: toNumber(product.old_stock, 0),
      newStock: toNumber(product.new_stock, 0),
    },
    movement: {
      id: toString(movement.id, "") || null,
      direction: direction === "out" ? "out" : "in",
      reason: toString(movement.reason, ""),
      quantity: toNumber(movement.quantity, 0),
      unitCost: toNumber(movement.unit_cost, 0),
      createdBy: toString(movement.created_by, "") || null,
      createdByName: toString(movement.created_by_name, "") || null,
      createdByEmail: toString(movement.created_by_email, "") || null,
    },
  };
}

export async function getInventorySummary(
  business: string,
  search = ""
): Promise<InventorySummaryResult> {
  const qp = new URLSearchParams();
  if (search.trim().length > 0) qp.set("q", search.trim());
  const query = qp.toString();
  const path = query ? `${basePath(business)}/summary?${query}` : `${basePath(business)}/summary`;
  const raw = await apiFetch<unknown>(path);
  return normalizeSummary(raw);
}

export async function listInventoryMovements(
  business: string,
  params: InventoryMovementParams = {}
): Promise<InventoryMovementResult> {
  const qp = new URLSearchParams();
  if (params.page && params.page > 0) qp.set("page", String(params.page));
  if (params.perPage && params.perPage > 0) qp.set("per_page", String(params.perPage));
  if (params.q && params.q.trim().length > 0) qp.set("q", params.q.trim());
  if (params.productId !== undefined && params.productId !== null && String(params.productId).trim() !== "") {
    qp.set("product_id", String(params.productId));
  }
  if (params.direction && params.direction.trim().length > 0) qp.set("direction", params.direction);
  if (params.reason && params.reason.trim().length > 0) qp.set("reason", params.reason.trim());
  if (params.from && params.from.trim().length > 0) qp.set("from", params.from.trim());
  if (params.to && params.to.trim().length > 0) qp.set("to", params.to.trim());

  const query = qp.toString();
  const path = query ? `${basePath(business)}/movements?${query}` : `${basePath(business)}/movements`;
  const raw = await apiFetch<unknown>(path);
  return normalizeMovementResult(raw);
}

export async function adjustInventoryStock(
  business: string,
  input: InventoryAdjustmentInput
): Promise<InventoryAdjustmentResult> {
  const raw = await apiFetch<unknown>(`${basePath(business)}/adjustments`, {
    method: "POST",
    json: {
      product_id: input.productId,
      operation: input.operation,
      quantity: input.quantity,
      reason: input.reason ?? null,
      notes: input.notes ?? null,
      unit_cost: input.unitCost ?? null,
    },
  });
  return normalizeAdjustment(raw);
}

export async function exportInventoryMovementsCsv(
  business: string,
  params: InventoryMovementParams = {}
): Promise<string> {
  const qp = new URLSearchParams();
  if (params.q && params.q.trim().length > 0) qp.set("q", params.q.trim());
  if (params.productId !== undefined && params.productId !== null && String(params.productId).trim() !== "") {
    qp.set("product_id", String(params.productId));
  }
  if (params.direction && params.direction.trim().length > 0) qp.set("direction", params.direction);
  if (params.reason && params.reason.trim().length > 0) qp.set("reason", params.reason.trim());
  if (params.from && params.from.trim().length > 0) qp.set("from", params.from.trim());
  if (params.to && params.to.trim().length > 0) qp.set("to", params.to.trim());

  const query = qp.toString();
  const path = query ? `${basePath(business)}/movements.csv?${query}` : `${basePath(business)}/movements.csv`;

  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
  const token = getToken();

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "text/csv",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const bodyText = await res.text();
  if (!res.ok) {
    let body: unknown = bodyText;
    try {
      body = JSON.parse(bodyText);
    } catch {
      // keep text body
    }
    throw new ApiError(res.status, body);
  }

  return bodyText;
}
