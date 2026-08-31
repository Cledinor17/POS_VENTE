import { apiFetch, apiFetchBlob } from "./api";

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

export type PoolTicketType = "day_pass" | "hour_pass" | "month_pass" | "resident";
export type PoolTicketStatus = "active" | "completed" | "cancelled";

export const POOL_TICKET_TYPE_LABELS: Record<PoolTicketType, string> = {
  day_pass: "Pass journee",
  hour_pass: "Pass horaire",
  month_pass: "Abonnement mensuel",
  resident: "Resident hotel",
};

export type PoolTicket = {
  id: number;
  ticketNumber: string;
  customerId: number | null;
  customerName: string | null;
  guestName: string | null;
  ticketType: PoolTicketType;
  persons: number;
  price: number;
  currency: string;
  exchangeRate: number;
  paymentMethod: string | null;
  entryAt: string | null;
  exitAt: string | null;
  durationMinutes: number | null;
  status: PoolTicketStatus;
  note: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type PoolTicketsResult = {
  items: PoolTicket[];
  currentPage: number;
  perPage: number;
  total: number;
  lastPage: number;
  todayActive: number;
  todayRevenue: number;
  todayRevenueCurrency: string;
};

function normalizeTicket(raw: unknown): PoolTicket {
  const o = isObj(raw) ? raw : {};
  return {
    id: toNum(o.id, 0),
    ticketNumber: toStr(o.ticket_number ?? o.ticketNumber),
    customerId: o.customer_id ? toNum(o.customer_id, 0) : null,
    customerName: toStr(o.customer_name ?? o.customerName) || null,
    guestName: toStr(o.guest_name ?? o.guestName) || null,
    ticketType: (toStr(o.ticket_type ?? o.ticketType, "day_pass") as PoolTicketType),
    persons: toNum(o.persons, 1),
    price: toNum(o.price, 0),
    currency: toStr(o.currency, "HTG"),
    exchangeRate: toNum(o.exchange_rate ?? o.exchangeRate, 1),
    paymentMethod: toStr(o.payment_method ?? o.paymentMethod) || null,
    entryAt: toStr(o.entry_at ?? o.entryAt) || null,
    exitAt: toStr(o.exit_at ?? o.exitAt) || null,
    durationMinutes: o.duration_minutes != null ? toNum(o.duration_minutes, 0) : null,
    status: (toStr(o.status, "active") as PoolTicketStatus),
    note: toStr(o.note) || null,
    createdAt: toStr(o.created_at ?? o.createdAt) || null,
    updatedAt: toStr(o.updated_at ?? o.updatedAt) || null,
  };
}

const base = (business: string) =>
  `/api/app/${encodeURIComponent(business)}/pool/tickets`;

export type ListPoolTicketsParams = {
  page?: number;
  perPage?: number;
  q?: string;
  status?: PoolTicketStatus | "";
  type?: PoolTicketType | "";
  date?: string;
};

export async function listPoolTickets(
  business: string,
  params: ListPoolTicketsParams = {}
): Promise<PoolTicketsResult> {
  const qp = new URLSearchParams();
  if (params.page && params.page > 0) qp.set("page", String(params.page));
  if (params.perPage && params.perPage > 0) qp.set("per_page", String(params.perPage));
  if (params.q?.trim()) qp.set("q", params.q.trim());
  if (params.status?.trim()) qp.set("status", params.status.trim());
  if (params.type?.trim()) qp.set("type", params.type.trim());
  if (params.date?.trim()) qp.set("date", params.date.trim());

  const path = qp.size > 0 ? `${base(business)}?${qp}` : base(business);
  const raw = await apiFetch<unknown>(path);
  const root = isObj(raw) ? raw : {};
  const data = isObj(root.data) ? root.data : {};
  const meta = isObj(root.meta) ? root.meta : {};
  const itemsRaw = Array.isArray(data.items) ? data.items : [];

  return {
    items: itemsRaw.map(normalizeTicket),
    currentPage: Math.max(1, toNum(meta.current_page, 1)),
    perPage: Math.max(1, toNum(meta.per_page, 25)),
    total: Math.max(0, toNum(meta.total, 0)),
    lastPage: Math.max(1, toNum(meta.last_page, 1)),
    todayActive: toNum(meta.today_active, 0),
    todayRevenue: toNum(meta.today_revenue, 0),
    todayRevenueCurrency: toStr(meta.today_revenue_currency, "HTG"),
  };
}

export type CreatePoolTicketInput = {
  customerId?: number | null;
  guestName?: string;
  ticketType?: PoolTicketType;
  persons?: number;
  price?: number;
  currency?: string;
  paymentMethod?: string;
  entryAt?: string;
  note?: string;
};

export async function createPoolTicket(
  business: string,
  input: CreatePoolTicketInput
): Promise<PoolTicket> {
  const raw = await apiFetch<unknown>(base(business), {
    method: "POST",
    json: {
      customer_id: input.customerId ?? undefined,
      guest_name: input.guestName ?? undefined,
      ticket_type: input.ticketType ?? "day_pass",
      persons: input.persons ?? 1,
      price: input.price ?? 0,
      currency: input.currency ?? "HTG",
      payment_method: input.paymentMethod ?? "cash",
      entry_at: input.entryAt ?? undefined,
      note: input.note ?? undefined,
    },
  });
  const root = isObj(raw) ? raw : {};
  return normalizeTicket(isObj(root.ticket) ? root.ticket : root);
}

export async function recordPoolExit(
  business: string,
  ticketId: number,
  exitAt?: string
): Promise<PoolTicket> {
  const raw = await apiFetch<unknown>(
    `${base(business)}/${encodeURIComponent(String(ticketId))}/exit`,
    { method: "PATCH", json: { exit_at: exitAt ?? undefined } }
  );
  const root = isObj(raw) ? raw : {};
  return normalizeTicket(isObj(root.ticket) ? root.ticket : root);
}

export async function cancelPoolTicket(
  business: string,
  ticketId: number
): Promise<PoolTicket> {
  const raw = await apiFetch<unknown>(
    `${base(business)}/${encodeURIComponent(String(ticketId))}/cancel`,
    { method: "PATCH", json: {} }
  );
  const root = isObj(raw) ? raw : {};
  return normalizeTicket(isObj(root.ticket) ? root.ticket : root);
}


export async function downloadPoolTicketPdf(business: string, ticketId: number): Promise<Blob> {
  return apiFetchBlob(`/api/app/${encodeURIComponent(business)}/pool-tickets/${ticketId}/pdf`);
}
