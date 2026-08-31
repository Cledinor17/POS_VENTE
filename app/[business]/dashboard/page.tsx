"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { getErrorMessage } from "@/lib/errors";
import { getBusinessSettings, type BusinessSettings } from "@/lib/businessApi";
import { convertAmount, formatMoney as formatCurrency } from "@/lib/currency";
import { listAllPosSales, type PosSaleHistoryItem } from "@/lib/posApi";
import { getInventorySummary, type InventorySummaryResult } from "@/lib/inventoryApi";
import { listCustomers } from "@/lib/customersApi";
import {
  getArAging,
  getArSummary,
  getProfitAndLoss,
  type ArAgingResult,
  type ArSummaryResult,
  type ProfitAndLossResult,
} from "@/lib/reportsApi";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  type ChartOptions,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Boxes,
  CircleDollarSign,
  CreditCard,
  RefreshCcw,
  ShoppingCart,
  Users,
} from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Tooltip,
  Legend,
  Filler
);

type RangeKey = "7d" | "30d" | "90d";
type Tone = "emerald" | "indigo" | "amber" | "sky" | "rose" | "slate";

const RANGE_OPTIONS: Array<{ id: RangeKey; labelKey: "range_7d" | "range_30d" | "range_90d"; days: number }> = [
  { id: "7d", labelKey: "range_7d", days: 7 },
  { id: "30d", labelKey: "range_30d", days: 30 },
  { id: "90d", labelKey: "range_90d", days: 90 },
];

