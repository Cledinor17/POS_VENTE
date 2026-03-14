import { apiFetch } from "./api";

type Id = string | number;

type Dict = Record<string, unknown>;

function toString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "1" || v === "true" || v === "yes") return true;
    if (v === "0" || v === "false" || v === "no") return false;
  }
  return fallback;
}

function toId(value: unknown): number | null {
  const n = toNumber(value, NaN);
  if (!Number.isFinite(n)) return null;
  const id = Math.trunc(n);
  return id > 0 ? id : null;
}

function asRecord(value: unknown): Dict {
  if (!value || typeof value !== "object") return {};
  return value as Dict;
}

function extractCollection(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  const obj = asRecord(raw);
  if (Array.isArray(obj.data)) return obj.data as unknown[];
  const nested = asRecord(obj.data);
  if (Array.isArray(nested.data)) return nested.data as unknown[];
  if (Array.isArray(obj.rows)) return obj.rows as unknown[];
  if (Array.isArray(obj.items)) return obj.items as unknown[];
  return [];
}

function extractResource(raw: unknown, keys: string[]): unknown {
  const obj = asRecord(raw);
  for (const key of keys) {
    if (obj[key] !== undefined) return obj[key];
  }

  if (obj.data !== undefined && !Array.isArray(obj.data)) return obj.data;
  return raw;
}

function businessBasePath(business: string): string {
  return `/api/app/${encodeURIComponent(business)}/hotel`;
}

function encodeId(id: Id): string {
  return encodeURIComponent(String(id));
}

function appendIfDefined(fd: FormData, key: string, value: unknown) {
  if (value === undefined || value === null) return;
  if (typeof value === "boolean") {
    fd.append(key, value ? "1" : "0");
    return;
  }
  fd.append(key, String(value));
}

export type HotelCategory = {
  id: number;
  name: string;
  description: string;
  image_path: string;
  image_url: string;
  is_active: boolean;
  rooms_count: number;
};

export type HotelAmenity = {
  id: number;
  name: string;
  icon: string;
  description: string;
  is_active: boolean;
  rooms_count: number;
};

export type HotelNecessity = {
  id: number;
  name: string;
  unit: string;
  description: string;
  stock_quantity: number;
  reorder_level: number;
  is_active: boolean;
  rooms_count: number;
  pivot?: {
    quantity?: number | string;
  };
};

export type HotelRoomImage = {
  id: number;
  image_path: string;
  image_url: string;
  sort_order: number;
};

export type HotelRoom = {
  id: number;
  category_id: number | null;
  name: string;
  room_number: string;
  floor: string;
  capacity: number;
  status: string;
  price_per_night: number;
  price_per_night_currency: string;
  price_per_moment: number;
  price_per_moment_currency: string;
  description: string;
  is_active: boolean;
  is_moment: boolean;
  category: HotelCategory | null;
  images: HotelRoomImage[];
  amenities: HotelAmenity[];
  necessities: Array<HotelNecessity & { quantity: number }>;
};

export type HotelReservation = {
  id: number;
  room_id: number;
  customer_id: number | null;
  guest_name: string;
  guest_phone: string;
  guest_email: string;
  check_in: string;
  check_out: string;
  guests: number;
  total_amount: number;
  total_currency: string;
  status: string;
  actual_check_in_at: string;
  actual_check_out_at: string;
  cancelled_at: string;
  no_show_at: string;
  notes: string;
  customer: {
    id: number;
    name: string;
    email: string;
    phone: string;
  } | null;
  room: HotelRoom | null;
};

export type HotelMoment = {
  id: number;
  room_id: number;
  guest_name: string;
  guest_phone: string;
  start_at: string;
  end_at: string;
  duration_minutes: number;
  total_amount: number;
  total_currency: string;
  status: string;
  notes: string;
  identity_document_path: string | null;
  identity_document_url: string | null;
  room: HotelRoom | null;
};

export type HotelReservationCharge = {
  id: number;
  label: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  currency: string;
  posted_at: string;
};

export type HotelReservationPayment = {
  id: number;
  amount: number;
  payment_currency: string;
  payment_amount: number;
  exchange_rate: number;
  payment_method: string;
  reference: string;
  paid_at: string;
  notes: string;
};

