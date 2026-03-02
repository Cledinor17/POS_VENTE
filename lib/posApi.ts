import { ApiError, apiFetch } from "./api";

export type PosCartItem = {
  productId: string;
  name: string;
  sku: string;
  price: number;
  qty: number;
  type: "product" | "service";
  stock: number;
  taxRate: number;
  imagePath: string | null;
};

export type PosParkedCart = {
  id: string;
  note: string;
  createdAt: string;
  items: PosCartItem[];
};

export type PosPaymentMethodConfig = {
  id: string;
  label: string;
  active: boolean;
};

export type PosCheckoutLine = {
  productId: string;
  qty: number;
  unitPrice: number;
  taxRate: number;
  type: "product" | "service";
  name?: string;
  sku?: string;
};

export type PosCheckoutInput = {
  cashierId?: string | number;
  customerId?: string | number | null;
  note?: string;
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  cashReceived?: number;
  changeAmount?: number;
  items: PosCheckoutLine[];
};

export type PosCheckoutResult = {
  saleId: string;
  receiptNo: string;
  createdAt: string;
};

export type PosSaleHistoryItem = {
  id: string;
  receiptNo: string;
  status: string;
  createdAt: string;
  issueDate: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
  voidedByName: string | null;
  voidedByEmail: string | null;
  customerName: string;
  itemsCount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  paymentMethod: string | null;
  paidTotal: number;
  refundedTotal: number;
  notes: string | null;
  canRefund: boolean;
  canVoid: boolean;
};

export type PosSaleHistoryParams = {
  page?: number;
  perPage?: number;
  q?: string;
  status?: string;
  from?: string;
  to?: string;
};

export type PosSaleHistoryResult = {
  items: PosSaleHistoryItem[];
  currentPage: number;
  perPage: number;
  total: number;
  lastPage: number;
};

export type ListAllPosSalesOptions = {
  perPage?: number;
  maxPages?: number;
};

export type PosSaleDetailItem = {
  id: string;
  productId: string | null;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
};

export type PosSaleDetailPayment = {
  id: string;
  kind: string;
  method: string;
  amount: number;
  paidAt: string | null;
  reference: string | null;
  notes: string | null;
  receivedBy: string | null;
  receivedByName: string | null;
  receivedByEmail: string | null;
};

export type PosSaleDetail = PosSaleHistoryItem & {
  items: PosSaleDetailItem[];
  payments: PosSaleDetailPayment[];
};

type Dict = Record<string, unknown>;

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
    if (normalized === "true" || normalized === "1" || normalized === "active") return true;
    if (normalized === "false" || normalized === "0" || normalized === "inactive") return false;
  }
  return fallback;
}

function isEndpointMissing(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 405 || error.status === 501);
}

function basePath(business: string): string {
  return `/api/app/${encodeURIComponent(business)}`;
}

function getCollection(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!isObject(raw)) return [];

  const data = raw.data;
  if (Array.isArray(data)) return data;
  if (isObject(data)) {
    const maybeArrays = ["items", "sales", "parked_carts", "parkedCarts", "payment_methods", "methods"];
    for (const key of maybeArrays) {
      if (Array.isArray(data[key])) return data[key] as unknown[];
    }
  }

  const directArrays = ["items", "sales", "parked_carts", "parkedCarts", "payment_methods", "methods"];
  for (const key of directArrays) {
    if (Array.isArray(raw[key])) return raw[key] as unknown[];
  }

  return [];
}

function getResource(raw: unknown, nestedKeys: string[] = []): unknown {
  if (isObject(raw) && isObject(raw.data)) {
    const data = raw.data;
    for (const key of nestedKeys) {
      if (isObject(data[key])) return data[key];
    }
    return data;
  }

  if (isObject(raw)) {
    for (const key of nestedKeys) {
      if (isObject(raw[key])) return raw[key];
    }
  }

  return raw;
}

