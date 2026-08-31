import { apiFetch } from "./api";

type Dict = Record<string, unknown>;

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  business: { id: string; name: string; slug: string } | null;
  readAt: string | null;
  createdAt: string | null;
};

export type NotificationListResult = {
  items: AppNotification[];
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

function normalizeNotification(raw: unknown): AppNotification {
  const obj = isObject(raw) ? raw : {};
  const business = isObject(obj.business) ? obj.business : null;

  return {
    id: toString(obj.id, ""),
    type: toString(obj.type, ""),
    title: toString(obj.title, ""),
    body: toString(obj.body, ""),
    business: business
      ? {
          id: toString(business.id, ""),
          name: toString(business.name, ""),
          slug: toString(business.slug, ""),
        }
      : null,
    readAt: toString(obj.read_at ?? obj.readAt, "") || null,
    createdAt: toString(obj.created_at ?? obj.createdAt, "") || null,
  };
}

export async function listNotifications(params: { page?: number; perPage?: number; unreadOnly?: boolean } = {}): Promise<NotificationListResult> {
  const qp = new URLSearchParams();
  if (params.page && params.page > 0) qp.set("page", String(params.page));
  if (params.perPage && params.perPage > 0) qp.set("per_page", String(params.perPage));
  if (params.unreadOnly) qp.set("unread", "1");

  const query = qp.toString();
  const path = query ? `/api/notifications?${query}` : "/api/notifications";
  const raw = await apiFetch<unknown>(path);
  const obj = isObject(raw) ? raw : {};
  const items = Array.isArray(obj.data) ? obj.data.map(normalizeNotification) : [];
  const meta = isObject(obj.meta) ? obj.meta : {};

  return {
    items,
    currentPage: Math.max(1, Math.trunc(toNumber(meta.current_page, 1))),
    perPage: Math.max(1, Math.trunc(toNumber(meta.per_page, 20))),
    total: Math.max(0, Math.trunc(toNumber(meta.total, items.length))),
    lastPage: Math.max(1, Math.trunc(toNumber(meta.last_page, 1))),
  };
}

export async function getUnreadNotificationCount(): Promise<number> {
  const raw = await apiFetch<unknown>("/api/notifications/unread-count");
  const obj = isObject(raw) ? raw : {};
  return Math.max(0, Math.trunc(toNumber(obj.count, 0)));
}

export async function markNotificationRead(id: string): Promise<AppNotification> {
  const raw = await apiFetch<unknown>(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "POST" });
  const obj = isObject(raw) ? raw : {};
  return normalizeNotification(obj.data ?? obj);
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiFetch<unknown>("/api/notifications/read-all", { method: "POST" });
}