export type HotelReservationFolio = {
  reservation: HotelReservation;
  currency: string;
  room_amount: number;
  extras_amount: number;
  gross_total: number;
  payments_total: number;
  balance_due: number;
  charges: HotelReservationCharge[];
  payments: HotelReservationPayment[];
};

export type HotelHousekeepingTask = {
  id: number;
  room_id: number;
  task_date: string;
  task_type: string;
  priority: string;
  status: string;
  assigned_employee_id: number | null;
  assigned_to: string;
  notes: string;
  completed_at: string;
  assigned_employee: {
    id: number;
    name: string;
    email: string;
  } | null;
  room: HotelRoom | null;
};

export type HotelNightAuditReport = {
  date: string;
  currency: string;
  rooms_total: number;
  arrivals_count: number;
  departures_count: number;
  in_house_count: number;
  occupancy_rate: number;
  room_revenue: number;
  extra_revenue: number;
  charges_revenue: number;
  moments_revenue: number;
  total_revenue: number;
  payments_total: number;
  outstanding_balance: number;
  adr: number;
  revpar: number;
  payments_by_method: Record<string, number>;
  arrivals: HotelReservation[];
  departures: HotelReservation[];
  housekeeping_pending: HotelHousekeepingTask[];
};

function normalizeCategory(raw: unknown): HotelCategory {
  const obj = asRecord(raw);
  return {
    id: toNumber(obj.id, 0),
    name: toString(obj.name),
    description: toString(obj.description),
    image_path: toString(obj.image_path),
    image_url: toString(obj.image_url),
    is_active: toBoolean(obj.is_active, true),
    rooms_count: toNumber(obj.rooms_count, 0),
  };
}

function normalizeAmenity(raw: unknown): HotelAmenity {
  const obj = asRecord(raw);
  return {
    id: toNumber(obj.id, 0),
    name: toString(obj.name),
    icon: toString(obj.icon),
    description: toString(obj.description),
    is_active: toBoolean(obj.is_active, true),
    rooms_count: toNumber(obj.rooms_count, 0),
  };
}

function normalizeNecessity(raw: unknown): HotelNecessity {
  const obj = asRecord(raw);
  return {
    id: toNumber(obj.id, 0),
    name: toString(obj.name),
    unit: toString(obj.unit),
    description: toString(obj.description),
    stock_quantity: toNumber(obj.stock_quantity, 0),
    reorder_level: toNumber(obj.reorder_level, 0),
    is_active: toBoolean(obj.is_active, true),
    rooms_count: toNumber(obj.rooms_count, 0),
    pivot: obj.pivot as HotelNecessity["pivot"] | undefined,
  };
}

function normalizeRoomImage(raw: unknown): HotelRoomImage {
  const obj = asRecord(raw);
  return {
    id: toNumber(obj.id, 0),
    image_path: toString(obj.image_path),
    image_url: toString(obj.image_url),
    sort_order: toNumber(obj.sort_order, 0),
  };
}

function normalizeRoom(raw: unknown): HotelRoom {
  const obj = asRecord(raw);
  const category = obj.category ? normalizeCategory(obj.category) : null;
  const images = Array.isArray(obj.images) ? obj.images.map(normalizeRoomImage) : [];
  const amenities = Array.isArray(obj.amenities) ? obj.amenities.map(normalizeAmenity) : [];
  const necessitiesRaw = Array.isArray(obj.necessities) ? obj.necessities : [];
  const necessities = necessitiesRaw.map((item) => {
    const normalized = normalizeNecessity(item);
    const quantity = toNumber(normalized.pivot?.quantity, 1);
    return {
      ...normalized,
      quantity,
    };
  });

  return {
    id: toNumber(obj.id, 0),
    category_id: toId(obj.category_id),
    name: toString(obj.name),
    room_number: toString(obj.room_number),
    floor: toString(obj.floor),
    capacity: toNumber(obj.capacity, 1),
    status: toString(obj.status, "available"),
    price_per_night: toNumber(obj.price_per_night, 0),
    price_per_night_currency: toString(obj.price_per_night_currency, "USD"),
    price_per_moment: toNumber(obj.price_per_moment, 0),
    price_per_moment_currency: toString(obj.price_per_moment_currency, "HTG"),
    description: toString(obj.description),
    is_active: toBoolean(obj.is_active, true),
    is_moment: toBoolean(obj.is_moment, true),
    category,
    images,
    amenities,
    necessities,
  };
}