async function tryApiFetch<T>(
  paths: string[],
  options?: RequestInit & { json?: unknown }
): Promise<T | null> {
  for (const path of paths) {
    try {
      return await apiFetch<T>(path, options);
    } catch (error) {
      if (isEndpointMissing(error)) continue;
      throw error;
    }
  }
  return null;
}

function normalizePaymentMethod(raw: unknown): PosPaymentMethodConfig {
  const obj = isObject(raw) ? raw : {};
  const id = toString(obj.id ?? obj.code ?? obj.method ?? obj.slug, "");
  const label = toString(obj.label ?? obj.name ?? obj.title, id);
  const active = toBool(obj.active ?? obj.is_active ?? obj.enabled, true);

  return { id, label, active };
}

function normalizeParkedItem(raw: unknown): PosCartItem {
  const obj = isObject(raw) ? raw : {};
  return {
    productId: toString(obj.product_id ?? obj.productId ?? obj.id, ""),
    name: toString(obj.name, "Produit"),
    sku: toString(obj.sku, ""),
    price: toNumber(obj.price ?? obj.unit_price ?? obj.selling_price, 0),
    qty: toNumber(obj.qty ?? obj.quantity, 1),
    type: toString(obj.type, "product") === "service" ? "service" : "product",
    stock: toNumber(obj.stock ?? obj.stock_quantity, 0),
    taxRate: toNumber(obj.tax_rate ?? obj.taxRate, 0),
    imagePath: toString(obj.image_path ?? obj.imagePath, "") || null,
  };
}

function normalizeParkedCart(raw: unknown): PosParkedCart {
  const obj = isObject(raw) ? raw : {};
  const itemsRaw = Array.isArray(obj.items) ? obj.items : Array.isArray(obj.lines) ? obj.lines : [];
  return {
    id: toString(obj.id ?? obj.uuid ?? obj.reference, `P-${Date.now()}`),
    note: toString(obj.note ?? obj.label ?? obj.title, "Panier en attente"),
    createdAt: toString(obj.created_at ?? obj.createdAt, new Date().toISOString()),
    items: itemsRaw.map(normalizeParkedItem),
  };
}

function normalizeCheckoutResult(raw: unknown): PosCheckoutResult {
  const resource = getResource(raw, ["sale", "order"]);
  const obj = isObject(resource) ? resource : {};
  const saleId = toString(obj.id ?? obj.sale_id ?? obj.order_id, `S-${Date.now()}`);
  const receiptNo = toString(
    obj.receipt_no ?? obj.receiptNo ?? obj.invoice_no ?? obj.reference_no,
    `TKT-${Date.now()}`
  );
  const createdAt = toString(obj.created_at ?? obj.createdAt, new Date().toISOString());
  return { saleId, receiptNo, createdAt };
}

