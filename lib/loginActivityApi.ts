import { apiFetch } from "./api";

type Dict = Record<string, unknown>;

export type LoginActivityItem = {
  id: string;
  ipAddress: string | null;
  browser: string | null;
  platform: string | null;
  deviceType: string | null;
  userAgent: string | null;
  createdAt: string | null;
};

export type LoginActivityListResult = {
  items: LoginActivityItem[];
  currentPage: number;
  perPage: number;
  total: number;
  lastPage: number;
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
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

function normalizeItem(raw: unknown): LoginActivityItem {
  const obj = isObject(raw) ? raw : {};
  return {
    id: toString(obj.id, ""),
    ipAddress: toString(obj.ip_address ?? obj.ipAddress, "") || null,
    browser: toString(obj.browser, "") || null,
    platform: toString(obj.platform, "") || null,
    deviceType: toString(obj.device_type ?? obj.deviceType, "") || null,
    userAgent: toString(obj.user_agent ?? obj.userAgent, "") || null,
    createdAt: toString(obj.created_at ?? obj.createdAt, "") || null,
  };
}

function normalizeResult(raw: unknown): LoginActivityListResult {
  const obj = isObject(raw) ? raw : {};
  const items = Array.isArray(obj.data) ? obj.data.map(normalizeItem) : [];
  const meta = isObject(obj.meta) ? obj.meta : {};

  return {
    items,
    currentPage: Math.max(1, Math.trunc(toNumber(meta.current_page, 1))),
    perPage: Math.max(1, Math.trunc(toNumber(meta.per_page, 20))),
    total: Math.max(0, Math.trunc(toNumber(meta.total, items.length))),
    lastPage: Math.max(1, Math.trunc(toNumber(meta.last_page, 1))),
  };
}

export async function listMyLoginActivity(page = 1): Promise<LoginActivityListResult> {
  const raw = await apiFetch<unknown>(`/api/me/login-activity?page=${page}&per_page=20`);
  return normalizeResult(raw);
}

export async function listUserLoginActivity(
  business: string,
  userId: string,
  page = 1,
): Promise<LoginActivityListResult> {
  const raw = await apiFetch<unknown>(
    `/api/app/${encodeURIComponent(business)}/business/users/${encodeURIComponent(userId)}/login-activity?page=${page}&per_page=20`,
  );
  return normalizeResult(raw);
}