function normalizeReservation(raw: unknown): HotelReservation {
  const obj = asRecord(raw);
  const customerRaw = asRecord(obj.customer);
  return {
    id: toNumber(obj.id, 0),
    room_id: toNumber(obj.room_id, 0),
    customer_id: toId(obj.customer_id),
    guest_name: toString(obj.guest_name),
    guest_phone: toString(obj.guest_phone),
    guest_email: toString(obj.guest_email),
    check_in: toString(obj.check_in),
    check_out: toString(obj.check_out),
    guests: toNumber(obj.guests, 1),
    total_amount: toNumber(obj.total_amount, 0),
    total_currency: toString(obj.total_currency, "USD"),
    status: toString(obj.status),
    actual_check_in_at: toString(obj.actual_check_in_at),
    actual_check_out_at: toString(obj.actual_check_out_at),
    cancelled_at: toString(obj.cancelled_at),
    no_show_at: toString(obj.no_show_at),
    notes: toString(obj.notes),
    customer: obj.customer
      ? {
          id: toNumber(customerRaw.id, 0),
          name: toString(customerRaw.name),
          email: toString(customerRaw.email),
          phone: toString(customerRaw.phone),
        }
      : null,
    room: obj.room ? normalizeRoom(obj.room) : null,
  };
}

function normalizeMoment(raw: unknown): HotelMoment {
  const obj = asRecord(raw);
  return {
    id: toNumber(obj.id, 0),
    room_id: toNumber(obj.room_id, 0),
    guest_name: toString(obj.guest_name),
    guest_phone: toString(obj.guest_phone),
    start_at: toString(obj.start_at),
    end_at: toString(obj.end_at),
    duration_minutes: toNumber(obj.duration_minutes, 120),
    total_amount: toNumber(obj.total_amount, 0),
    total_currency: toString(obj.total_currency, "HTG"),
    status: toString(obj.status),
    notes: toString(obj.notes),
    identity_document_path: toString(obj.identity_document_path, "") || null,
    identity_document_url: toString(obj.identity_document_url, "") || null,
    room: obj.room ? normalizeRoom(obj.room) : null,
  };
}

function normalizeCharge(raw: unknown): HotelReservationCharge {
  const obj = asRecord(raw);
  return {
    id: toNumber(obj.id, 0),
    label: toString(obj.label),
    description: toString(obj.description),
    quantity: toNumber(obj.quantity, 1),
    unit_price: toNumber(obj.unit_price, 0),
    total_amount: toNumber(obj.total_amount, 0),
    currency: toString(obj.currency, "USD"),
    posted_at: toString(obj.posted_at),
  };
}

function normalizePayment(raw: unknown): HotelReservationPayment {
  const obj = asRecord(raw);
  return {
    id: toNumber(obj.id, 0),
    amount: toNumber(obj.amount, 0),
    payment_currency: toString(obj.payment_currency, "USD"),
    payment_amount: toNumber(obj.payment_amount, toNumber(obj.amount, 0)),
    exchange_rate: toNumber(obj.exchange_rate, 1),
    payment_method: toString(obj.payment_method),
    reference: toString(obj.reference),
    paid_at: toString(obj.paid_at),
    notes: toString(obj.notes),
  };
}

function normalizeHousekeepingTask(raw: unknown): HotelHousekeepingTask {
  const obj = asRecord(raw);
  const employee = asRecord(obj.assigned_employee);
  return {
    id: toNumber(obj.id, 0),
    room_id: toNumber(obj.room_id, 0),
    task_date: toString(obj.task_date),
    task_type: toString(obj.task_type),
    priority: toString(obj.priority),
    status: toString(obj.status),
    assigned_employee_id: toId(obj.assigned_employee_id),
    assigned_to: toString(obj.assigned_to),
    notes: toString(obj.notes),
    completed_at: toString(obj.completed_at),
    assigned_employee: obj.assigned_employee
      ? {
          id: toNumber(employee.id, 0),
          name: toString(employee.name),
          email: toString(employee.email),
        }
      : null,
    room: obj.room ? normalizeRoom(obj.room) : null,
  };
}