function normalizeSaleHistoryItem(raw: unknown): PosSaleHistoryItem {
  const resource = getResource(raw, ["sale", "invoice"]);
  const obj = isObject(resource) ? resource : {};

  const total = toNumber(obj.total, 0);
  const amountPaid = toNumber(obj.amount_paid ?? obj.amountPaid, 0);
  const fallbackBalance = Math.max(0, total - amountPaid);
  const balanceDue = toNumber(obj.balance_due ?? obj.balanceDue, fallbackBalance);
  const status = toString(obj.status, "issued");

  return {
    id: toString(obj.id ?? obj.sale_id ?? obj.invoice_id, `S-${Date.now()}`),
    receiptNo: toString(
      obj.receipt_no ?? obj.receiptNo ?? obj.number ?? obj.invoice_no,
      `TKT-${Date.now()}`
    ),
    status,
    createdAt: toString(obj.created_at ?? obj.createdAt ?? obj.issue_date, new Date().toISOString()),
    issueDate: toString(obj.issue_date ?? obj.issueDate, "") || null,
    createdBy: toString(obj.created_by ?? obj.createdBy ?? obj.cashier_id ?? obj.cashierId, "") || null,
    createdByName:
      toString(obj.created_by_name ?? obj.createdByName ?? obj.cashier_name ?? obj.cashierName, "") || null,
    createdByEmail: toString(obj.created_by_email ?? obj.createdByEmail, "") || null,
    voidedAt: toString(obj.voided_at ?? obj.voidedAt, "") || null,
    voidedBy: toString(obj.voided_by ?? obj.voidedBy, "") || null,
    voidedByName: toString(obj.voided_by_name ?? obj.voidedByName, "") || null,
    voidedByEmail: toString(obj.voided_by_email ?? obj.voidedByEmail, "") || null,
    customerName: toString(
      obj.customer_name ?? obj.customerName ?? obj.customer,
      "Client comptoir"
    ),
    itemsCount: toNumber(obj.items_count ?? obj.itemsCount, 0),
    total,
    amountPaid,
    balanceDue,
    paymentMethod: toString(obj.payment_method ?? obj.paymentMethod, "") || null,
    paidTotal: toNumber(obj.paid_total ?? obj.paidTotal, amountPaid),
    refundedTotal: toNumber(obj.refunded_total ?? obj.refundedTotal, 0),
    notes: toString(obj.notes, "") || null,
    canRefund: toBool(obj.can_refund ?? obj.canRefund, status !== "void" && amountPaid > 0),
    canVoid: toBool(obj.can_void ?? obj.canVoid, status !== "void" && amountPaid <= 0),
  };
}

function normalizeSaleHistoryResult(raw: unknown): PosSaleHistoryResult {
  const items = getCollection(raw).map(normalizeSaleHistoryItem);

  let currentPage = 1;
  let perPage = items.length;
  let total = items.length;
  let lastPage = 1;

  if (isObject(raw) && isObject(raw.meta)) {
    const meta = raw.meta;
    currentPage = Math.max(1, Math.trunc(toNumber(meta.current_page ?? meta.currentPage, 1)));
    perPage = Math.max(1, Math.trunc(toNumber(meta.per_page ?? meta.perPage, items.length || 20)));
    total = Math.max(0, Math.trunc(toNumber(meta.total, items.length)));
    lastPage = Math.max(1, Math.trunc(toNumber(meta.last_page ?? meta.lastPage, 1)));
  }

  return { items, currentPage, perPage, total, lastPage };
}

function normalizeSaleDetailItem(raw: unknown): PosSaleDetailItem {
  const obj = isObject(raw) ? raw : {};
  return {
    id: toString(obj.id, `L-${Date.now()}`),
    productId: toString(obj.product_id ?? obj.productId, "") || null,
    name: toString(obj.name, "Article"),
    sku: toString(obj.sku, ""),
    quantity: toNumber(obj.quantity ?? obj.qty, 0),
    unitPrice: toNumber(obj.unit_price ?? obj.unitPrice ?? obj.price, 0),
    taxRate: toNumber(obj.tax_rate ?? obj.taxRate, 0),
    taxAmount: toNumber(obj.tax_amount ?? obj.taxAmount, 0),
    lineTotal: toNumber(obj.line_total ?? obj.lineTotal ?? obj.total, 0),
  };
}

function normalizeSaleDetailPayment(raw: unknown): PosSaleDetailPayment {
  const obj = isObject(raw) ? raw : {};
  return {
    id: toString(obj.id, `P-${Date.now()}`),
    kind: toString(obj.kind, "payment"),
    method: toString(obj.method, ""),
    amount: toNumber(obj.amount, 0),
    paidAt: toString(obj.paid_at ?? obj.paidAt, "") || null,
    reference: toString(obj.reference, "") || null,
    notes: toString(obj.notes, "") || null,
    receivedBy: toString(obj.received_by ?? obj.receivedBy, "") || null,
    receivedByName: toString(obj.received_by_name ?? obj.receivedByName, "") || null,
    receivedByEmail: toString(obj.received_by_email ?? obj.receivedByEmail, "") || null,
  };
}

