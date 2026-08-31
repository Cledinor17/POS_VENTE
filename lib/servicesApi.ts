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
function toBool(v: unknown, fb = false): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  return fb;
}

export type ServiceCategory = "spa" | "massage" | "laundry" | "room_service" | "transport" | "excursion" | "other";
export type BookingStatus = "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  spa: "Spa",
  massage: "Massage",
  laundry: "Blanchisserie",
  room_service: "Room service",
  transport: "Transport",
  excursion: "Excursion",
  other: "Autre",
};

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "En attente",
  confirmed: "Confirme",
  in_progress: "En cours",
  completed: "Termine",
  cancelled: "Annule",
};

export type Service = {
  id: number;
  name: string;
  description: string | null;
  category: ServiceCategory;
  price: number;
  currency: string;
  durationMinutes: number | null;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ServiceBooking = {
  id: number;
  invoiceNumber: string;
  status: BookingStatus;
  guestName: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
  currency: string;
  exchangeRate: number;
  paymentMethod: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  note: string | null;
  createdAt: string | null;
  service: { id: number; name: string; category: ServiceCategory; durationMinutes: number | null } | null;
  customer: { id: number; name: string; phone: string | null } | null;
};

export type ServiceBookingsResult = {
  items: ServiceBooking[];
  currentPage: number;
  perPage: number;
  total: number;
  lastPage: number;
};

// ─── Normalizers ──────────────────────────────────────────────────────────────

function normalizeService(raw: unknown): Service {
  const o = isObj(raw) ? raw : {};
  return {
    id: toNum(o.id),
    name: toStr(o.name),
    description: toStr(o.description) || null,
    category: (toStr(o.category, "other") as ServiceCategory),
    price: toNum(o.price),
    currency: toStr(o.currency, "HTG"),
    durationMinutes: o.duration_minutes != null ? toNum(o.duration_minutes) : null,
    isActive: toBool(o.is_active ?? o.isActive, true),
    createdAt: toStr(o.created_at ?? o.createdAt) || null,
    updatedAt: toStr(o.updated_at ?? o.updatedAt) || null,
  };
}

function normalizeBooking(raw: unknown): ServiceBooking {
  const o = isObj(raw) ? raw : {};
  const svc = isObj(o.service) ? o.service : null;
  const cust = isObj(o.customer) ? o.customer : null;
  return {
    id: toNum(o.id),
    invoiceNumber: toStr(o.invoice_number ?? o.invoiceNumber),
    status: (toStr(o.status, "pending") as BookingStatus),
    guestName: toStr(o.guest_name ?? o.guestName) || null,
    quantity: toNum(o.quantity, 1),
    unitPrice: toNum(o.unit_price ?? o.unitPrice),
    total: toNum(o.total),
    currency: toStr(o.currency, "HTG"),
    exchangeRate: toNum(o.exchange_rate ?? o.exchangeRate, 1),
    paymentMethod: toStr(o.payment_method ?? o.paymentMethod) || null,
    scheduledAt: toStr(o.scheduled_at ?? o.scheduledAt) || null,
    completedAt: toStr(o.completed_at ?? o.completedAt) || null,
    note: toStr(o.note) || null,
    createdAt: toStr(o.created_at ?? o.createdAt) || null,
    service: svc ? {
      id: toNum(svc.id),
      name: toStr(svc.name),
      category: (toStr(svc.category, "other") as ServiceCategory),
      durationMinutes: svc.duration_minutes != null ? toNum(svc.duration_minutes) : null,
    } : null,
    customer: cust ? {
      id: toNum(cust.id),
      name: toStr(cust.name),
      phone: toStr(cust.phone) || null,
    } : null,
  };
}

// ─── Catalog API ──────────────────────────────────────────────────────────────

const catalogBase = (b: string) => `/api/app/${encodeURIComponent(b)}/services/catalog`;

export async function listServices(business: string, activeOnly = false): Promise<Service[]> {
  const path = activeOnly ? `${catalogBase(business)}?active_only=1` : catalogBase(business);
  const raw = await apiFetch<unknown>(path);
  const root = isObj(raw) ? raw : {};
  const items = Array.isArray(root.data) ? root.data : [];
  return items.map(normalizeService);
}

export type CreateServiceInput = {
  name: string;
  description?: string;
  category?: ServiceCategory;
  price?: number;
  currency?: string;
  durationMinutes?: number | null;
  isActive?: boolean;
};

export async function createService(business: string, input: CreateServiceInput): Promise<Service> {
  const raw = await apiFetch<unknown>(catalogBase(business), {
    method: "POST",
    json: {
      name: input.name,
      description: input.description,
      category: input.category ?? "other",
      price: input.price ?? 0,
      currency: input.currency ?? "HTG",
      duration_minutes: input.durationMinutes ?? undefined,
      is_active: input.isActive ?? true,
    },
  });
  const root = isObj(raw) ? raw : {};
  return normalizeService(isObj(root.service) ? root.service : root);
}

export async function updateService(business: string, id: number, input: Partial<CreateServiceInput>): Promise<Service> {
  const body: Dict = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.description !== undefined) body.description = input.description;
  if (input.category !== undefined) body.category = input.category;
  if (input.price !== undefined) body.price = input.price;
  if (input.currency !== undefined) body.currency = input.currency;
  if (input.durationMinutes !== undefined) body.duration_minutes = input.durationMinutes;
  if (input.isActive !== undefined) body.is_active = input.isActive;

  const raw = await apiFetch<unknown>(`${catalogBase(business)}/${id}`, { method: "PUT", json: body });
  const root = isObj(raw) ? raw : {};
  return normalizeService(isObj(root.service) ? root.service : root);
}