function normalizeFolio(raw: unknown): HotelReservationFolio {
  const obj = asRecord(raw);
  const reservation = normalizeReservation(obj.reservation);
  const folio = asRecord(obj.folio);
  const chargesRaw = Array.isArray(folio.charges) ? folio.charges : [];
  const paymentsRaw = Array.isArray(folio.payments) ? folio.payments : [];

  return {
    reservation,
    currency: toString(folio.currency, reservation.total_currency || "USD"),
    room_amount: toNumber(folio.room_amount, 0),
    extras_amount: toNumber(folio.extras_amount, 0),
    gross_total: toNumber(folio.gross_total, 0),
    payments_total: toNumber(folio.payments_total, 0),
    balance_due: toNumber(folio.balance_due, 0),
    charges: chargesRaw.map(normalizeCharge),
    payments: paymentsRaw.map(normalizePayment),
  };
}

function normalizeNightAudit(raw: unknown): HotelNightAuditReport {
  const obj = asRecord(raw);
  const arrivalsRaw = Array.isArray(obj.arrivals) ? obj.arrivals : [];
  const departuresRaw = Array.isArray(obj.departures) ? obj.departures : [];
  const housekeepingRaw = Array.isArray(obj.housekeeping_pending) ? obj.housekeeping_pending : [];

  const methodsRaw = asRecord(obj.payments_by_method);
  const paymentsByMethod: Record<string, number> = {};
  Object.entries(methodsRaw).forEach(([key, value]) => {
    paymentsByMethod[key] = toNumber(value, 0);
  });

  return {
    date: toString(obj.date),
    currency: toString(obj.currency, "USD"),
    rooms_total: toNumber(obj.rooms_total, 0),
    arrivals_count: toNumber(obj.arrivals_count, 0),
    departures_count: toNumber(obj.departures_count, 0),
    in_house_count: toNumber(obj.in_house_count, 0),
    occupancy_rate: toNumber(obj.occupancy_rate, 0),
    room_revenue: toNumber(obj.room_revenue, 0),
    extra_revenue: toNumber(obj.extra_revenue, 0),
    charges_revenue: toNumber(obj.charges_revenue, 0),
    moments_revenue: toNumber(obj.moments_revenue, 0),
    total_revenue: toNumber(obj.total_revenue, 0),
    payments_total: toNumber(obj.payments_total, 0),
    outstanding_balance: toNumber(obj.outstanding_balance, 0),
    adr: toNumber(obj.adr, 0),
    revpar: toNumber(obj.revpar, 0),
    payments_by_method: paymentsByMethod,
    arrivals: arrivalsRaw.map(normalizeReservation),
    departures: departuresRaw.map(normalizeReservation),
    housekeeping_pending: housekeepingRaw.map(normalizeHousekeepingTask),
  };
}

export async function getHotelCategories(business: string): Promise<HotelCategory[]> {
  const raw = await apiFetch<unknown>(`${businessBasePath(business)}/categories?all=1&include_inactive=1`);
  return extractCollection(raw).map(normalizeCategory);
}

export async function createHotelCategory(
  business: string,
  input: { name: string; description?: string; isActive?: boolean; imageFile?: File | null }
): Promise<HotelCategory> {
  const fd = new FormData();
  appendIfDefined(fd, "name", input.name);
  appendIfDefined(fd, "description", input.description ?? "");
  appendIfDefined(fd, "is_active", input.isActive ?? true);
  if (input.imageFile instanceof File) fd.append("image", input.imageFile);

  const raw = await apiFetch<unknown>(`${businessBasePath(business)}/categories`, {
    method: "POST",
    body: fd,
  });

  return normalizeCategory(extractResource(raw, ["category"]));
}

export async function deleteHotelCategory(business: string, id: Id): Promise<void> {
  await apiFetch(`${businessBasePath(business)}/categories/${encodeId(id)}`, { method: "DELETE" });
}

export async function getHotelAmenities(business: string): Promise<HotelAmenity[]> {
  const raw = await apiFetch<unknown>(`${businessBasePath(business)}/amenities?all=1&include_inactive=1`);
  return extractCollection(raw).map(normalizeAmenity);
}

export async function createHotelAmenity(
  business: string,
  input: { name: string; icon?: string; description?: string; isActive?: boolean }
): Promise<HotelAmenity> {
  const raw = await apiFetch<unknown>(`${businessBasePath(business)}/amenities`, {
    method: "POST",
    json: {
      name: input.name,
      icon: input.icon ?? "",
      description: input.description ?? "",
      is_active: input.isActive ?? true,
    },
  });
  return normalizeAmenity(extractResource(raw, ["amenity"]));
}

