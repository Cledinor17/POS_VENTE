import { apiFetch } from "./api";

type Dict = Record<string, unknown>;

function isObj(v: unknown): v is Dict {
  return typeof v === "object" && v !== null;
}
function toStr(v: unknown, fb = ""): string {
  return typeof v === "string" ? v : fb;
}
function toNum(v: unknown, fb = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fb;
}
function toBool(v: unknown, fb = false): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "1" || s === "true") return true;
    if (s === "0" || s === "false") return false;
  }
  return fb;
}

// ─── Types ────────────────────────────────────────────────────────────────

export type RestaurantTableStatus = "available" | "occupied" | "reserved" | "cleaning";

export type RestaurantTable = {
  id: number;
  name: string;
  number: string;
  capacity: number;
  section: string | null;
  floor: string | null;
  status: RestaurantTableStatus;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type RestaurantOrderStatus = "pending" | "on_hold" | "completed" | "cancelled";

export type RestaurantOrder = {
  id: number;
  invoiceNumber: string;
  status: RestaurantOrderStatus;
  department: string;
  note: string | null;
  paymentMethod: string | null;
  totalAmount: number;
  currency: string;
  exchangeRate: number;
  paidAmount: number;
  createdAt: string | null;
  updatedAt: string | null;
  table: {
    id: number;
    name: string;
    number: string;
    section: string | null;
    status: string;
  } | null;
  customer: {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
  cashier: {
    id: number;
    name: string;
    email: string | null;
  } | null;
  itemsCount: number;
  items: Array<{
    id: number;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    product: { id: number; name: string; sku: string; type: string } | null;
  }>;
  canConfirm: boolean;
  canCancel: boolean;
};

export type RestaurantOrdersResult = {
  items: RestaurantOrder[];
  currentPage: number;
  perPage: number;
  total: number;
  lastPage: number;
};

// ─── Normalizers ──────────────────────────────────────────────────────────

function normalizeTable(raw: unknown): RestaurantTable {
  const o = isObj(raw) ? raw : {};
  return {
    id: toNum(o.id, 0),
    name: toStr(o.name),
    number: toStr(o.number),
    capacity: toNum(o.capacity, 4),
    section: toStr(o.section) || null,
    floor: toStr(o.floor) || null,
    status: (toStr(o.status, "available") as RestaurantTableStatus),
    isActive: toBool(o.is_active ?? o.isActive, true),
    createdAt: toStr(o.created_at ?? o.createdAt) || null,
    updatedAt: toStr(o.updated_at ?? o.updatedAt) || null,
  };
}

function normalizeOrder(raw: unknown): RestaurantOrder {
  const o = isObj(raw) ? raw : {};
  const table = isObj(o.table) ? o.table : null;
  const customer = isObj(o.customer) ? o.customer : null;
  const cashier = isObj(o.cashier) ? o.cashier : null;
  const itemsRaw = Array.isArray(o.items) ? o.items : [];

  return {
    id: toNum(o.id, 0),
    invoiceNumber: toStr(o.invoice_number ?? o.invoiceNumber),
    status: (toStr(o.status, "pending") as RestaurantOrderStatus),
    department: toStr(o.department, "restaurant"),
    note: toStr(o.note) || null,
    paymentMethod: toStr(o.payment_method ?? o.paymentMethod) || null,
    totalAmount: toNum(o.total_amount ?? o.totalAmount, 0),
    currency: toStr(o.currency, "HTG"),
    exchangeRate: toNum(o.exchange_rate ?? o.exchangeRate, 1),
    paidAmount: toNum(o.paid_amount ?? o.paidAmount, 0),
    createdAt: toStr(o.created_at ?? o.createdAt) || null,
    updatedAt: toStr(o.updated_at ?? o.updatedAt) || null,
    table: table ? {
      id: toNum(table.id, 0),
      name: toStr(table.name),
      number: toStr(table.number),
      section: toStr(table.section) || null,
      status: toStr(table.status),
    } : null,
    customer: customer ? {
      id: toNum(customer.id, 0),
      name: toStr(customer.name),
      email: toStr(customer.email) || null,
      phone: toStr(customer.phone) || null,
    } : null,
    cashier: cashier ? {
      id: toNum(cashier.id, 0),
      name: toStr(cashier.name),
      email: toStr(cashier.email) || null,
    } : null,
    itemsCount: toNum(o.items_count ?? o.itemsCount, itemsRaw.length),
    items: itemsRaw.map((r) => {
      const item = isObj(r) ? r : {};
      const product = isObj(item.product) ? item.product : null;
      return {
        id: toNum(item.id, 0),
        quantity: toNum(item.quantity, 0),
        unitPrice: toNum(item.unit_price ?? item.unitPrice, 0),
        subtotal: toNum(item.subtotal, 0),
        product: product ? {
          id: toNum(product.id, 0),
          name: toStr(product.name),
          sku: toStr(product.sku),
          type: toStr(product.type),
        } : null,
      };
    }),
    canConfirm: toBool(o.can_confirm ?? o.canConfirm, false),
    canCancel: toBool(o.can_cancel ?? o.canCancel, false),
  };
}

// ─── Tables API ───────────────────────────────────────────────────────────

const tablesBase = (business: string) =>
  `/api/app/${encodeURIComponent(business)}/restaurant/tables`;

export async function getRestaurantTables(business: string): Promise<RestaurantTable[]> {
  const raw = await apiFetch<unknown>(tablesBase(business));
  const root = isObj(raw) ? raw : {};
  const items = Array.isArray(root.data) ? root.data : [];
  return items.map(normalizeTable);
}

export type CreateRestaurantTableInput = {
  name: string;
  number: string;
  capacity?: number;
  section?: string | null;
  floor?: string | null;
  status?: RestaurantTableStatus;
};

export async function createRestaurantTable(
  business: string,
  input: CreateRestaurantTableInput
): Promise<RestaurantTable> {
  const raw = await apiFetch<unknown>(tablesBase(business), { method: "POST", json: input });
  const root = isObj(raw) ? raw : {};
  return normalizeTable(isObj(root.table) ? root.table : root);
}

export async function updateRestaurantTable(
  business: string,
  tableId: number,
  input: Partial<CreateRestaurantTableInput> & { isActive?: boolean }
): Promise<RestaurantTable> {
  const body: Dict = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.number !== undefined) body.number = input.number;
  if (input.capacity !== undefined) body.capacity = input.capacity;
  if (input.section !== undefined) body.section = input.section;
  if (input.floor !== undefined) body.floor = input.floor;
  if (input.status !== undefined) body.status = input.status;
  if (input.isActive !== undefined) body.is_active = input.isActive;

  const raw = await apiFetch<unknown>(
    `${tablesBase(business)}/${encodeURIComponent(String(tableId))}`,
    { method: "PUT", json: body }
  );
  const root = isObj(raw) ? raw : {};
  return normalizeTable(isObj(root.table) ? root.table : root);
}

export async function deleteRestaurantTable(business: string, tableId: number): Promise<void> {
  await apiFetch<unknown>(
    `${tablesBase(business)}/${encodeURIComponent(String(tableId))}`,
    { method: "DELETE" }
  );
}

// ─── Restaurant Orders API ────────────────────────────────────────────────

const ordersBase = (business: string) =>
  `/api/app/${encodeURIComponent(business)}/restaurant/orders`;

export type ListRestaurantOrdersParams = {
  page?: number;
  perPage?: number;
  q?: string;
  status?: RestaurantOrderStatus | "";
  tableId?: number;
};

export async function listRestaurantOrders(
  business: string,
  params: ListRestaurantOrdersParams = {}
): Promise<RestaurantOrdersResult> {
  const qp = new URLSearchParams();
  if (params.page && params.page > 0) qp.set("page", String(params.page));
  if (params.perPage && params.perPage > 0) qp.set("per_page", String(params.perPage));
  if (params.q?.trim()) qp.set("q", params.q.trim());
  if (params.status?.trim()) qp.set("status", params.status.trim());
  if (params.tableId && params.tableId > 0) qp.set("table_id", String(params.tableId));

  const path = qp.size > 0 ? `${ordersBase(business)}?${qp}` : ordersBase(business);
  const raw = await apiFetch<unknown>(path);
  const root = isObj(raw) ? raw : {};
  const data = isObj(root.data) ? root.data : {};
  const meta = isObj(root.meta) ? root.meta : {};
  const itemsRaw = Array.isArray(data.items) ? data.items : [];

  return {
    items: itemsRaw.map(normalizeOrder),
    currentPage: Math.max(1, toNum(meta.current_page, 1)),
    perPage: Math.max(1, toNum(meta.per_page, 20)),
    total: Math.max(0, toNum(meta.total, 0)),
    lastPage: Math.max(1, toNum(meta.last_page, 1)),
  };
}

export type CreateRestaurantOrderInput = {
  tableId: number;
  customerId?: number | null;
  note?: string;
  currency?: string;
  items: Array<{ productId: number; quantity: number; unitPrice?: number }>;
};

export async function createRestaurantOrder(
  business: string,
  input: CreateRestaurantOrderInput
): Promise<RestaurantOrder> {
  const raw = await apiFetch<unknown>(ordersBase(business), {
    method: "POST",
    json: {
      table_id: input.tableId,
      customer_id: input.customerId ?? undefined,
      status: "pending",
      note: input.note ?? "",
      currency: input.currency,
      items: input.items.map((i) => ({
        product_id: i.productId,
        quantity: i.quantity,
        unit_price: i.unitPrice,
      })),
    },
  });
  const root = isObj(raw) ? raw : {};
  return normalizeOrder(isObj(root.order) ? root.order : root);
}

export async function updateRestaurantOrderStatus(
  business: string,
  orderId: number,
  input: { status: "completed" | "cancelled"; paymentMethod?: string; note?: string }
): Promise<RestaurantOrder> {
  const raw = await apiFetch<unknown>(
    `${ordersBase(business)}/${encodeURIComponent(String(orderId))}/status`,
    {
      method: "PATCH",
      json: {
        status: input.status,
        payment_method: input.paymentMethod,
        note: input.note,
      },
    }
  );
  const root = isObj(raw) ? raw : {};
  return normalizeOrder(isObj(root.order) ? root.order : root);
}
