import { apiFetch } from "./api";

export type HotelOrderStatus = "pending" | "on_hold" | "completed" | "cancelled";

export type HotelOrder = {
  id: number;
  invoiceNumber: string;
  reservationId: number | null;
  status: HotelOrderStatus;
  department: string;
  note: string | null;
  paymentMethod: string | null;
  totalAmount: number;
  currency: string;
  exchangeRate: number;
  paidAmount: number;
  createdAt: string | null;
  updatedAt: string | null;
  room: {
    id: number;
    name: string;
    roomNumber: string;
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
    product: {
      id: number;
      name: string;
      sku: string;
      type: string;
    } | null;
  }>;
  canConfirm: boolean;
  canCancel: boolean;
};

export type HotelOrdersResult = {
  items: HotelOrder[];
  currentPage: number;
  perPage: number;
  total: number;
  lastPage: number;
};

export type ListHotelOrdersParams = {
  page?: number;
  perPage?: number;
  q?: string;
  status?: HotelOrderStatus | "";
  reservationId?: number;
  roomId?: number;
  customerId?: number;
};

export type CreateHotelOrderInput = {
  roomId: number;
  reservationId?: number | null;
  customerId?: number | null;
  note?: string;
  totalAmount?: number;
  items: Array<{
    productId: number;
    quantity: number;
    unitPrice?: number;
  }>;
};

type Dict = Record<string, unknown>;

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
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return fallback;
}

function normalizeHotelOrder(raw: unknown): HotelOrder {
  const obj = isObject(raw) ? raw : {};
  const room = isObject(obj.room) ? obj.room : null;
  const customer = isObject(obj.customer) ? obj.customer : null;
  const cashier = isObject(obj.cashier) ? obj.cashier : null;
  const itemsRaw = Array.isArray(obj.items) ? obj.items : [];

  return {
    id: toNumber(obj.id, 0),
    invoiceNumber: toString(obj.invoice_number ?? obj.invoiceNumber),
    reservationId: toNumber(obj.reservation_id ?? obj.reservationId, 0) || null,
    status: (toString(obj.status, "pending") as HotelOrderStatus),
    department: toString(obj.department),
    note: toString(obj.note) || null,
    paymentMethod: toString(obj.payment_method ?? obj.paymentMethod) || null,
    totalAmount: toNumber(obj.total_amount ?? obj.totalAmount, 0),
    currency: toString(obj.currency, "HTG"),
    exchangeRate: toNumber(obj.exchange_rate ?? obj.exchangeRate, 1),
    paidAmount: toNumber(obj.paid_amount ?? obj.paidAmount, 0),
    createdAt: toString(obj.created_at ?? obj.createdAt) || null,
    updatedAt: toString(obj.updated_at ?? obj.updatedAt) || null,
    room: room
      ? {
          id: toNumber(room.id, 0),
          name: toString(room.name),
          roomNumber: toString(room.room_number ?? room.roomNumber),
          status: toString(room.status),
        }
      : null,
    customer: customer
      ? {
          id: toNumber(customer.id, 0),
          name: toString(customer.name),
          email: toString(customer.email) || null,
          phone: toString(customer.phone) || null,
        }
      : null,
    cashier: cashier
      ? {
          id: toNumber(cashier.id, 0),
          name: toString(cashier.name),
          email: toString(cashier.email) || null,
        }
      : null,
    itemsCount: toNumber(obj.items_count ?? obj.itemsCount, itemsRaw.length),
    items: itemsRaw.map((itemRaw) => {
      const item = isObject(itemRaw) ? itemRaw : {};
      const product = isObject(item.product) ? item.product : null;
      return {
        id: toNumber(item.id, 0),
        quantity: toNumber(item.quantity, 0),
        unitPrice: toNumber(item.unit_price ?? item.unitPrice, 0),
        subtotal: toNumber(item.subtotal, 0),
        product: product
          ? {
              id: toNumber(product.id, 0),
              name: toString(product.name),
              sku: toString(product.sku),
              type: toString(product.type),
            }
          : null,
      };
    }),
    canConfirm: toBool(obj.can_confirm ?? obj.canConfirm, false),
    canCancel: toBool(obj.can_cancel ?? obj.canCancel, false),
  };
}

function businessBasePath(business: string): string {
  return `/api/app/${encodeURIComponent(business)}/hotel/orders`;
}

export async function listHotelOrders(
  business: string,
  params: ListHotelOrdersParams = {}
): Promise<HotelOrdersResult> {
  const qp = new URLSearchParams();
  if (params.page && params.page > 0) qp.set("page", String(params.page));
  if (params.perPage && params.perPage > 0) qp.set("per_page", String(params.perPage));
  if (params.q && params.q.trim().length > 0) qp.set("q", params.q.trim());
  if (params.status && params.status.trim().length > 0) qp.set("status", params.status.trim());
  if (params.reservationId && params.reservationId > 0) qp.set("reservation_id", String(params.reservationId));
  if (params.roomId && params.roomId > 0) qp.set("room_id", String(params.roomId));
  if (params.customerId && params.customerId > 0) qp.set("customer_id", String(params.customerId));

  const path = qp.size > 0 ? `${businessBasePath(business)}?${qp.toString()}` : businessBasePath(business);
  const raw = await apiFetch<unknown>(path);
  const root = isObject(raw) ? raw : {};
  const data = isObject(root.data) ? root.data : {};
  const meta = isObject(root.meta) ? root.meta : {};
  const itemsRaw = Array.isArray(data.items) ? data.items : [];

  return {
    items: itemsRaw.map(normalizeHotelOrder),
    currentPage: Math.max(1, toNumber(meta.current_page ?? meta.currentPage, 1)),
    perPage: Math.max(1, toNumber(meta.per_page ?? meta.perPage, itemsRaw.length || 20)),
    total: Math.max(0, toNumber(meta.total, itemsRaw.length)),
    lastPage: Math.max(1, toNumber(meta.last_page ?? meta.lastPage, 1)),
  };
}

export async function createHotelOrder(
  business: string,
  input: CreateHotelOrderInput
): Promise<HotelOrder> {
  const raw = await apiFetch<unknown>(businessBasePath(business), {
    method: "POST",
    json: {
      room_id: input.roomId,
      reservation_id: input.reservationId ?? undefined,
      customer_id: input.customerId ?? undefined,
      status: "pending",
      note: input.note ?? "",
      total_amount: input.totalAmount,
      items: input.items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      })),
    },
  });
  const root = isObject(raw) ? raw : {};
  return normalizeHotelOrder(isObject(root.order) ? root.order : root);
}

export async function updateHotelOrderStatus(
  business: string,
  orderId: number,
  input: {
    status: "completed" | "cancelled";
    paymentMethod?: "cash" | "card" | "mobile" | "bank" | "other";
    note?: string;
  }
): Promise<HotelOrder> {
  const raw = await apiFetch<unknown>(`${businessBasePath(business)}/${encodeURIComponent(String(orderId))}/status`, {
    method: "PATCH",
    json: {
      status: input.status,
      payment_method: input.paymentMethod,
      note: input.note,
    },
  });
  const root = isObject(raw) ? raw : {};
  return normalizeHotelOrder(isObject(root.order) ? root.order : root);
}