export async function deleteHotelAmenity(business: string, id: Id): Promise<void> {
  await apiFetch(`${businessBasePath(business)}/amenities/${encodeId(id)}`, { method: "DELETE" });
}

export async function getHotelNecessities(business: string): Promise<HotelNecessity[]> {
  const raw = await apiFetch<unknown>(`${businessBasePath(business)}/necessities?all=1&include_inactive=1`);
  return extractCollection(raw).map(normalizeNecessity);
}

export async function createHotelNecessity(
  business: string,
  input: {
    name: string;
    unit?: string;
    description?: string;
    stockQuantity?: number;
    reorderLevel?: number;
    isActive?: boolean;
  }
): Promise<HotelNecessity> {
  const raw = await apiFetch<unknown>(`${businessBasePath(business)}/necessities`, {
    method: "POST",
    json: {
      name: input.name,
      unit: input.unit ?? "",
      description: input.description ?? "",
      stock_quantity: input.stockQuantity ?? 0,
      reorder_level: input.reorderLevel ?? 0,
      is_active: input.isActive ?? true,
    },
  });
  return normalizeNecessity(extractResource(raw, ["necessity"]));
}

export async function deleteHotelNecessity(business: string, id: Id): Promise<void> {
  await apiFetch(`${businessBasePath(business)}/necessities/${encodeId(id)}`, { method: "DELETE" });
}

export async function getHotelRooms(business: string): Promise<HotelRoom[]> {
  const raw = await apiFetch<unknown>(`${businessBasePath(business)}/rooms?all=1`);
  return extractCollection(raw).map(normalizeRoom);
}

export async function createHotelRoom(
  business: string,
  input: {
    categoryId?: number | null;
    name: string;
    roomNumber: string;
    floor?: string;
    capacity?: number;
    status?: string;
    pricePerNight: number;
    pricePerMoment?: number;
    description?: string;
    isActive?: boolean;
    isMoment?: boolean;
    amenityIds?: number[];
    necessities?: Array<{ necessityId: number; quantity: number }>;
    images?: File[];
  }
): Promise<HotelRoom> {
  const fd = new FormData();
  appendIfDefined(fd, "category_id", input.categoryId ?? null);
  appendIfDefined(fd, "name", input.name);
  appendIfDefined(fd, "room_number", input.roomNumber);
  appendIfDefined(fd, "floor", input.floor ?? "");
  appendIfDefined(fd, "capacity", input.capacity ?? 1);
  appendIfDefined(fd, "status", input.status ?? "available");
  appendIfDefined(fd, "price_per_night", input.pricePerNight);
  appendIfDefined(fd, "price_per_moment", input.pricePerMoment);
  appendIfDefined(fd, "description", input.description ?? "");
  appendIfDefined(fd, "is_active", input.isActive ?? true);
  appendIfDefined(fd, "is_moment", input.isMoment ?? true);

  for (const amenityId of input.amenityIds ?? []) {
    fd.append("amenity_ids[]", String(amenityId));
  }

  (input.necessities ?? []).forEach((item, index) => {
    fd.append(`necessities[${index}][necessity_id]`, String(item.necessityId));
    fd.append(`necessities[${index}][quantity]`, String(item.quantity));
  });

  (input.images ?? []).forEach((image) => fd.append("images[]", image));

  const raw = await apiFetch<unknown>(`${businessBasePath(business)}/rooms`, {
    method: "POST",
    body: fd,
  });

  return normalizeRoom(extractResource(raw, ["room"]));
}

export async function deleteHotelRoom(business: string, id: Id): Promise<void> {
  await apiFetch(`${businessBasePath(business)}/rooms/${encodeId(id)}`, { method: "DELETE" });
}