const EMPTY_SUMMARY: InventorySummaryResult = {
  currency: "USD",
  summary: {
    totalProducts: 0,
    trackedProducts: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    stockUnits: 0,
    stockValue: 0,
    potentialRevenue: 0,
  },
  lowStockProducts: [],
};

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toInputDate(date: Date): string {
  return toDateKey(date);
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatMoney(amount: number, currency: string): string {
  return formatCurrency(amount, currency);
}

function formatCompactMoney(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

function normalizeStatus(value: string | null): string {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized || "issued";
}

function statusLabel(status: string | null, t: ReturnType<typeof useTranslations>): string {
  const key = normalizeStatus(status);
  if (key === "paid") return t("status.paid");
  if (key === "partial") return t("status.partial");
  if (key === "void") return t("status.void");
  if (key === "refunded") return t("status.refunded");
  if (key === "draft") return t("status.draft");
  return t("status.issued");
}

function statusTone(status: string | null): string {
  const key = normalizeStatus(status);
  if (key === "paid") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (key === "partial" || key === "issued") return "bg-amber-50 text-amber-700 border-amber-200";
  if (key === "void" || key === "refunded") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function paymentLabel(value: string | null, notSetLabel: string): string {
  const method = (value ?? "").trim();
  if (!method) return notSetLabel;
  return method.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function buildRange(days: number, locale: string): { keys: string[]; labels: string[] } {
  const keys: string[] = [];
  const labels: string[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    keys.push(toDateKey(date));
    labels.push(date.toLocaleDateString(locale, { day: "2-digit", month: "short" }));
  }

  return { keys, labels };
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";

  const [range, setRange] = useState<RangeKey>("30d");
  const [sales, setSales] = useState<PosSaleHistoryItem[]>([]);
  const [inventory, setInventory] = useState<InventorySummaryResult>(EMPTY_SUMMARY);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [customersTotal, setCustomersTotal] = useState(0);
  const [pnl, setPnl] = useState<ProfitAndLossResult | null>(null);
  const [arAging, setArAging] = useState<ArAgingResult | null>(null);
  const [arSummary, setArSummary] = useState<ArSummaryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const loadDashboard = useCallback(
    async (silent = false) => {
      if (!businessSlug) return;
      if (silent) setRefreshing(true);
      else setLoading(true);

      try {
        const now = new Date();
        const asOf = toInputDate(now);
        const monthStart = toInputDate(new Date(now.getFullYear(), now.getMonth(), 1));

        const results = await Promise.allSettled([
          getBusinessSettings(businessSlug),
          listAllPosSales(businessSlug, {}, { perPage: 100 }),
          getInventorySummary(businessSlug),
          listCustomers(businessSlug, { page: 1, perPage: 1 }),
          getProfitAndLoss(businessSlug, { from: monthStart, to: asOf }),
          getArAging(businessSlug, { asOf }),
          getArSummary(businessSlug, { asOf }),
        ]);

        const nextWarnings: string[] = [];
        const addWarning = (label: string, reason: unknown) =>
          nextWarnings.push(`${label}: ${getErrorMessage(reason, t("common_error"))}`);

        const businessRes = results[0];
        if (businessRes.status === "fulfilled") setBusinessSettings(businessRes.value);
        else {
          setBusinessSettings(null);
          addWarning(t("warning_business"), businessRes.reason);
        }

        const salesRes = results[1];
        if (salesRes.status === "fulfilled") setSales(salesRes.value);
        else {
          setSales([]);
          addWarning(t("warning_sales"), salesRes.reason);
        }

        const stockRes = results[2];
        if (stockRes.status === "fulfilled") setInventory(stockRes.value);
        else {
          setInventory(EMPTY_SUMMARY);
          addWarning(t("warning_stock"), stockRes.reason);
        }

        const customersRes = results[3];
        if (customersRes.status === "fulfilled") setCustomersTotal(customersRes.value.total);
        else {
          setCustomersTotal(0);
          addWarning(t("warning_customers"), customersRes.reason);
        }

        const pnlRes = results[4];
        if (pnlRes.status === "fulfilled") setPnl(pnlRes.value);
        else {
          setPnl(null);
          addWarning(t("warning_pnl"), pnlRes.reason);
        }

        const agingRes = results[5];
        if (agingRes.status === "fulfilled") setArAging(agingRes.value);
        else {
          setArAging(null);
          addWarning(t("warning_ar_aging"), agingRes.reason);
        }

        const arSummaryRes = results[6];
        if (arSummaryRes.status === "fulfilled") setArSummary(arSummaryRes.value);
        else {
          setArSummary(null);
          addWarning(t("warning_ar_summary"), arSummaryRes.reason);
        }

        const failures = results.filter((r) => r.status === "rejected").length;
        if (failures === results.length) {
          const rejected = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
          setError(getErrorMessage(rejected?.reason, t("common_error")));
        } else {
          setError("");
        }

        setWarnings(nextWarnings);
        setLastUpdatedAt(new Date().toISOString());
      } catch (e) {
        setError(getErrorMessage(e, t("common_error")));
      } finally {
        if (silent) setRefreshing(false);
        else setLoading(false);
      }
    },
    [businessSlug, t]
  );

  useEffect(() => {
    void loadDashboard(false);
  }, [loadDashboard]);

  const selectedDays = RANGE_OPTIONS.find((item) => item.id === range)?.days ?? 30;
  const exchangeConfig = useMemo(
    () => ({
      exchangeRateDirection: businessSettings?.exchange_rate_direction,
      exchangeRateValue: businessSettings?.exchange_rate_value,
    }),
    [businessSettings]
  );
  const reportCurrency =
    businessSettings?.currency || pnl?.currency || arSummary?.currency || arAging?.currency || inventory.currency || "USD";
  const convertDisplayAmount = useCallback(
    (amount: number, sourceCurrency?: string | null) =>
      convertAmount(amount, sourceCurrency || reportCurrency, reportCurrency, exchangeConfig),
    [exchangeConfig, reportCurrency]
  );

  const insights = useMemo(() => {
    const validSales = sales.filter((sale) => normalizeStatus(sale.status) !== "void");
    const rangeWindow = buildRange(selectedDays, locale);
    const totals = rangeWindow.keys.map(() => 0);
    const tickets = rangeWindow.keys.map(() => 0);
    const indexMap = new Map<string, number>();
    rangeWindow.keys.forEach((key, index) => indexMap.set(key, index));

    const todayKey = toDateKey(new Date());
    let todayTotal = 0;
    let todayTickets = 0;
    let todayPaid = 0;
    let balanceDue = 0;

    const paymentMap = new Map<string, number>();
    const statusMap = new Map<string, number>();

    for (const sale of sales) {
      const status = normalizeStatus(sale.status);
      statusMap.set(status, (statusMap.get(status) ?? 0) + 1);
    }

    for (const sale of validSales) {
      const created = parseDate(sale.createdAt);
      if (!created) continue;
      const saleTotal = convertDisplayAmount(sale.total, sale.currency);
      const salePaid = convertDisplayAmount(sale.amountPaid, sale.currency);
      const saleBalance = convertDisplayAmount(sale.balanceDue, sale.currency);
      const salePaidTotal = convertDisplayAmount(sale.paidTotal, sale.currency);

      const key = toDateKey(created);
      const index = indexMap.get(key);
      if (index !== undefined) {
        totals[index] += saleTotal;
        tickets[index] += 1;
      }

      if (key === todayKey) {
        todayTotal += saleTotal;
        todayTickets += 1;
        todayPaid += salePaid;
      }

      balanceDue += Math.max(0, saleBalance);

      const method = paymentLabel(sale.paymentMethod, t("payment_method_undefined"));
      const amount = sale.paidTotal > 0 ? salePaidTotal : salePaid;
      paymentMap.set(method, (paymentMap.get(method) ?? 0) + Math.max(0, amount));
    }

    const periodTotal = totals.reduce((sum, value) => sum + value, 0);
    const periodTickets = tickets.reduce((sum, value) => sum + value, 0);

    return {
      labels: rangeWindow.labels,
      totals,
      tickets,
      todayTotal,
      todayTickets,
      todayPaid,
      balanceDue,
      avgTicket: periodTickets > 0 ? periodTotal / periodTickets : 0,
      statusRows: Array.from(statusMap.entries())
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
      paymentRows: Array.from(paymentMap.entries())
        .map(([method, amount]) => ({ method, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 6),
    };
  }, [convertDisplayAmount, sales, selectedDays, locale, t]);

  const recentSales = useMemo(() => {
    return [...sales]
      .sort((a, b) => (parseDate(b.createdAt)?.getTime() ?? 0) - (parseDate(a.createdAt)?.getTime() ?? 0))
      .slice(0, 10);
  }, [sales]);

  const salesChartData = useMemo(
    () => ({
      labels: insights.labels,
      datasets: [
        {
          label: t("chart_sales_amount"),
          data: insights.totals,
          yAxisID: "y",
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245, 158, 11, 0.18)",
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 2,
        },
        {
          label: t("chart_tickets"),
          data: insights.tickets,
          yAxisID: "yTickets",
          borderColor: "#0b4f88",
          backgroundColor: "#0b4f88",
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 2,
        },
      ],
    }),
    [insights, t]
  );

  const salesChartOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: { legend: { position: "bottom", labels: { boxWidth: 12, usePointStyle: true } } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, ticks: { callback: (v) => formatCompactMoney(Number(v), reportCurrency, locale) } },
      yTickets: { beginAtZero: true, position: "right", grid: { drawOnChartArea: false }, ticks: { precision: 0 } },
    },
  };

  const paymentChartData = useMemo(
    () => ({
      labels: insights.paymentRows.map((row) => row.method),
      datasets: [
        {
          data: insights.paymentRows.map((row) => row.amount),
          backgroundColor: ["#0b4f88", "#f2b632", "#d97706", "#0f766e", "#92400e", "#7c2d12"],
          borderColor: "#fff",
          borderWidth: 2,
        },
      ],
    }),
    [insights.paymentRows]
  );

  const paymentChartOptions: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "bottom", labels: { boxWidth: 12, usePointStyle: true } } },
  };

  const agingChartData = {
    labels: [t("aging_current"), t("aging_1_30"), t("aging_31_60"), t("aging_61_90"), t("aging_90_plus")],
    datasets: [
      {
        label: t("chart_receivables"),
        data: arAging
          ? [
              arAging.totals.current,
              arAging.totals.bucket1_30,
              arAging.totals.bucket31_60,
              arAging.totals.bucket61_90,
              arAging.totals.bucket90Plus,
            ]
          : [0, 0, 0, 0, 0],
        backgroundColor: ["#0ea5e9", "#22c55e", "#f59e0b", "#f97316", "#dc2626"],
        borderRadius: 8,
        maxBarThickness: 38,
      },
    ],
  };

  const agingChartOptions: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, ticks: { callback: (v) => formatCompactMoney(Number(v), reportCurrency, locale) } },
    },
  };

  const netProfit = pnl?.totals.netProfit ?? 0;
  const monthIncome = pnl?.totals.totalIncome ?? 0;
  const monthExpense = pnl?.totals.totalExpenses ?? 0;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-blue-200 bg-gradient-to-r from-[#0b4f88] via-[#0d63b8] to-[#f59e0b] p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{t("title")}</h1>
            <p className="mt-1 text-sm text-slate-200">{t("subtitle")}</p>
            <p className="mt-2 text-xs text-slate-300">
              {t("last_update", {
                value: lastUpdatedAt ? parseDate(lastUpdatedAt)?.toLocaleString(locale) ?? "" : t("last_update_pending"),
              })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setRange(option.id)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  range === option.id
                    ? "border-white bg-white text-slate-900"
                    : "border-slate-300/40 bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {t(option.labelKey)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void loadDashboard(true)}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300/40 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-60"
            >
              <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {t("refresh")}
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</section>
      ) : null}

      {warnings.length > 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="mb-1 inline-flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            {t("partial_data")}
          </div>
          {warnings.slice(0, 4).map((warning, index) => (
            <p key={`${warning}-${index}`}>- {warning}</p>
          ))}
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard title={t("metric_today_sales")} value={formatMoney(insights.todayTotal, reportCurrency)} note={t("metric_today_sales_note", { count: insights.todayTickets })} icon={CircleDollarSign} tone="emerald" />
        <MetricCard title={t("metric_today_payments")} value={formatMoney(insights.todayPaid, reportCurrency)} note={t("metric_today_payments_note", { value: formatMoney(insights.avgTicket, reportCurrency) })} icon={CreditCard} tone="indigo" />
        <MetricCard title={t("metric_pending_balance")} value={formatMoney(insights.balanceDue, reportCurrency)} note={t("metric_pending_balance_note", { value: formatMoney(arSummary?.totalAr ?? 0, reportCurrency) })} icon={ShoppingCart} tone="amber" />
        <MetricCard title={t("metric_net_result")} value={formatMoney(netProfit, reportCurrency)} note={t("metric_net_result_note", { income: formatMoney(monthIncome, reportCurrency), expense: formatMoney(monthExpense, reportCurrency) })} icon={CircleDollarSign} tone={netProfit >= 0 ? "sky" : "rose"} />
        <MetricCard title={t("metric_stock_value")} value={formatMoney(inventory.summary.stockValue, reportCurrency)} note={t("metric_stock_value_note", { value: formatMoney(inventory.summary.potentialRevenue, reportCurrency) })} icon={Boxes} tone="slate" />
        <MetricCard title={t("metric_customers")} value={formatNumber(customersTotal, locale)} note={t("metric_customers_note", { count: inventory.summary.lowStockCount })} icon={Users} tone="sky" />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title={t("panel_sales_evolution", { days: selectedDays })} loading={loading} className="xl:col-span-2">
          {insights.totals.every((value) => value === 0) ? (
            <EmptyPanel text={t("empty_sales_period")} />
          ) : (
            <div className="h-80">
              <Line data={salesChartData} options={salesChartOptions} />
            </div>
          )}
        </Panel>

        <Panel title={t("panel_payments_by_method")} loading={loading}>
          {insights.paymentRows.length === 0 ? (
            <EmptyPanel text={t("empty_payments_period")} />
          ) : (
            <>
              <div className="h-64">
                <Doughnut data={paymentChartData} options={paymentChartOptions} />
              </div>
              <div className="mt-3 space-y-2">
                {insights.paymentRows.map((row) => (
                  <div key={row.method} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{row.method}</span>
                    <span className="font-semibold text-slate-900">{formatMoney(row.amount, reportCurrency)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title={t("panel_ar_aging")} loading={loading}>
          {arAging ? (
            <>
              <div className="h-56">
                <Bar data={agingChartData} options={agingChartOptions} />
              </div>
              <p className="mt-3 text-sm text-slate-600">{t("total_ar", { value: formatMoney(arSummary?.totalAr ?? 0, reportCurrency) })}</p>
            </>
          ) : (
            <EmptyPanel text={t("empty_ar_data")} />
          )}
        </Panel>

        <Panel title={t("panel_top_customers_ar")} loading={loading}>
          {!arSummary || arSummary.rows.length === 0 ? (
            <EmptyPanel text={t("empty_ar_customer")} />
          ) : (
            <div className="space-y-3">
              {[...arSummary.rows].sort((a, b) => b.balance - a.balance).slice(0, 6).map((row, index) => {
                const ratio = arSummary.totalAr > 0 ? (row.balance / arSummary.totalAr) * 100 : 0;
                return (
                  <div key={`${row.customerId || row.name}-${index}`}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="truncate text-slate-700">{row.name}</span>
                      <span className="font-semibold text-slate-900">{formatMoney(row.balance, reportCurrency)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-[#0b4f88]" style={{ width: `${Math.max(2, Math.min(100, ratio))}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title={t("panel_stock_alerts")} loading={loading}>
          {inventory.lowStockProducts.length === 0 ? (
            <EmptyPanel text={t("empty_stock_alerts")} />
          ) : (
            <div className="space-y-3">
              {inventory.lowStockProducts.slice(0, 6).map((item, index) => (
                <div key={item.id || `${item.sku}-${index}`} className="rounded-xl border border-slate-100 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.sku || t("sku_not_defined")}</p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-semibold text-rose-700">{formatNumber(item.stock, locale)} u</p>
                      <p className="text-slate-500">{t("threshold", { value: formatNumber(item.alertQuantity, locale) })}</p>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-rose-500" style={{ width: `${Math.max(4, Math.min(100, (item.stock / Math.max(1, item.alertQuantity)) * 100))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <Panel title={t("panel_recent_sales")} loading={loading}>
        {recentSales.length === 0 ? (
          <EmptyPanel text={t("empty_recent_sales")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">{t("table_ticket")}</th>
                  <th className="px-3 py-2">{t("table_customer")}</th>
                  <th className="px-3 py-2">{t("table_date")}</th>
                  <th className="px-3 py-2 text-right">{t("table_total")}</th>
                  <th className="px-3 py-2 text-right">{t("table_paid")}</th>
                  <th className="px-3 py-2 text-right">{t("table_remaining")}</th>
                  <th className="px-3 py-2">{t("table_status")}</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((sale, index) => (
                  <tr key={sale.id || `${sale.receiptNo}-${sale.createdAt}-${index}`} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 font-semibold text-slate-800">{sale.receiptNo || "-"}</td>
                    <td className="px-3 py-2 text-slate-700">{sale.customerName || t("counter_customer")}</td>
                    <td className="px-3 py-2 text-slate-600">{parseDate(sale.createdAt)?.toLocaleString(locale) || "-"}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatMoney(convertDisplayAmount(sale.total, sale.currency), reportCurrency)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{formatMoney(convertDisplayAmount(sale.amountPaid, sale.currency), reportCurrency)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{formatMoney(convertDisplayAmount(sale.balanceDue, sale.currency), reportCurrency)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusTone(sale.status)}`}>
                        {statusLabel(sale.status, t)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Panel({
  title,
  children,
  loading = false,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  loading?: boolean;
  className?: string;
}) {
  const t = useTranslations("dashboard");
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <h2 className="mb-3 border-b border-slate-100 pb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
        {title}
      </h2>
      {loading ? <div className="py-12 text-center text-sm text-slate-500">{t("loading")}</div> : children}
    </section>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="py-12 text-center text-sm text-slate-500">{text}</div>;
}

function MetricCard({
  title,
  value,
  note,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  note: string;
  icon: LucideIcon;
  tone: Tone;
}) {
  const tones: Record<Tone, { badge: string; icon: string; value: string }> = {
    emerald: { badge: "bg-emerald-50", icon: "text-emerald-700", value: "text-emerald-800" },
    indigo: { badge: "bg-[#e7f0f9]", icon: "text-[#0b4f88]", value: "text-[#0b4f88]" },
    amber: { badge: "bg-amber-50", icon: "text-amber-700", value: "text-amber-800" },
    sky: { badge: "bg-blue-50", icon: "text-blue-700", value: "text-blue-800" },
    rose: { badge: "bg-rose-50", icon: "text-rose-700", value: "text-rose-800" },
    slate: { badge: "bg-orange-50", icon: "text-orange-700", value: "text-orange-800" },
  };
  const style = tones[tone];

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
          <p className={`mt-2 truncate text-2xl font-bold ${style.value}`}>{value}</p>
          <p className="mt-1 text-xs text-slate-500">{note}</p>
        </div>
        <span className={`inline-flex rounded-xl p-2 ${style.badge}`}>
          <Icon className={`h-5 w-5 ${style.icon}`} />
        </span>
      </div>
    </article>
  );
}
