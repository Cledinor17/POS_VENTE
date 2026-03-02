"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ApiError } from "@/lib/api";
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
  BarChart3,
  Boxes,
  CircleDollarSign,
  CreditCard,
  FileText,
  Landmark,
  Package,
  Receipt,
  RefreshCcw,
  ShieldCheck,
  ShoppingCart,
  Truck,
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
type QuickAction = {
  label: string;
  href: (business: string) => string;
  icon: LucideIcon;
  hint: string;
};

const RANGE_OPTIONS: Array<{ id: RangeKey; label: string; days: number }> = [
  { id: "7d", label: "7 jours", days: 7 },
  { id: "30d", label: "30 jours", days: 30 },
  { id: "90d", label: "90 jours", days: 90 },
];

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Nouvelle vente", href: (b) => `/${b}/pos`, icon: ShoppingCart, hint: "Encaisser vite" },
  { label: "Tickets / ventes", href: (b) => `/${b}/sales`, icon: Receipt, hint: "Historique caisse" },
  { label: "Stock & inventaire", href: (b) => `/${b}/inventory`, icon: Boxes, hint: "Mouvements et niveaux" },
  { label: "Produits", href: (b) => `/${b}/products`, icon: Package, hint: "Catalogue" },
  { label: "Clients", href: (b) => `/${b}/customers`, icon: Users, hint: "Creances et suivi" },
  { label: "Fournisseurs", href: (b) => `/${b}/suppliers`, icon: Truck, hint: "Achats" },
  { label: "Documents / devis", href: (b) => `/${b}/documents`, icon: FileText, hint: "Proforma et conversion" },
  { label: "Factures", href: (b) => `/${b}/invoices`, icon: FileText, hint: "Comptes clients" },
  { label: "Comptabilite", href: (b) => `/${b}/accounting`, icon: Landmark, hint: "Journaux et periodes" },
  { label: "Rapports", href: (b) => `/${b}/reports`, icon: BarChart3, hint: "Analyse globale" },
  { label: "Audit & securite", href: (b) => `/${b}/audit`, icon: ShieldCheck, hint: "Tracabilite user" },
];