function normalizeSaleDetail(raw: unknown): PosSaleDetail {
  const saleResource = getResource(raw, ["sale", "invoice"]);
  const saleObj = isObject(saleResource) ? saleResource : {};
  const base = normalizeSaleHistoryItem(saleObj);

  const itemsRaw = Array.isArray(saleObj.items) ? saleObj.items : [];
  const paymentsRaw = Array.isArray(saleObj.payments) ? saleObj.payments : [];

  return {
    ...base,
    items: itemsRaw.map(normalizeSaleDetailItem),
    payments: paymentsRaw.map(normalizeSaleDetailPayment),
  };
}

function paymentMethodPaths(business: string): string[] {
  const base = basePath(business);
  return [`${base}/pos/payment-methods`, `${base}/payment-methods`, `${base}/settings/payment-methods`];
}

function parkedCartPaths(business: string): string[] {
  const base = basePath(business);
  return [`${base}/parked-carts`, `${base}/pos/parked-carts`, `${base}/sales/parked-carts`];
}

function salePaths(business: string): string[] {
  const base = basePath(business);
  return [`${base}/sales`, `${base}/pos/sales`, `${base}/checkout`];
}

function salesBasePath(business: string): string {
  return `${basePath(business)}/sales`;
}

export async function getPosPaymentMethods(
  business: string
): Promise<PosPaymentMethodConfig[] | null> {
  const raw = await tryApiFetch<unknown>(paymentMethodPaths(business));
  if (raw === null) return null;

  const list = getCollection(raw).map(normalizePaymentMethod).filter((item) => item.id.length > 0);
  return list;
}

export async function listPosParkedCarts(business: string): Promise<PosParkedCart[] | null> {
  const raw = await tryApiFetch<unknown>(parkedCartPaths(business));
  if (raw === null) return null;

  return getCollection(raw).map(normalizeParkedCart);
}

export async function createPosParkedCart(
  business: string,
  input: Pick<PosParkedCart, "note" | "items">
): Promise<PosParkedCart | null> {
  const payload = {
    note: input.note,
    items: input.items.map((item) => ({
      product_id: item.productId,
      productId: item.productId,
      name: item.name,
      sku: item.sku,
      qty: item.qty,
      quantity: item.qty,
      unit_price: item.price,
      price: item.price,
      tax_rate: item.taxRate,
      type: item.type,
      stock_quantity: item.stock,
      image_path: item.imagePath,
    })),
  };

  const raw = await tryApiFetch<unknown>(parkedCartPaths(business), { method: "POST", json: payload });
  if (raw === null) return null;
  return normalizeParkedCart(getResource(raw, ["parked_cart", "parkedCart"]));
}

export async function deletePosParkedCart(business: string, parkedId: string): Promise<boolean> {
  const encoded = encodeURIComponent(parkedId);
  const paths = parkedCartPaths(business).map((path) => `${path}/${encoded}`);

  const result = await tryApiFetch<unknown>(paths, { method: "DELETE" });
  return result !== null;
}

export async function checkoutPosSale(
  business: string,
  input: PosCheckoutInput
): Promise<PosCheckoutResult | null> {
  const payload = {
    cashier_id: input.cashierId ?? null,
    customer_id: input.customerId ?? null,
    note: input.note ?? null,
    subtotal: input.subtotal,
    tax: input.tax,
    tax_total: input.tax,
    total: input.total,
    grand_total: input.total,
    payment_method: input.paymentMethod,
    cash_received: input.cashReceived ?? null,
    change_amount: input.changeAmount ?? null,
    payment: {
      method: input.paymentMethod,
      amount: input.total,
      cash_received: input.cashReceived ?? null,
      change_amount: input.changeAmount ?? null,
    },
    items: input.items.map((item) => ({
      product_id: item.productId,
      productId: item.productId,
      qty: item.qty,
      quantity: item.qty,
      unit_price: item.unitPrice,
      selling_price: item.unitPrice,
      price: item.unitPrice,
      tax_rate: item.taxRate,
      line_total: item.unitPrice * item.qty,
      total: item.unitPrice * item.qty,
      type: item.type,
      name: item.name,
      sku: item.sku,
    })),
  };

  const raw = await tryApiFetch<unknown>(salePaths(business), { method: "POST", json: payload });
  if (raw === null) return null;
  return normalizeCheckoutResult(raw);
}

