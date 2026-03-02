import { apiFetch } from "./api";

type Dict = Record<string, unknown>;

export type BusinessUserItem = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string | null;
};

export type BusinessUserListResult = {
  items: BusinessUserItem[];
  currentPage: number;
  perPage: number;
  total: number;
  lastPage: number;
};

export type ListBusinessUsersParams = {
  page?: number;
  perPage?: number;
};

export type CreateBusinessUserInput = {
  name: string;
  email: string;
  password?: string;
  role: "admin" | "manager" | "accountant" | "staff";
};

export type UpdateBusinessUserInput = {
  role: "admin" | "manager" | "accountant" | "staff";
  status?: "active" | "disabled";
};

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
  return `/api/app/${encodeURIComponent(business)}/business/users`;
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
    currentPage: Math.max(
      1,
      Math.trunc(toNumber(source.current_page ?? source.currentPage, defaults.currentPage)),
    ),
    perPage: Math.max(
      1,
      Math.trunc(toNumber(source.per_page ?? source.perPage, defaults.perPage)),
    ),
    total: Math.max(0, Math.trunc(toNumber(source.total, defaults.total))),
    lastPage: Math.max(
      1,
      Math.trunc(toNumber(source.last_page ?? source.lastPage, defaults.lastPage)),
    ),
  };
}

function normalizeBusinessUser(raw: unknown): BusinessUserItem {
  const obj = isObject(raw) ? raw : {};
  return {
    id: toString(obj.id, ""),
    name: toString(obj.name, ""),
    email: toString(obj.email, ""),
    role: toString(obj.role, "staff"),
    status: toString(obj.status, "active"),
    createdAt: toString(obj.created_at ?? obj.createdAt, "") || null,
  };
}

export async function listBusinessUsers(
  business: string,
  params: ListBusinessUsersParams = {},
): Promise<BusinessUserListResult> {
  const qp = new URLSearchParams();
  if (params.page && params.page > 0) qp.set("page", String(params.page));
  if (params.perPage && params.perPage > 0) qp.set("per_page", String(params.perPage));

  const query = qp.toString();
  const path = query ? `${basePath(business)}?${query}` : basePath(business);
  const raw = await apiFetch<unknown>(path);
  const items = getCollection(raw).map(normalizeBusinessUser);
  const meta = getMeta(raw, items.length);

  return {
    items,
    currentPage: meta.currentPage,
    perPage: meta.perPage,
    total: meta.total,
    lastPage: meta.lastPage,
  };
}

export async function createBusinessUser(
  business: string,
  input: CreateBusinessUserInput,
): Promise<void> {
  await apiFetch<unknown>(basePath(business), {
    method: "POST",
    json: {
      name: input.name,
      email: input.email,
      password: input.password ?? null,
      role: input.role,
    },
  });
}

export async function updateBusinessUser(
  business: string,
  userId: string,
  input: UpdateBusinessUserInput,
): Promise<void> {
  await apiFetch<unknown>(`${basePath(business)}/${encodeURIComponent(userId)}/role`, {
    method: "PATCH",
    json: {
      role: input.role,
      status: input.status ?? null,
    },
  });
}

export async function removeBusinessUser(
  business: string,
  userId: string,
): Promise<void> {
  await apiFetch<unknown>(`${basePath(business)}/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
}