export async function updateHotelRoom(
  business: string,
  id: Id,
  input: {
    categoryId?: number | null;
    name?: string;
    roomNumber?: string;
    floor?: string;
    capacity?: number;
    status?: string;
    pricePerNight?: number;
    pricePerMoment?: number | null;
    description?: string;
    isActive?: boolean;
    isMoment?: boolean;
  }
): Promise<HotelRoom> {
  const payload: Dict = {};
  if (input.categoryId !== undefined) payload.category_id = input.categoryId;
  if (input.name !== undefined) payload.name = input.name;
  if (input.roomNumber !== undefined) payload.room_number = input.roomNumber;
  if (input.floor !== undefined) payload.floor = input.floor;
  if (input.capacity !== undefined) payload.capacity = input.capacity;
  if (input.status !== undefined) payload.status = input.status;
  if (input.pricePerNight !== undefined) payload.price_per_night = input.pricePerNight;
  if (input.pricePerMoment !== undefined) payload.price_per_moment = input.pricePerMoment;
  if (input.description !== undefined) payload.description = input.description;
  if (input.isActive !== undefined) payload.is_active = input.isActive;
  if (input.isMoment !== undefined) payload.is_moment = input.isMoment;

  const raw = await apiFetch<unknown>(`${businessBasePath(business)}/rooms/${encodeId(id)}`, {
    method: "PATCH",
    json: payload,
  });

  return normalizeRoom(extractResource(raw, ["room"]));
}

export async function getHotelReservations(business: string): Promise<HotelReservation[]> {
  const raw = await apiFetch<unknown>(`${businessBasePath(business)}/reservations?all=1`);
  return extractCollection(raw).map(normalizeReservation);
}

export async function createHotelReservation(
  business: string,
  input: {
    roomId: number;
    customerId?: number;
    guestName: string;
    guestPhone?: string;
    guestEmail?: string;
    checkIn: string;
    checkOut: string;
    guests?: number;
    totalAmount?: number;
    status?: string;
    notes?: string;
  }
): Promise<HotelReservation> {
  const raw = await apiFetch<unknown>(`${businessBasePath(business)}/reservations`, {
    method: "POST",
    json: {
      room_id: input.roomId,
      customer_id: input.customerId,
      guest_name: input.guestName,
      guest_phone: input.guestPhone ?? "",
      guest_email: input.guestEmail ?? "",
      check_in: input.checkIn,
      check_out: input.checkOut,
      guests: input.guests ?? 1,
      total_amount: input.totalAmount,
      status: input.status ?? "pending",
      notes: input.notes ?? "",
    },
  });
  return normalizeReservation(extractResource(raw, ["reservation"]));
}

export async function deleteHotelReservation(business: string, id: Id): Promise<void> {
  await apiFetch(`${businessBasePath(business)}/reservations/${encodeId(id)}`, { method: "DELETE" });
}

export async function updateHotelReservation(
  business: string,
  id: Id,
  input: {
    roomId?: number;
    customerId?: number | null;
    guestName?: string;
    guestPhone?: string;
    guestEmail?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: number;
    totalAmount?: number;
    status?: string;
    notes?: string;
  }
): Promise<HotelReservation> {
  const payload: Dict = {};
  if (input.roomId !== undefined) payload.room_id = input.roomId;
  if (input.customerId !== undefined) payload.customer_id = input.customerId;
  if (input.guestName !== undefined) payload.guest_name = input.guestName;
  if (input.guestPhone !== undefined) payload.guest_phone = input.guestPhone;
  if (input.guestEmail !== undefined) payload.guest_email = input.guestEmail;
  if (input.checkIn !== undefined) payload.check_in = input.checkIn;
  if (input.checkOut !== undefined) payload.check_out = input.checkOut;
  if (input.guests !== undefined) payload.guests = input.guests;
  if (input.totalAmount !== undefined) payload.total_amount = input.totalAmount;
  if (input.status !== undefined) payload.status = input.status;
  if (input.notes !== undefined) payload.notes = input.notes;

  const raw = await apiFetch<unknown>(`${businessBasePath(business)}/reservations/${encodeId(id)}`, {
    method: "PATCH",
    json: payload,
  });

  return normalizeReservation(extractResource(raw, ["reservation"]));
}

export async function getHotelMoments(business: string): Promise<HotelMoment[]> {
  const raw = await apiFetch<unknown>(`${businessBasePath(business)}/moments?all=1`);
  return extractCollection(raw).map(normalizeMoment);
}