export async function deleteService(business: string, id: number): Promise<void> {
  await apiFetch<unknown>(`${catalogBase(business)}/${id}`, { method: "DELETE" });
}

// ─── Bookings API ─────────────────────────────────────────────────────────────

const bookingsBase = (b: string) => `/api/app/${encodeURIComponent(b)}/services/bookings`;

export type ListBookingsParams = {
  page?: number;
  perPage?: number;
  status?: BookingStatus | "";
  serviceId?: number;
  date?: string;
};

export async function listServiceBookings(business: string, params: ListBookingsParams = {}): Promise<ServiceBookingsResult> {
  const qp = new URLSearchParams();
  if (params.page && params.page > 0) qp.set("page", String(params.page));
  if (params.perPage && params.perPage > 0) qp.set("per_page", String(params.perPage));
  if (params.status?.trim()) qp.set("status", params.status);
  if (params.serviceId && params.serviceId > 0) qp.set("service_id", String(params.serviceId));
  if (params.date?.trim()) qp.set("date", params.date);

  const path = qp.size > 0 ? `${bookingsBase(business)}?${qp}` : bookingsBase(business);
  const raw = await apiFetch<unknown>(path);
  const root = isObj(raw) ? raw : {};
  const data = isObj(root.data) ? root.data : {};
  const meta = isObj(root.meta) ? root.meta : {};

  return {
    items: (Array.isArray(data.items) ? data.items : []).map(normalizeBooking),
    currentPage: Math.max(1, toNum(meta.current_page, 1)),
    perPage: Math.max(1, toNum(meta.per_page, 25)),
    total: Math.max(0, toNum(meta.total, 0)),
    lastPage: Math.max(1, toNum(meta.last_page, 1)),
  };
}

export type CreateBookingInput = {
  serviceId: number;
  customerId?: number | null;
  guestName?: string;
  quantity?: number;
  unitPrice?: number;
  currency?: string;
  paymentMethod?: string;
  scheduledAt?: string;
  note?: string;
};

export async function createServiceBooking(business: string, input: CreateBookingInput): Promise<ServiceBooking> {
  const raw = await apiFetch<unknown>(bookingsBase(business), {
    method: "POST",
    json: {
      service_id: input.serviceId,
      customer_id: input.customerId ?? undefined,
      guest_name: input.guestName ?? undefined,
      quantity: input.quantity ?? 1,
      unit_price: input.unitPrice,
      currency: input.currency,
      payment_method: input.paymentMethod ?? undefined,
      scheduled_at: input.scheduledAt ?? undefined,
      note: input.note ?? undefined,
    },
  });
  const root = isObj(raw) ? raw : {};
  return normalizeBooking(isObj(root.booking) ? root.booking : root);
}

export async function updateServiceBookingStatus(
  business: string,
  bookingId: number,
  input: { status: BookingStatus; paymentMethod?: string; note?: string }
): Promise<ServiceBooking> {
  const raw = await apiFetch<unknown>(
    `${bookingsBase(business)}/${bookingId}/status`,
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
  return normalizeBooking(isObj(root.booking) ? root.booking : root);
}


export async function downloadServiceBookingPdf(business: string, bookingId: number): Promise<Blob> {
  return apiFetchBlob(`/api/app/${encodeURIComponent(business)}/service-bookings/${bookingId}/pdf`);
}
