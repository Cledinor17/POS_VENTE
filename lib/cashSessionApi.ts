import { apiFetch } from "./api";

type Dict = Record<string, unknown>;
function isObj(v: unknown): v is Dict { return typeof v === "object" && v !== null; }
function toStr(v: unknown, fb = ""): string { return typeof v === "string" ? v : fb; }
function toNum(v: unknown, fb = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) { const n = Number(v); if (Number.isFinite(n)) return n; }
  return fb;
}

export type CashSession = {
  id: number;
  status: "open" | "closed";
  currency: string;
  userId: number;
  userName: string;
  userEmail: string;
  openingAmount: number;
  openingAmountByCurrency: Record<string, number>;
  openingNote: string;
  openedAt: string;
  expectedAmount: number | null;
  expectedAmountByCurrency: Record<string, number> | null;
  closingAmount: number | null;
  closingAmountByCurrency: Record<string, number> | null;
  differenceAmount: number | null;
  differenceByСurrency: Record<string, number> | null;
  closingNote: string;
  closedAt: string | null;
  createdAt: string | null;
};

function normalizeBreakdown(raw: unknown): Record<string, number> {
  if (!isObj(raw)) return { HTG: 0, USD: 0 };
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, toNum(v)])
  );
}

function normalizeSession(raw: unknown): CashSession {
  const o = isObj(raw) ? raw : {};
  return {
    id: toNum(o.id),
    status: (toStr(o.status, "open") as "open" | "closed"),
    currency: toStr(o.currency, "HTG"),
    userId: toNum(o.user_id),
    userName: toStr(o.user_name),
    userEmail: toStr(o.user_email),
    openingAmount: toNum(o.opening_amount),
    openingAmountByCurrency: normalizeBreakdown(o.opening_amount_by_currency),
    openingNote: toStr(o.opening_note),
    openedAt: toStr(o.opened_at),
    expectedAmount: o.expected_amount != null ? toNum(o.expected_amount) : null,
    expectedAmountByCurrency: o.expected_amount_by_currency != null
      ? normalizeBreakdown(o.expected_amount_by_currency) : null,
    closingAmount: o.closing_amount != null ? toNum(o.closing_amount) : null,
    closingAmountByCurrency: o.closing_amount_by_currency != null
      ? normalizeBreakdown(o.closing_amount_by_currency) : null,
    differenceAmount: o.difference_amount != null ? toNum(o.difference_amount) : null,
    differenceByСurrency: o.difference_by_currency != null
      ? normalizeBreakdown(o.difference_by_currency) : null,
    closingNote: toStr(o.closing_note),
    closedAt: toStr(o.closed_at) || null,
    createdAt: toStr(o.created_at) || null,
  };
}

const base = (b: string) => `/api/app/${encodeURIComponent(b)}/cash-sessions`;

export async function getCurrentCashSession(business: string): Promise<CashSession | null> {
  const raw = await apiFetch<unknown>(`${base(business)}/current`);
  const root = isObj(raw) ? raw : {};
  return root.session ? normalizeSession(root.session) : null;
}

export type OpenSessionInput = {
  openingAmountByCurrency?: Record<string, number>;
  openingNote?: string;
};

export async function openCashSession(business: string, input: OpenSessionInput = {}): Promise<CashSession> {
  const raw = await apiFetch<unknown>(`${base(business)}/open`, {
    method: "POST",
    json: {
      opening_amount_by_currency: input.openingAmountByCurrency ?? {},
      opening_note: input.openingNote ?? undefined,
    },
  });
  const root = isObj(raw) ? raw : {};
  return normalizeSession(isObj(root.session) ? root.session : root);
}

export type CloseSessionInput = {
  closingAmountByCurrency: Record<string, number>;
  expectedAmountByCurrency?: Record<string, number>;
  closingNote?: string;
};

export async function closeCashSession(
  business: string,
  sessionId: number,
  input: CloseSessionInput
): Promise<CashSession> {
  const raw = await apiFetch<unknown>(`${base(business)}/${sessionId}/close`, {
    method: "PATCH",
    json: {
      closing_amount_by_currency: input.closingAmountByCurrency,
      expected_amount_by_currency: input.expectedAmountByCurrency ?? undefined,
      closing_note: input.closingNote ?? undefined,
    },
  });
  const root = isObj(raw) ? raw : {};
  return normalizeSession(isObj(root.session) ? root.session : root);
}

export type ListCashSessionsParams = {
  from?: string;
  to?: string;
  userId?: number;
  status?: "open" | "closed" | "";
  page?: number;
  perPage?: number;
};

export type CashSessionsResult = {
  items: CashSession[];
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
};

export async function listCashSessions(
  business: string,
  params: ListCashSessionsParams = {}
): Promise<CashSessionsResult> {
  const qp = new URLSearchParams();
  if (params.from) qp.set("from", params.from);
  if (params.to) qp.set("to", params.to);
  if (params.userId) qp.set("user_id", String(params.userId));
  if (params.status) qp.set("status", params.status);
  if (params.page) qp.set("page", String(params.page));
  if (params.perPage) qp.set("per_page", String(params.perPage));

  const path = qp.size > 0 ? `${base(business)}?${qp}` : base(business);
  const raw = await apiFetch<unknown>(path);
  const root = isObj(raw) ? raw : {};
  const data = isObj(root.data) ? root.data : {};
  const meta = isObj(root.meta) ? root.meta : {};
  const items = Array.isArray(data.items) ? data.items : [];

  return {
    items: items.map(normalizeSession),
    currentPage: toNum(meta.current_page, 1),
    lastPage: toNum(meta.last_page, 1),
    perPage: toNum(meta.per_page, 25),
    total: toNum(meta.total, 0),
  };
}
