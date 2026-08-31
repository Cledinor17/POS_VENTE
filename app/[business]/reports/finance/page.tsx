"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { usePermissionGuard } from "@/lib/usePermissionGuard";
import { ApiError } from "@/lib/api";
import { formatMoney as formatCurrency } from "@/lib/currency";
import {
  getBalanceSheet,
  getCashFlow,
  getProfitAndLoss,
  getTrialBalance,
  type BalanceSheetResult,
  type CashFlowResult,
  type ProfitAndLossResult,
  type TrialBalanceResult,
} from "@/lib/reportsApi";
import { getDepartmentReport, type DepartmentReport, type DepartmentStat } from "@/lib/departmentReportApi";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  type ChartOptions,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import {
  AlertTriangle,
  BedDouble,
  CircleDollarSign,
  RefreshCcw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Waves,
  Wine,
  UtensilsCrossed,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const EMPTY_TB: TrialBalanceResult = {
  currency: "USD",
  rows: [],
  totals: { debit: 0, credit: 0, balanced: false },
};

const EMPTY_PL: ProfitAndLossResult = {
  currency: "USD",
  income: [],
  expenses: [],
  totals: { totalIncome: 0, totalExpenses: 0, netProfit: 0 },
};

const EMPTY_BS: BalanceSheetResult = {
  currency: "USD",
  asOf: "",
  assets: [],
  liabilities: [],
  equity: [],
  totals: { assets: 0, liabilities: 0, equity: 0, balanced: false },
};

const EMPTY_CF: CashFlowResult = {
  currency: "USD",
  openingBalance: 0,
  closingBalance: 0,
  inflows: [],
  outflows: [],
  totals: { totalInflows: 0, totalOutflows: 0, netChange: 0 },
};

const EMPTY_DR: DepartmentReport = {
  from: "",
  to: "",
  currency: "HTG",
  totalRevenue: 0,
  totalOrders: 0,
  departments: [],
};

type RangeKey = "today" | "7d" | "30d" | "month";

const RANGE_OPTIONS: Array<{ id: RangeKey; label: string }> = [
  { id: "today", label: "Aujourd hui" },
  { id: "7d", label: "7 jours" },
  { id: "30d", label: "30 jours" },
  { id: "month", label: "Ce mois" },
];

const DEPT_ICONS: Record<string, LucideIcon> = {
  hotel: BedDouble,
  restaurant: UtensilsCrossed,
  bar: Wine,
  pool: Waves,
  services: Sparkles,
};

const DEPT_COLORS: Record<string, string> = {
  hotel: "#0b4f88",
  restaurant: "#16a34a",
  bar: "#f59e0b",
  pool: "#0ea5e9",
  services: "#9333ea",
};

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

function formatMoney(amount: number, currency: string): string {
  return formatCurrency(amount, currency);
}

function formatCompactMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfMonthIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n + 1);
  return d.toISOString().slice(0, 10);
}

function rangeFromKey(key: RangeKey): { from: string; to: string } {
  const today = todayIso();
  if (key === "today") return { from: today, to: today };
  if (key === "7d") return { from: daysAgoIso(7), to: today };
  if (key === "30d") return { from: daysAgoIso(30), to: today };
  return { from: startOfMonthIso(), to: today };
}