export async function createHotelMoment(
  business: string,
  input: {
    roomId: number;
    guestName: string;
    guestPhone?: string;
    startAt: string;
    totalAmount?: number;
    status?: string;
    notes?: string;
    identityDocumentFile?: File | null;
  }
): Promise<HotelMoment> {
  const formData = new FormData();
  appendIfDefined(formData, "room_id", input.roomId);
  appendIfDefined(formData, "guest_name", input.guestName);
  appendIfDefined(formData, "guest_phone", input.guestPhone ?? "");
  appendIfDefined(formData, "start_at", input.startAt);
  appendIfDefined(formData, "total_amount", input.totalAmount);
  appendIfDefined(formData, "status", input.status ?? "pending");
  appendIfDefined(formData, "notes", input.notes ?? "");
  if (typeof File !== "undefined" && input.identityDocumentFile instanceof File) {
    formData.append("identity_document", input.identityDocumentFile);
  }

  const raw = await apiFetch<unknown>(`${businessBasePath(business)}/moments`, {
    method: "POST",
    body: formData,
  });
  return normalizeMoment(extractResource(raw, ["moment"]));
}

export async function deleteHotelMoment(business: string, id: Id): Promise<void> {
  await apiFetch(`${businessBasePath(business)}/moments/${encodeId(id)}`, { method: "DELETE" });
}

export async function updateHotelMoment(
  business: string,
  id: Id,
  input: {
    roomId?: number;
    guestName?: string;
    guestPhone?: string;
    startAt?: string;
    totalAmount?: number;
    status?: string;
    notes?: string;
  }
): Promise<HotelMoment> {
  const payload: Dict = {};
  if (input.roomId !== undefined) payload.room_id = input.roomId;
  if (input.guestName !== undefined) payload.guest_name = input.guestName;
  if (input.guestPhone !== undefined) payload.guest_phone = input.guestPhone;
  if (input.startAt !== undefined) payload.start_at = input.startAt;
  if (input.totalAmount !== undefined) payload.total_amount = input.totalAmount;
  if (input.status !== undefined) payload.status = input.status;
  if (input.notes !== undefined) payload.notes = input.notes;

  const raw = await apiFetch<unknown>(`${businessBasePath(business)}/moments/${encodeId(id)}`, {
    method: "PATCH",
    json: payload,
  });

  return normalizeMoment(extractResource(raw, ["moment"]));
}

export async function getHotelReservationFolio(
  business: string,
  reservationId: Id
): Promise<HotelReservationFolio> {
  const raw = await apiFetch<unknown>(`${businessBasePath(business)}/reservations/${encodeId(reservationId)}/folio`);
  return normalizeFolio(raw);
}

export async function addHotelReservationCharge(
  business: string,
  reservationId: Id,
  input: {
    label: string;
    description?: string;
    quantity?: number;
    unitPrice?: number;
    postedAt?: string;
  }
): Promise<HotelReservationFolio> {
  const raw = await apiFetch<unknown>(`${businessBasePath(business)}/reservations/${encodeId(reservationId)}/charges`, {
    method: "POST",
    json: {
      label: input.label,
      description: input.description ?? "",
      quantity: input.quantity ?? 1,
      unit_price: input.unitPrice ?? 0,
      posted_at: input.postedAt,
    },
  });
  return normalizeFolio(raw);
}

export async function addHotelReservationPayment(
  business: string,
  reservationId: Id,
  input: {
    amount: number;
    paymentCurrency?: "USD" | "HTG";
    paymentMethod?: "cash" | "card" | "bank" | "mobile" | "other";
    reference?: string;
    paidAt?: string;
    notes?: string;
  }
): Promise<HotelReservationFolio> {
  const raw = await apiFetch<unknown>(`${businessBasePath(business)}/reservations/${encodeId(reservationId)}/payments`, {
    method: "POST",
    json: {
      amount: input.amount,
      payment_currency: input.paymentCurrency ?? "USD",
      payment_method: input.paymentMethod ?? "cash",
      reference: input.reference ?? "",
      paid_at: input.paidAt,
      notes: input.notes ?? "",
    },
  });
  return normalizeFolio(raw);
}

export async function checkInHotelReservation(
  business: string,
  reservationId: Id
): Promise<HotelReservationFolio> {
  const raw = await apiFetch<unknown>(
    `${businessBasePath(business)}/reservations/${encodeId(reservationId)}/check-in`,
    { method: "POST" }
  );
  return normalizeFolio(raw);
}

export async function checkOutHotelReservation(
  business: string,
  reservationId: Id
): Promise<HotelReservationFolio> {
  const raw = await apiFetch<unknown>(
    `${businessBasePath(business)}/reservations/${encodeId(reservationId)}/check-out`,
    { method: "POST" }
  );
  return normalizeFolio(raw);
}

