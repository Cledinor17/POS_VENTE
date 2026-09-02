import { apiFetch } from "./api";

type Dict = Record<string, unknown>;

export type StockTransferStatus = "sent" | "received" | "cancelled";

export type StockTransferItem = {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  receivedQuantity: number | null;
};

export type StockTransfer = {
  id: string;
  reference: string;
  status: StockTransferStatus;
  fromBranchId: string;
  fromBranchName: string;
  toBranchId: string;
  toBranchName: string;
  notes: string | null;
  sentAt: string | null;
  sentBy: string | null;
  receivedAt: string | null;
  receivedBy: string | null;
  hasDiscrepancy: boolean;
  items: StockTransferItem[];
};

export type StockTransferListResult = {
  items: StockTransfer[];
  currentPage: number;
  lastPage: number;
  total: number;
};

export type CreateStockTransferInput = {
  toBranchId: string;
  notes?: string;
  items: Array<{ productId: string; quantity: number }>;
};

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
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

function basePath(business: string): string {
  return `/api/app/${encodeURIComponent(business)}/stock-transfers`;
}

function normalizeStatus(value: unknown): StockTransferStatus {
  const raw = toString(value, "sent");
  return raw === "received" || raw === "cancelled" ? raw : "sent";
}

function normalizeItem(raw: unknown): StockTransferItem {
  const obj = isObject(raw) ? raw : {};
  const received = obj.received_quantity;

  return {
    id: toString(obj.id, ""),
    productId: toString(obj.product_id, ""),
    productName: toString(obj.product_name, ""),
    productSku: toString(obj.product_sku, ""),
    quantity: toNumber(obj.quantity, 0),
    receivedQuantity: received === null || received === undefined ? null : toNumber(received, 0),
  };
}

function normalizeTransfer(raw: unknown): StockTransfer {
  const obj = isObject(raw) ? raw : {};
  const from = isObject(obj.from_branch) ? obj.from_branch : {};
  const to = isObject(obj.to_branch) ? obj.to_branch : {};

  return {
    id: toString(obj.id, ""),
    reference: toString(obj.reference, ""),
    status: normalizeStatus(obj.status),
    fromBranchId: toString(from.id, ""),
    fromBranchName: toString(from.name, "-"),
    toBranchId: toString(to.id, ""),
    toBranchName: toString(to.name, "-"),
    notes: toString(obj.notes, "") || null,
    sentAt: toString(obj.sent_at, "") || null,
    sentBy: toString(obj.sent_by, "") || null,
    receivedAt: toString(obj.received_at, "") || null,
    receivedBy: toString(obj.received_by, "") || null,
    hasDiscrepancy: Boolean(obj.has_discrepancy),
    items: Array.isArray(obj.items) ? obj.items.map(normalizeItem) : [],
  };
}

export async function listStockTransfers(
  business: string,
  params: { page?: number; status?: string; direction?: "incoming" | "outgoing" } = {},
): Promise<StockTransferListResult> {
  const qp = new URLSearchParams();
  if (params.page && params.page > 0) qp.set("page", String(params.page));
  if (params.status) qp.set("status", params.status);
  if (params.direction) qp.set("direction", params.direction);

  const query = qp.toString();
  const raw = await apiFetch<unknown>(query ? `${basePath(business)}?${query}` : basePath(business));
  const obj = isObject(raw) ? raw : {};
  const meta = isObject(obj.meta) ? obj.meta : {};

  return {
    items: Array.isArray(obj.data) ? obj.data.map(normalizeTransfer) : [],
    currentPage: toNumber(meta.current_page, 1),
    lastPage: toNumber(meta.last_page, 1),
    total: toNumber(meta.total, 0),
  };
}

export async function createStockTransfer(
  business: string,
  input: CreateStockTransferInput,
): Promise<StockTransfer> {
  const raw = await apiFetch<unknown>(basePath(business), {
    method: "POST",
    json: {
      to_branch_id: Number(input.toBranchId),
      notes: input.notes || null,
      items: input.items.map((item) => ({
        product_id: Number(item.productId),
        quantity: item.quantity,
      })),
    },
  });

  const obj = isObject(raw) ? raw : {};
  return normalizeTransfer(obj.stock_transfer ?? obj);
}

export async function receiveStockTransfer(
  business: string,
  transferId: string,
  items?: Array<{ id: string; receivedQuantity: number }>,
): Promise<StockTransfer> {
  const raw = await apiFetch<unknown>(`${basePath(business)}/${encodeURIComponent(transferId)}/receive`, {
    method: "POST",
    json: items
      ? { items: items.map((item) => ({ id: Number(item.id), received_quantity: item.receivedQuantity })) }
      : {},
  });

  const obj = isObject(raw) ? raw : {};
  return normalizeTransfer(obj.stock_transfer ?? obj);
}

export async function cancelStockTransfer(
  business: string,
  transferId: string,
): Promise<StockTransfer> {
  const raw = await apiFetch<unknown>(`${basePath(business)}/${encodeURIComponent(transferId)}/cancel`, {
    method: "POST",
  });

  const obj = isObject(raw) ? raw : {};
  return normalizeTransfer(obj.stock_transfer ?? obj);
}
