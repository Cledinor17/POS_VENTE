import { apiFetch } from "./api";

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

export type DepartmentKey = "hotel" | "restaurant" | "bar" | "pool" | "services";

export const DEPT_ICON_MAP: Record<DepartmentKey, string> = {
  hotel: "BedDouble",
  restaurant: "UtensilsCrossed",
  bar: "Wine",
  pool: "Waves",
  services: "Sparkles",
};

export type DepartmentStat = {
  department: DepartmentKey;
  label: string;
  ordersCount: number;
  revenue: number;
  avgTicket: number;
  currency: string;
  extra: Record<string, number>;
};

export type DepartmentReport = {
  from: string;
  to: string;
  currency: string;
  totalRevenue: number;
  totalOrders: number;
  departments: DepartmentStat[];
};

function normalizeDept(raw: unknown): DepartmentStat {
  const o = isObj(raw) ? raw : {};
  const extra = isObj(o.extra) ? o.extra : {};
  const extraNorm: Record<string, number> = {};
  Object.entries(extra).forEach(([k, v]) => { extraNorm[k] = toNum(v); });
  return {
    department: (toStr(o.department, "bar") as DepartmentKey),
    label: toStr(o.label),
    ordersCount: toNum(o.orders_count ?? o.ordersCount),
    revenue: toNum(o.revenue),
    avgTicket: toNum(o.avg_ticket ?? o.avgTicket),
    currency: toStr(o.currency, "HTG"),
    extra: extraNorm,
  };
}

export async function getDepartmentReport(
  business: string,
  from?: string,
  to?: string
): Promise<DepartmentReport> {
  const qp = new URLSearchParams();
  if (from) qp.set("from", from);
  if (to) qp.set("to", to);
  const base = `/api/app/${encodeURIComponent(business)}/reports/departments`;
  const path = qp.size > 0 ? `${base}?${qp}` : base;

  const raw = await apiFetch<unknown>(path);
  const root = isObj(raw) ? raw : {};
  const data = isObj(root.data) ? root.data : {};

  return {
    from: toStr(data.from),
    to: toStr(data.to),
    currency: toStr(data.currency, "HTG"),
    totalRevenue: toNum(data.total_revenue ?? data.totalRevenue),
    totalOrders: toNum(data.total_orders ?? data.totalOrders),
    departments: Array.isArray(data.departments) ? data.departments.map(normalizeDept) : [],
  };
}
