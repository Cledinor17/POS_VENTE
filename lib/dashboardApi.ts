import { apiFetch } from "./api";
import type { BusinessSettings } from "./businessApi";

export type DashboardSettings = Pick<BusinessSettings, "currency" | "timezone" | "exchange_rate_direction" | "exchange_rate_value" | "exchange_buy_rate" | "exchange_sell_rate">;
export type DashboardSales = {
  currency: string;
  days: Array<{ date: string; total: number; tickets: number }>;
  today: { total: number; tickets: number; paid: number };
  balanceDue: number;
  avgTicket: number;
  statusRows: Array<{ status: string; count: number }>;
  paymentRows: Array<{ method: string; amount: number }>;
};
export const getDashboardSettings = (business: string) => apiFetch<DashboardSettings>(`/api/app/${encodeURIComponent(business)}/dashboard/settings`);
export const getDashboardSales = (business: string, from: string, to: string) => apiFetch<DashboardSales>(`/api/app/${encodeURIComponent(business)}/dashboard/sales-summary?from=${from}&to=${to}`);
