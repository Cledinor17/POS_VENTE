import { apiFetch, apiFetchBlob } from "./api";

type Dict = Record<string, unknown>;

export type AuditLogItem = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  groupId: string | null;
  occurredAt: string | null;
  metadata: unknown;
};

export type AuditLogParams = {
  page?: number;
  action?: string;
  entityType?: string;
  entityId?: string | number;
  userId?: string | number;
  from?: string;
  to?: string;
};

export type AuditLogResult = {
  items: AuditLogItem[];
  currentPage: number;
  perPage: number;
  total: number;
  lastPage: number;
};

export type AccountingPeriodItem = {
  id: string;
  name: string | null;
  startDate: string;
  endDate: string;
  status: "open" | "closed";
  closedAt: string | null;
  reopenedAt: string | null;
  notes: string | null;
};

export type AccountingPeriodResult = {
  items: AccountingPeriodItem[];
  currentPage: number;
  perPage: number;
  total: number;
  lastPage: number;
};

export type CreateAccountingPeriodInput = {
  name?: string;
  startDate: string;
  endDate: string;
  notes?: string;
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
    currentPage: Math.max(1, Math.trunc(toNumber(source.current_page ?? source.currentPage, defaults.currentPage))),
    perPage: Math.max(1, Math.trunc(toNumber(source.per_page ?? source.perPage, defaults.perPage))),
    total: Math.max(0, Math.trunc(toNumber(source.total, defaults.total))),
    lastPage: Math.max(1, Math.trunc(toNumber(source.last_page ?? source.lastPage, defaults.lastPage))),
  };
}

function normalizeAuditLog(raw: unknown): AuditLogItem {
  const obj = isObject(raw) ? raw : {};
  const user = isObject(obj.user) ? obj.user : {};
  return {
    id: toString(obj.id, ""),
    action: toString(obj.action, ""),
    entityType: toString(obj.entity_type ?? obj.entityType, "") || null,
    entityId: toString(obj.entity_id ?? obj.entityId, "") || null,
    userId: toString(obj.user_id ?? obj.userId, "") || null,
    userName: toString(user.name ?? obj.user_name ?? obj.userName, "") || null,
    userEmail: toString(user.email ?? obj.user_email ?? obj.userEmail, "") || null,
    groupId: toString(obj.group_id ?? obj.groupId, "") || null,
    occurredAt: toString(obj.occurred_at ?? obj.occurredAt ?? obj.created_at, "") || null,
    metadata: obj.metadata ?? null,
  };
}

function buildAuditLogQuery(params: AuditLogParams = {}): string {
  const qp = new URLSearchParams();
  if (params.page && params.page > 0) qp.set("page", String(params.page));
  if (params.action && params.action.trim().length > 0) qp.set("action", params.action.trim());
  if (params.entityType && params.entityType.trim().length > 0) qp.set("entity_type", params.entityType.trim());
  if (params.entityId !== undefined && params.entityId !== null && String(params.entityId).trim() !== "") {
    qp.set("entity_id", String(params.entityId));
  }
  if (params.userId !== undefined && params.userId !== null && String(params.userId).trim() !== "") {
    qp.set("user_id", String(params.userId));
  }
  if (params.from && params.from.trim().length > 0) qp.set("from", params.from.trim());
  if (params.to && params.to.trim().length > 0) qp.set("to", params.to.trim());

  return qp.toString();
}

function buildAuditLogPath(
  business: string,
  resource: "logs" | "logs.csv" | "logs.pdf",
  params: AuditLogParams = {}
): string {
  const query = buildAuditLogQuery(params);
  const basePath = `/api/app/${encodeURIComponent(business)}/audit/${resource}`;
  return query ? `${basePath}?${query}` : basePath;
}

function normalizePeriod(raw: unknown): AccountingPeriodItem {
  const obj = isObject(raw) ? raw : {};
  const statusRaw = toString(obj.status, "open").toLowerCase();
  return {
    id: toString(obj.id, ""),
    name: toString(obj.name, "") || null,
    startDate: toString(obj.start_date ?? obj.startDate, ""),
    endDate: toString(obj.end_date ?? obj.endDate, ""),
    status: statusRaw === "closed" ? "closed" : "open",
    closedAt: toString(obj.closed_at ?? obj.closedAt, "") || null,
    reopenedAt: toString(obj.reopened_at ?? obj.reopenedAt, "") || null,
    notes: toString(obj.notes, "") || null,
  };
}

export async function listAuditLogs(
  business: string,
  params: AuditLogParams = {}
): Promise<AuditLogResult> {
  const path = buildAuditLogPath(business, "logs", params);

  const raw = await apiFetch<unknown>(path);
  const items = getCollection(raw).map(normalizeAuditLog);
  const meta = getMeta(raw, items.length);

  return {
    items,
    currentPage: meta.currentPage,
    perPage: meta.perPage,
    total: meta.total,
    lastPage: meta.lastPage,
  };
}

export async function exportAuditLogsExcel(
  business: string,
  params: AuditLogParams = {}
): Promise<Blob> {
  return apiFetchBlob(buildAuditLogPath(business, "logs.csv", params));
}

export async function exportAuditLogsPdf(
  business: string,
  params: AuditLogParams = {}
): Promise<Blob> {
  return apiFetchBlob(buildAuditLogPath(business, "logs.pdf", params));
}

export async function listAccountingPeriods(
  business: string,
  page = 1
): Promise<AccountingPeriodResult> {
  const qp = new URLSearchParams();
  qp.set("page", String(Math.max(1, page)));
  const path = `/api/app/${encodeURIComponent(business)}/accounting/periods?${qp.toString()}`;
  const raw = await apiFetch<unknown>(path);
  const items = getCollection(raw).map(normalizePeriod);
  const meta = getMeta(raw, items.length);

  return {
    items,
    currentPage: meta.currentPage,
    perPage: meta.perPage,
    total: meta.total,
    lastPage: meta.lastPage,
  };
}

export async function createAccountingPeriod(
  business: string,
  input: CreateAccountingPeriodInput
): Promise<AccountingPeriodItem> {
  const raw = await apiFetch<unknown>(`/api/app/${encodeURIComponent(business)}/accounting/periods`, {
    method: "POST",
    json: {
      name: input.name ?? null,
      start_date: input.startDate,
      end_date: input.endDate,
      notes: input.notes ?? null,
    },
  });

  return normalizePeriod(raw);
}

export async function closeAccountingPeriod(
  business: string,
  periodId: string
): Promise<AccountingPeriodItem> {
  const raw = await apiFetch<unknown>(
    `/api/app/${encodeURIComponent(business)}/accounting/periods/${encodeURIComponent(periodId)}/close`,
    { method: "POST" }
  );
  return normalizePeriod(raw);
}

export async function reopenAccountingPeriod(
  business: string,
  periodId: string
): Promise<AccountingPeriodItem> {
  const raw = await apiFetch<unknown>(
    `/api/app/${encodeURIComponent(business)}/accounting/periods/${encodeURIComponent(periodId)}/reopen`,
    { method: "POST" }
  );
  return normalizePeriod(raw);
}