export async function listPosSales(
  business: string,
  params: PosSaleHistoryParams = {}
): Promise<PosSaleHistoryResult> {
  const qp = new URLSearchParams();

  if (params.page && params.page > 0) qp.set("page", String(params.page));
  if (params.perPage && params.perPage > 0) qp.set("per_page", String(params.perPage));
  if (params.q && params.q.trim().length > 0) qp.set("q", params.q.trim());
  if (params.status && params.status.trim().length > 0) qp.set("status", params.status.trim());
  if (params.from && params.from.trim().length > 0) qp.set("from", params.from.trim());
  if (params.to && params.to.trim().length > 0) qp.set("to", params.to.trim());

  const queryString = qp.toString();
  const path = queryString.length > 0 ? `${salesBasePath(business)}?${queryString}` : salesBasePath(business);
  const raw = await apiFetch<unknown>(path);
  return normalizeSaleHistoryResult(raw);
}

export async function listAllPosSales(
  business: string,
  params: Omit<PosSaleHistoryParams, "page" | "perPage"> = {},
  options: ListAllPosSalesOptions = {}
): Promise<PosSaleHistoryItem[]> {
  const perPage = Math.max(1, Math.min(Math.trunc(options.perPage ?? 100), 100));
  const maxPages =
    typeof options.maxPages === "number" && Number.isFinite(options.maxPages) && options.maxPages > 0
      ? Math.trunc(options.maxPages)
      : Number.MAX_SAFE_INTEGER;

  const firstPage = await listPosSales(business, {
    ...params,
    page: 1,
    perPage,
  });

  if (firstPage.lastPage <= 1 || maxPages <= 1) {
    return firstPage.items;
  }

  const targetLastPage = Math.min(firstPage.lastPage, maxPages);
  const requests: Array<Promise<PosSaleHistoryResult>> = [];
  for (let page = 2; page <= targetLastPage; page += 1) {
    requests.push(
      listPosSales(business, {
        ...params,
        page,
        perPage,
      })
    );
  }

  const restPages = await Promise.all(requests);
  return firstPage.items.concat(...restPages.map((pageResult) => pageResult.items));
}

export async function refundPosSale(
  business: string,
  saleId: string,
  input: { amount: number; method?: string; reference?: string; notes?: string }
): Promise<PosSaleHistoryItem> {
  const raw = await apiFetch<unknown>(`${salesBasePath(business)}/${encodeURIComponent(saleId)}/refund`, {
    method: "POST",
    json: {
      amount: input.amount,
      method: input.method ?? "cash",
      reference: input.reference ?? null,
      notes: input.notes ?? null,
    },
  });
  return normalizeSaleHistoryItem(getResource(raw, ["sale", "invoice"]));
}

export async function voidPosSale(business: string, saleId: string): Promise<PosSaleHistoryItem> {
  const raw = await apiFetch<unknown>(`${salesBasePath(business)}/${encodeURIComponent(saleId)}/void`, {
    method: "POST",
  });
  return normalizeSaleHistoryItem(getResource(raw, ["sale", "invoice"]));
}

export async function getPosSaleDetail(business: string, saleId: string): Promise<PosSaleDetail> {
  const raw = await apiFetch<unknown>(`${salesBasePath(business)}/${encodeURIComponent(saleId)}`);
  return normalizeSaleDetail(raw);
}