export default function FinanceReportsPage() {
  const { allowed, loading: permLoading } = usePermissionGuard("reports.read");
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";

  const [rangeKey, setRangeKey] = useState<RangeKey>("month");
  const [customFrom, setCustomFrom] = useState(startOfMonthIso());
  const [customTo, setCustomTo] = useState(todayIso());
  const [useCustom, setUseCustom] = useState(false);

  const { from, to } = useMemo(() => {
    if (useCustom) return { from: customFrom, to: customTo };
    return rangeFromKey(rangeKey);
  }, [rangeKey, customFrom, customTo, useCustom]);

  const [trialBalance, setTrialBalance] = useState<TrialBalanceResult>(EMPTY_TB);
  const [profitLoss, setProfitLoss] = useState<ProfitAndLossResult>(EMPTY_PL);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetResult>(EMPTY_BS);
  const [cashFlow, setCashFlow] = useState<CashFlowResult>(EMPTY_CF);
  const [deptReport, setDeptReport] = useState<DepartmentReport>(EMPTY_DR);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const reportCurrency = deptReport.currency || profitLoss.currency || trialBalance.currency || "HTG";

  const loadAll = useCallback(
    async (silent = false) => {
      if (!businessSlug) return;
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const [tb, pl, bs, dr, cf] = await Promise.allSettled([
          getTrialBalance(businessSlug, { from, to }),
          getProfitAndLoss(businessSlug, { from, to }),
          getBalanceSheet(businessSlug, { asOf: to }),
          getDepartmentReport(businessSlug, from, to),
          getCashFlow(businessSlug, { from, to }),
        ]);

        if (tb.status === "fulfilled") setTrialBalance(tb.value);
        else setTrialBalance(EMPTY_TB);

        if (pl.status === "fulfilled") setProfitLoss(pl.value);
        else setProfitLoss(EMPTY_PL);

        if (bs.status === "fulfilled") setBalanceSheet(bs.value);
        else setBalanceSheet(EMPTY_BS);

        if (dr.status === "fulfilled") setDeptReport(dr.value);
        else setDeptReport(EMPTY_DR);

        if (cf.status === "fulfilled") setCashFlow(cf.value);
        else setCashFlow(EMPTY_CF);

        const anyFailed = [tb, pl, bs, dr, cf].some((r) => r.status === "rejected");
        if (anyFailed && [tb, pl, bs, dr, cf].every((r) => r.status === "rejected")) {
          const first = [tb, pl, bs, dr, cf].find((r): r is PromiseRejectedResult => r.status === "rejected");
          setError(getErrorMessage(first?.reason));
        }

        setLastUpdated(new Date().toISOString());
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        if (silent) setRefreshing(false);
        else setLoading(false);
      }
    },
    [businessSlug, from, to]
  );

  useEffect(() => {
    void loadAll(false);
  }, [loadAll]);

  const netProfit = profitLoss.totals.netProfit;
  const totalIncome = profitLoss.totals.totalIncome;
  const totalExpenses = profitLoss.totals.totalExpenses;
  const totalDeptRevenue = deptReport.totalRevenue;

  const deptChartData = useMemo(() => {
    const depts = deptReport.departments.filter((d) => d.revenue > 0);
    return {
      labels: depts.map((d) => d.label),
      datasets: [
        {
          label: "Revenus",
          data: depts.map((d) => d.revenue),
          backgroundColor: depts.map((d) => DEPT_COLORS[d.department] ?? "#94a3b8"),
          borderRadius: 8,
          maxBarThickness: 56,
        },
      ],
    };
  }, [deptReport.departments]);

  const deptChartOptions: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: {
        beginAtZero: true,
        ticks: { callback: (v) => formatCompactMoney(Number(v), reportCurrency) },
      },
    },
  };

  const incomeChartData = useMemo(() => {
    const rows = profitLoss.income.filter((r) => r.amount > 0).slice(0, 8);
    return {
      labels: rows.map((r) => r.name),
      datasets: [
        {
          label: "Revenus comptables",
          data: rows.map((r) => r.amount),
          backgroundColor: "#16a34a",
          borderRadius: 6,
          maxBarThickness: 40,
        },
      ],
    };
  }, [profitLoss.income]);

  const expenseChartData = useMemo(() => {
    const rows = profitLoss.expenses.filter((r) => r.amount > 0).slice(0, 8);
    return {
      labels: rows.map((r) => r.name),
      datasets: [
        {
          label: "Charges",
          data: rows.map((r) => r.amount),
          backgroundColor: "#dc2626",
          borderRadius: 6,
          maxBarThickness: 40,
        },
      ],
    };
  }, [profitLoss.expenses]);

  const simpleBarOptions: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: {
        beginAtZero: true,
        ticks: { callback: (v) => formatCompactMoney(Number(v), reportCurrency) },
      },
    },
  };

  if (permLoading || !allowed) return null;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-blue-200 bg-gradient-to-r from-[#0b4f88] via-[#0d63b8] to-emerald-600 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Tableau de bord financier</h1>
            <p className="mt-1 text-sm text-slate-200">
              Revenus par departement, P&L, bilan et ecritures comptables.
            </p>
            {lastUpdated ? (
              <p className="mt-2 text-xs text-slate-300">
                Mis a jour: {new Date(lastUpdated).toLocaleString("fr-FR")}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => { setRangeKey(opt.id); setUseCustom(false); }}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  !useCustom && rangeKey === opt.id
                    ? "border-white bg-white text-slate-900"
                    : "border-slate-300/40 bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {opt.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void loadAll(true)}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300/40 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-60"
            >
              <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Actualiser
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="space-y-0.5 text-xs">
            <span className="text-slate-300">Du</span>
            <input
              type="date"
              value={useCustom ? customFrom : from}
              onChange={(e) => { setCustomFrom(e.target.value); setUseCustom(true); }}
              className="block w-40 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white placeholder-slate-300 focus:outline-none"
            />
          </label>
          <label className="space-y-0.5 text-xs">
            <span className="text-slate-300">Au</span>
            <input
              type="date"
              value={useCustom ? customTo : to}
              onChange={(e) => { setCustomTo(e.target.value); setUseCustom(true); }}
              className="block w-40 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white placeholder-slate-300 focus:outline-none"
            />
          </label>
        </div>
      </section>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{error}</span>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Revenus departementaux"
          value={formatMoney(totalDeptRevenue, reportCurrency)}
          sub={`${formatNumber(deptReport.totalOrders)} transactions`}
          icon={CircleDollarSign}
          color="emerald"
        />
        <KpiCard
          title="Revenus comptables"
          value={formatMoney(totalIncome, reportCurrency)}
          sub={`${profitLoss.income.length} comptes de produits`}
          icon={TrendingUp}
          color="blue"
        />
        <KpiCard
          title="Charges"
          value={formatMoney(totalExpenses, reportCurrency)}
          sub={`${profitLoss.expenses.length} comptes de charges`}
          icon={TrendingDown}
          color="rose"
        />
        <KpiCard
          title="Resultat net"
          value={formatMoney(netProfit, reportCurrency)}
          sub={netProfit >= 0 ? "Benefice" : "Deficit"}
          icon={netProfit >= 0 ? TrendingUp : TrendingDown}
          color={netProfit >= 0 ? "emerald" : "rose"}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <BsCard label="Total actifs" value={formatMoney(balanceSheet.totals.assets, reportCurrency)} />
        <BsCard label="Total passifs" value={formatMoney(balanceSheet.totals.liabilities, reportCurrency)} />
        <BsCard
          label="Capitaux propres"
          value={formatMoney(balanceSheet.totals.equity, reportCurrency)}
          badge={balanceSheet.totals.balanced ? "Bilan equilibre" : "Bilan non equilibre"}
          badgeOk={balanceSheet.totals.balanced}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title="Revenus par departement" loading={loading} className="xl:col-span-2">
          {deptReport.departments.filter((d) => d.revenue > 0).length === 0 ? (
            <EmptyPanel text="Aucun revenu departement sur la periode." />
          ) : (
            <>
              <div className="h-56">
                <Bar data={deptChartData} options={deptChartOptions} />
              </div>
              <div className="mt-4 space-y-2">
                {deptReport.departments
                  .filter((d) => d.revenue > 0)
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((dept) => (
                    <DeptRow key={dept.department} dept={dept} total={totalDeptRevenue} currency={reportCurrency} />
                  ))}
              </div>
            </>
          )}
        </Panel>

        <Panel title="Equilibre bilan" loading={loading}>
          <div className="space-y-3">
            <BalanceRow label="Actifs" amount={balanceSheet.totals.assets} currency={reportCurrency} rows={balanceSheet.assets} />
            <BalanceRow label="Passifs" amount={balanceSheet.totals.liabilities} currency={reportCurrency} rows={balanceSheet.liabilities} />
            <BalanceRow label="Capitaux" amount={balanceSheet.totals.equity} currency={reportCurrency} rows={balanceSheet.equity} />
          </div>
          <div className="mt-4 space-y-2">
            <StatusBadge ok={balanceSheet.totals.balanced} label={balanceSheet.totals.balanced ? "Bilan equilibre" : "Bilan non equilibre"} />
            <StatusBadge ok={trialBalance.totals.balanced} label={trialBalance.totals.balanced ? "Balance de verification OK" : "Balance de verification KO"} />
          </div>
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Comptes de produits (P&L)" loading={loading}>
          {profitLoss.income.length === 0 ? (
            <EmptyPanel text="Aucun produit comptabilise sur la periode." />
          ) : (
            <>
              <div className="h-48">
                <Bar data={incomeChartData} options={simpleBarOptions} />
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[360px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-slate-500">
                      <th className="pb-2 font-semibold">Compte</th>
                      <th className="pb-2 text-right font-semibold">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profitLoss.income.map((row, i) => (
                      <tr key={`${row.accountId}-${i}`} className="border-b last:border-0">
                        <td className="py-2 text-slate-700">{row.name}</td>
                        <td className="py-2 text-right font-semibold text-emerald-700">{formatMoney(row.amount, reportCurrency)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-200">
                      <td className="py-2 font-bold text-slate-900">Total revenus</td>
                      <td className="py-2 text-right font-bold text-emerald-800">{formatMoney(totalIncome, reportCurrency)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>

        <Panel title="Comptes de charges (P&L)" loading={loading}>
          {profitLoss.expenses.length === 0 ? (
            <EmptyPanel text="Aucune charge comptabilisee sur la periode." />
          ) : (
            <>
              <div className="h-48">
                <Bar data={expenseChartData} options={simpleBarOptions} />
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[360px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-slate-500">
                      <th className="pb-2 font-semibold">Compte</th>
                      <th className="pb-2 text-right font-semibold">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profitLoss.expenses.map((row, i) => (
                      <tr key={`${row.accountId}-${i}`} className="border-b last:border-0">
                        <td className="py-2 text-slate-700">{row.name}</td>
                        <td className="py-2 text-right font-semibold text-rose-700">{formatMoney(row.amount, reportCurrency)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-200">
                      <td className="py-2 font-bold text-slate-900">Total charges</td>
                      <td className="py-2 text-right font-bold text-rose-800">{formatMoney(totalExpenses, reportCurrency)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>
      </section>

      <Panel title="Flux de tresorerie" loading={loading}>
        {cashFlow.inflows.length === 0 && cashFlow.outflows.length === 0 ? (
          <EmptyPanel text="Aucun mouvement de tresorerie sur la periode." />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <CfCard label="Solde d ouverture" value={formatMoney(cashFlow.openingBalance, reportCurrency)} />
              <CfCard label="Encaissements" value={formatMoney(cashFlow.totals.totalInflows, reportCurrency)} tone="emerald" />
              <CfCard label="Decaissements" value={formatMoney(cashFlow.totals.totalOutflows, reportCurrency)} tone="rose" />
              <CfCard label="Solde de cloture" value={formatMoney(cashFlow.closingBalance, reportCurrency)} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[280px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-slate-500">
                      <th className="pb-2 font-semibold">Encaissements</th>
                      <th className="pb-2 text-right font-semibold">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashFlow.inflows.map((row) => (
                      <tr key={row.action} className="border-b last:border-0">
                        <td className="py-2 text-slate-700">{row.label}</td>
                        <td className="py-2 text-right font-semibold text-emerald-700">{formatMoney(row.amount, reportCurrency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[280px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-slate-500">
                      <th className="pb-2 font-semibold">Decaissements</th>
                      <th className="pb-2 text-right font-semibold">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashFlow.outflows.map((row) => (
                      <tr key={row.action} className="border-b last:border-0">
                        <td className="py-2 text-slate-700">{row.label}</td>
                        <td className="py-2 text-right font-semibold text-rose-700">{formatMoney(row.amount, reportCurrency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </Panel>

      <Panel title="Balance de verification (tous les comptes)" loading={loading}>
        {trialBalance.rows.length === 0 ? (
          <EmptyPanel text="Aucune ecriture comptable sur la periode." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Compte</th>
                  <th className="px-3 py-2 text-right">Debit</th>
                  <th className="px-3 py-2 text-right">Credit</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {trialBalance.rows.map((row) => (
                  <tr key={`${row.accountId}-${row.code}`} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 font-mono text-slate-600">{row.code}</td>
                    <td className="px-3 py-2 text-slate-800">{row.name}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{formatMoney(row.debit, reportCurrency)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{formatMoney(row.credit, reportCurrency)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${row.balance >= 0 ? "text-slate-900" : "text-rose-700"}`}>
                      {formatMoney(row.balance, reportCurrency)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                  <td className="px-3 py-2 text-slate-700" colSpan={2}>TOTAUX</td>
                  <td className="px-3 py-2 text-right text-slate-900">{formatMoney(trialBalance.totals.debit, reportCurrency)}</td>
                  <td className="px-3 py-2 text-right text-slate-900">{formatMoney(trialBalance.totals.credit, reportCurrency)}</td>
                  <td className="px-3 py-2 text-right">
                    <StatusBadge ok={trialBalance.totals.balanced} label={trialBalance.totals.balanced ? "Equilibre" : "Non equilibre"} />
                  </td>
                </tr>
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
  return <div className="py-10 text-center text-sm text-slate-500">{text}</div>;
}

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  sub: string;
  icon: LucideIcon;
  color: "emerald" | "blue" | "rose";
}) {
  const colors = {
    emerald: { badge: "bg-emerald-50", icon: "text-emerald-700", value: "text-emerald-800" },
    blue: { badge: "bg-blue-50", icon: "text-[#0b4f88]", value: "text-[#0b4f88]" },
    rose: { badge: "bg-rose-50", icon: "text-rose-700", value: "text-rose-800" },
  };
  const c = colors[color];
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
          <p className={`mt-2 truncate text-2xl font-bold ${c.value}`}>{value}</p>
          <p className="mt-1 text-xs text-slate-500">{sub}</p>
        </div>
        <span className={`inline-flex rounded-xl p-2 ${c.badge}`}>
          <Icon className={`h-5 w-5 ${c.icon}`} />
        </span>
      </div>
    </article>
  );
}

function BsCard({
  label,
  value,
  badge,
  badgeOk,
}: {
  label: string;
  value: string;
  badge?: string;
  badgeOk?: boolean;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
      {badge ? <StatusBadge ok={badgeOk ?? false} label={badge} /> : null}
    </article>
  );
}

function CfCard({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "emerald" | "rose";
}) {
  const toneClass = tone === "emerald" ? "text-emerald-800" : tone === "rose" ? "text-rose-800" : "text-slate-900";
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-xl font-bold ${toneClass}`}>{value}</p>
    </article>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-700"
      }`}
    >
      {label}
    </span>
  );
}

function DeptRow({
  dept,
  total,
  currency,
}: {
  dept: DepartmentStat;
  total: number;
  currency: string;
}) {
  const Icon = DEPT_ICONS[dept.department] ?? CircleDollarSign;
  const color = DEPT_COLORS[dept.department] ?? "#94a3b8";
  const pct = total > 0 ? (dept.revenue / total) * 100 : 0;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 flex-shrink-0 text-slate-500" />
          <span className="truncate text-slate-700">{dept.label}</span>
          {dept.ordersCount > 0 ? (
            <span className="text-xs text-slate-400">{dept.ordersCount} tx</span>
          ) : null}
        </div>
        <span className="font-semibold text-slate-900 flex-shrink-0">
          {formatMoney(dept.revenue, currency)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${Math.max(2, Math.min(100, pct))}%`, backgroundColor: color }}
        />
      </div>
      {dept.extra && Object.keys(dept.extra).some((k) => k.endsWith("_revenue") && dept.extra[k] > 0) ? (
        <p className="mt-0.5 text-[11px] text-slate-400">
          {Object.entries(dept.extra)
            .filter(([k, v]) => k.endsWith("_revenue") && Number(v) > 0)
            .map(([k, v]) => `${k.replace("_revenue", "").replace(/_/g, " ")}: ${formatMoney(Number(v), currency)}`)
            .join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

function BalanceRow({
  label,
  amount,
  currency,
  rows,
}: {
  label: string;
  amount: number;
  currency: string;
  rows: Array<{ name: string; balance?: number; amount?: number; accountId: string | number }>;
}) {
  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
        <span>{label}</span>
        <span>{formatMoney(amount, currency)}</span>
      </div>
      {rows.slice(0, 4).map((row, i) => (
        <div key={`${row.accountId}-${i}`} className="mt-1 flex items-center justify-between text-xs text-slate-500">
          <span className="truncate">{row.name}</span>
          <span>{formatMoney(row.balance ?? row.amount ?? 0, currency)}</span>
        </div>
      ))}
      {rows.length > 4 ? (
        <p className="mt-1 text-xs text-slate-400">+{rows.length - 4} comptes</p>
      ) : null}
    </div>
  );
}