export async function cancelHotelReservation(
  business: string,
  reservationId: Id
): Promise<HotelReservationFolio> {
  const raw = await apiFetch<unknown>(
    `${businessBasePath(business)}/reservations/${encodeId(reservationId)}/cancel`,
    { method: "POST" }
  );
  return normalizeFolio(raw);
}

export async function noShowHotelReservation(
  business: string,
  reservationId: Id
): Promise<HotelReservationFolio> {
  const raw = await apiFetch<unknown>(
    `${businessBasePath(business)}/reservations/${encodeId(reservationId)}/no-show`,
    { method: "POST" }
  );
  return normalizeFolio(raw);
}

export async function getHotelHousekeepingTasks(
  business: string,
  input?: { status?: string; taskDate?: string; roomId?: number; all?: boolean }
): Promise<HotelHousekeepingTask[]> {
  const params = new URLSearchParams();
  params.set("all", input?.all === false ? "0" : "1");
  if (input?.status) params.set("status", input.status);
  if (input?.taskDate) params.set("task_date", input.taskDate);
  if (input?.roomId) params.set("room_id", String(input.roomId));

  const raw = await apiFetch<unknown>(`${businessBasePath(business)}/housekeeping?${params.toString()}`);
  return extractCollection(raw).map(normalizeHousekeepingTask);
}

export async function createHotelHousekeepingTask(
  business: string,
  input: {
    roomId: number;
    taskDate: string;
    taskType?: "cleaning" | "inspection" | "maintenance" | "linen" | "refill";
    priority?: "low" | "normal" | "high" | "urgent";
    status?: "pending" | "in_progress" | "done" | "cancelled";
    assignedEmployeeId?: number | null;
    assignedTo?: string;
    notes?: string;
  }
): Promise<HotelHousekeepingTask> {
  const raw = await apiFetch<unknown>(`${businessBasePath(business)}/housekeeping`, {
    method: "POST",
    json: {
      room_id: input.roomId,
      task_date: input.taskDate,
      task_type: input.taskType ?? "cleaning",
      priority: input.priority ?? "normal",
      status: input.status ?? "pending",
      assigned_employee_id: input.assignedEmployeeId ?? null,
      assigned_to: input.assignedTo ?? "",
      notes: input.notes ?? "",
    },
  });
  return normalizeHousekeepingTask(extractResource(raw, ["task"]));
}

export async function updateHotelHousekeepingTask(
  business: string,
  id: Id,
  input: {
    roomId?: number;
    taskDate?: string;
    taskType?: "cleaning" | "inspection" | "maintenance" | "linen" | "refill";
    priority?: "low" | "normal" | "high" | "urgent";
    status?: "pending" | "in_progress" | "done" | "cancelled";
    assignedEmployeeId?: number | null;
    assignedTo?: string;
    notes?: string;
  }
): Promise<HotelHousekeepingTask> {
  const payload: Dict = {};
  if (input.roomId !== undefined) payload.room_id = input.roomId;
  if (input.taskDate !== undefined) payload.task_date = input.taskDate;
  if (input.taskType !== undefined) payload.task_type = input.taskType;
  if (input.priority !== undefined) payload.priority = input.priority;
  if (input.status !== undefined) payload.status = input.status;
  if (input.assignedEmployeeId !== undefined) payload.assigned_employee_id = input.assignedEmployeeId;
  if (input.assignedTo !== undefined) payload.assigned_to = input.assignedTo;
  if (input.notes !== undefined) payload.notes = input.notes;

  const raw = await apiFetch<unknown>(`${businessBasePath(business)}/housekeeping/${encodeId(id)}`, {
    method: "PATCH",
    json: payload,
  });
  return normalizeHousekeepingTask(extractResource(raw, ["task"]));
}

export async function deleteHotelHousekeepingTask(business: string, id: Id): Promise<void> {
  await apiFetch(`${businessBasePath(business)}/housekeeping/${encodeId(id)}`, { method: "DELETE" });
}

export async function getHotelNightAuditReport(
  business: string,
  input?: { date?: string }
): Promise<HotelNightAuditReport> {
  const params = new URLSearchParams();
  if (input?.date) params.set("date", input.date);
  const suffix = params.toString();
  const raw = await apiFetch<unknown>(
    `${businessBasePath(business)}/reports/night-audit${suffix ? `?${suffix}` : ""}`
  );
  return normalizeNightAudit(raw);
}