const EMPTY_SUMMARY: InventorySummaryResult = {
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

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatCompactMoney(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

function normalizeStatus(value: string | null): string {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized || "issued";
}

function statusLabel(status: string | null): string {
  const key = normalizeStatus(status);
  if (key === "paid") return "Paye";
  if (key === "partial") return "Partiel";
  if (key === "void") return "Annule";
  if (key === "refunded") return "Rembourse";
  if (key === "draft") return "Brouillon";
  return "Emis";
}

function statusTone(status: string | null): string {
  const key = normalizeStatus(status);
  if (key === "paid") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (key === "partial" || key === "issued") return "bg-amber-50 text-amber-700 border-amber-200";
  if (key === "void" || key === "refunded") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function paymentLabel(value: string | null): string {
  const method = (value ?? "").trim();
  if (!method) return "Non defini";
  return method.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function buildRange(days: number): { keys: string[]; labels: string[] } {
  const keys: string[] = [];
  const labels: string[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    keys.push(toDateKey(date));
    labels.push(date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }));
  }

  return { keys, labels };
}

export default function DashboardPage() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";

  const [range, setRange] = useState<RangeKey>("30d");
  const [sales, setSales] = useState<PosSaleHistoryItem[]>([]);
  const [inventory, setInventory] = useState<InventorySummaryResult>(EMPTY_SUMMARY);
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
          listAllPosSales(businessSlug, {}, { perPage: 100 }),
          getInventorySummary(businessSlug),
          listCustomers(businessSlug, { page: 1, perPage: 1 }),
          getProfitAndLoss(businessSlug, { from: monthStart, to: asOf }),
          getArAging(businessSlug, { asOf }),
          getArSummary(businessSlug, { asOf }),
        ]);

        const nextWarnings: string[] = [];
        const addWarning = (label: string, reason: unknown) => nextWarnings.push(`${label}: ${getErrorMessage(reason)}`);

        const salesRes = results[0];
        if (salesRes.status === "fulfilled") setSales(salesRes.value);
        else {
          setSales([]);
          addWarning("Ventes", salesRes.reason);
        }

        const stockRes = results[1];
        if (stockRes.status === "fulfilled") setInventory(stockRes.value);
        else {
          setInventory(EMPTY_SUMMARY);
          addWarning("Stock", stockRes.reason);
        }

        const customersRes = results[2];
        if (customersRes.status === "fulfilled") setCustomersTotal(customersRes.value.total);
        else {
          setCustomersTotal(0);
          addWarning("Clients", customersRes.reason);
        }

        const pnlRes = results[3];
        if (pnlRes.status === "fulfilled") setPnl(pnlRes.value);
        else {
          setPnl(null);
          addWarning("Profit/Loss", pnlRes.reason);
        }

        const agingRes = results[4];
        if (agingRes.status === "fulfilled") setArAging(agingRes.value);
        else {
          setArAging(null);
          addWarning("AR Aging", agingRes.reason);
        }

        const arSummaryRes = results[5];
        if (arSummaryRes.status === "fulfilled") setArSummary(arSummaryRes.value);
        else {
          setArSummary(null);
          addWarning("AR Summary", arSummaryRes.reason);
        }

        const failures = results.filter((r) => r.status === "rejected").length;
        if (failures === results.length) {
          const rejected = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
          setError(getErrorMessage(rejected?.reason));
        } else {
          setError("");
        }

        setWarnings(nextWarnings);
        setLastUpdatedAt(new Date().toISOString());
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        if (silent) setRefreshing(false);
        else setLoading(false);
      }
    },
    [businessSlug]
  );

  useEffect(() => {
    void loadDashboard(false);
  }, [loadDashboard]);

  const selectedDays = RANGE_OPTIONS.find((item) => item.id === range)?.days ?? 30;

  const insights = useMemo(() => {
    const validSales = sales.filter((sale) => normalizeStatus(sale.status) !== "void");
    const rangeWindow = buildRange(selectedDays);
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

      const key = toDateKey(created);
      const index = indexMap.get(key);
      if (index !== undefined) {
        totals[index] += sale.total;
        tickets[index] += 1;
      }

      if (key === todayKey) {
        todayTotal += sale.total;
        todayTickets += 1;
        todayPaid += sale.amountPaid;
      }

      balanceDue += Math.max(0, sale.balanceDue);

      const method = paymentLabel(sale.paymentMethod);
      const amount = sale.paidTotal > 0 ? sale.paidTotal : sale.amountPaid;
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
  }, [sales, selectedDays]);

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
          label: "Montant ventes",
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
          label: "Tickets",
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
    [insights]
  );

  const salesChartOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: { legend: { position: "bottom", labels: { boxWidth: 12, usePointStyle: true } } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, ticks: { callback: (v) => formatCompactMoney(Number(v)) } },
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
    labels: ["Courant", "1-30j", "31-60j", "61-90j", "90+j"],
    datasets: [
      {
        label: "Creances",
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
      y: { beginAtZero: true, ticks: { callback: (v) => formatCompactMoney(Number(v)) } },
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
            <h1 className="text-2xl font-semibold">Dashboard dynamique</h1>
            <p className="mt-1 text-sm text-slate-200">Vue temps reel sur ventes, stock, paiements et creances.</p>
            <p className="mt-2 text-xs text-slate-300">
              Derniere mise a jour: {lastUpdatedAt ? parseDate(lastUpdatedAt)?.toLocaleString("fr-FR") : "en attente"}
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
                {option.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void loadDashboard(true)}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300/40 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-60"
            >
              <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Actualiser
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
            Donnees partielles
          </div>
          {warnings.slice(0, 4).map((warning, index) => (
            <p key={`${warning}-${index}`}>- {warning}</p>
          ))}
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Acces rapides</h2>
          <span className="text-xs text-slate-500">Ouvrir un ecran en 1 clic</span>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
                <Link
                  key={action.label}
                  href={action.href(businessSlug)}
                  className="group rounded-xl border border-slate-200 bg-white p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:shadow-md"
                >
                  <div className="mb-2 inline-flex rounded-lg bg-blue-50 p-2 text-[#0b4f88] shadow-sm transition-colors group-hover:bg-orange-100 group-hover:text-orange-600">
                    <Icon className="h-4 w-4" />
                  </div>
                <p className="text-sm font-semibold text-slate-800">{action.label}</p>
                <p className="mt-1 text-xs text-slate-500">{action.hint}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard title="Ventes du jour" value={formatMoney(insights.todayTotal)} note={`${insights.todayTickets} tickets`} icon={CircleDollarSign} tone="emerald" />
        <MetricCard title="Encaissements du jour" value={formatMoney(insights.todayPaid)} note={`Moy. ticket: ${formatMoney(insights.avgTicket)}`} icon={CreditCard} tone="indigo" />
        <MetricCard title="Soldes en attente" value={formatMoney(insights.balanceDue)} note={`AR total: ${formatMoney(arSummary?.totalAr ?? 0)}`} icon={ShoppingCart} tone="amber" />
        <MetricCard title="Resultat net mois" value={formatMoney(netProfit)} note={`CA: ${formatMoney(monthIncome)} | Charges: ${formatMoney(monthExpense)}`} icon={CircleDollarSign} tone={netProfit >= 0 ? "sky" : "rose"} />
        <MetricCard title="Valeur stock" value={formatMoney(inventory.summary.stockValue)} note={`Potentiel: ${formatMoney(inventory.summary.potentialRevenue)}`} icon={Boxes} tone="slate" />
        <MetricCard title="Clients" value={formatNumber(customersTotal)} note={`${inventory.summary.lowStockCount} stock faible`} icon={Users} tone="sky" />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title={`Evolution des ventes (${selectedDays} jours)`} loading={loading} className="xl:col-span-2">
          {insights.totals.every((value) => value === 0) ? (
            <EmptyPanel text="Aucune vente sur la periode." />
          ) : (
            <div className="h-80">
              <Line data={salesChartData} options={salesChartOptions} />
            </div>
          )}
        </Panel>

        <Panel title="Paiements par methode" loading={loading}>
          {insights.paymentRows.length === 0 ? (
            <EmptyPanel text="Aucun paiement sur la periode." />
          ) : (
            <>
              <div className="h-64">
                <Doughnut data={paymentChartData} options={paymentChartOptions} />
              </div>
              <div className="mt-3 space-y-2">
                {insights.paymentRows.map((row) => (
                  <div key={row.method} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{row.method}</span>
                    <span className="font-semibold text-slate-900">{formatMoney(row.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title="Aging creances" loading={loading}>
          {arAging ? (
            <>
              <div className="h-56">
                <Bar data={agingChartData} options={agingChartOptions} />
              </div>
              <p className="mt-3 text-sm text-slate-600">Total creances: {formatMoney(arSummary?.totalAr ?? 0)}</p>
            </>
          ) : (
            <EmptyPanel text="Donnees de creances indisponibles." />
          )}
        </Panel>

        <Panel title="Top clients en creance" loading={loading}>
          {!arSummary || arSummary.rows.length === 0 ? (
            <EmptyPanel text="Aucune creance client." />
          ) : (
            <div className="space-y-3">
              {[...arSummary.rows].sort((a, b) => b.balance - a.balance).slice(0, 6).map((row, index) => {
                const ratio = arSummary.totalAr > 0 ? (row.balance / arSummary.totalAr) * 100 : 0;
                return (
                  <div key={`${row.customerId || row.name}-${index}`}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="truncate text-slate-700">{row.name}</span>
                      <span className="font-semibold text-slate-900">{formatMoney(row.balance)}</span>
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

        <Panel title="Alertes stock" loading={loading}>
          {inventory.lowStockProducts.length === 0 ? (
            <EmptyPanel text="Aucune alerte stock." />
          ) : (
            <div className="space-y-3">
              {inventory.lowStockProducts.slice(0, 6).map((item, index) => (
                <div key={item.id || `${item.sku}-${index}`} className="rounded-xl border border-slate-100 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.sku || "SKU non defini"}</p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-semibold text-rose-700">{formatNumber(item.stock)} u</p>
                      <p className="text-slate-500">Seuil {formatNumber(item.alertQuantity)}</p>
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

      <Panel title="Ventes recentes" loading={loading}>
        {recentSales.length === 0 ? (
          <EmptyPanel text="Aucune vente recente." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Ticket</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Paye</th>
                  <th className="px-3 py-2 text-right">Reste</th>
                  <th className="px-3 py-2">Statut</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((sale, index) => (
                  <tr key={sale.id || `${sale.receiptNo}-${sale.createdAt}-${index}`} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 font-semibold text-slate-800">{sale.receiptNo || "-"}</td>
                    <td className="px-3 py-2 text-slate-700">{sale.customerName || "Client comptoir"}</td>
                    <td className="px-3 py-2 text-slate-600">{parseDate(sale.createdAt)?.toLocaleString("fr-FR") || "-"}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatMoney(sale.total)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{formatMoney(sale.amountPaid)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{formatMoney(sale.balanceDue)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusTone(sale.status)}`}>
                        {statusLabel(sale.status)}
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
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <h2 className="mb-3 border-b border-slate-100 pb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
        {title}
      </h2>
      {loading ? <div className="py-12 text-center text-sm text-slate-500">Chargement...</div> : children}
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
