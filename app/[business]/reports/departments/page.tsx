"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/currency";
import {
  getDepartmentReport,
  type DepartmentReport,
  type DepartmentKey,
} from "@/lib/departmentReportApi";
import {
  BarChart3,
  BedDouble,
  RefreshCcw,
  Sparkles,
  UtensilsCrossed,
  Waves,
  Wine,
} from "lucide-react";

const DEPT_ICONS: Record<DepartmentKey, React.ReactNode> = {
  hotel: <BedDouble className="h-5 w-5" />,
  restaurant: <UtensilsCrossed className="h-5 w-5" />,
  bar: <Wine className="h-5 w-5" />,
  pool: <Waves className="h-5 w-5" />,
  services: <Sparkles className="h-5 w-5" />,
};

const DEPT_COLORS: Record<DepartmentKey, string> = {
  hotel: "bg-blue-50 text-blue-700 border-blue-200",
  restaurant: "bg-amber-50 text-amber-700 border-amber-200",
  bar: "bg-purple-50 text-purple-700 border-purple-200",
  pool: "bg-cyan-50 text-cyan-700 border-cyan-200",
  services: "bg-pink-50 text-pink-700 border-pink-200",
};

const DEPT_PROGRESS: Record<DepartmentKey, string> = {
  hotel: "bg-blue-500",
  restaurant: "bg-amber-500",
  bar: "bg-purple-500",
  pool: "bg-cyan-500",
  services: "bg-pink-500",
};

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function err(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Erreur inconnue.";
}

export default function DepartmentReportPage() {
  const params = useParams<{ business: string }>();
  const business = params?.business ?? "";

  const [report, setReport] = useState<DepartmentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [from, setFrom] = useState(getMonthStart());
  const [to, setTo] = useState(getTodayString());

  const load = useCallback(async (silent = false) => {
    if (!business) return;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      setReport(await getDepartmentReport(business, from, to));
    } catch (e) {
      setError(err(e));
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [business, from, to]);

  useEffect(() => { void load(); }, [load]);

  const maxRevenue = report
    ? Math.max(...report.departments.map((d) => d.revenue), 1)
    : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-800 to-slate-700 p-5 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-200">
              <BarChart3 className="h-3.5 w-3.5" /> Rapports
            </div>
            <h1 className="mt-3 text-2xl font-semibold">Revenus par departement</h1>
            <p className="mt-1 text-sm text-slate-300">
              Comparaison hotel, restaurant, bar, piscine et services.
            </p>
          </div>
          <button type="button" onClick={() => void load(true)} disabled={loading || refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-60">
            <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Actualiser
          </button>
        </div>
      </section>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="space-y-1 text-sm">
          <span className="font-semibold text-slate-700">Du</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="block rounded-xl border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-semibold text-slate-700">Au</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="block rounded-xl border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={() => { setFrom(getTodayString()); setTo(getTodayString()); }}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Aujourd&apos;hui
          </button>
          <button type="button" onClick={() => { setFrom(getMonthStart()); setTo(getTodayString()); }}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Ce mois
          </button>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Chargement...</div>
      ) : report ? (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Revenu total</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">
                {formatMoney(report.totalRevenue, report.currency)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total operations</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">{report.totalOrders}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Periode</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">
                {new Date(report.from).toLocaleDateString("fr-FR")} – {new Date(report.to).toLocaleDateString("fr-FR")}
              </p>
            </div>
          </div>

          {/* Department breakdown */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Revenus par departement
            </h2>
            <div className="space-y-4">
              {report.departments.map((dept) => {
                const pct = report.totalRevenue > 0 ? Math.round((dept.revenue / report.totalRevenue) * 100) : 0;
                const colorClass = DEPT_COLORS[dept.department] ?? "bg-slate-50 text-slate-700 border-slate-200";
                const progressClass = DEPT_PROGRESS[dept.department] ?? "bg-slate-400";
                return (
                  <div key={dept.department}>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex rounded-xl border p-2 ${colorClass}`}>
                          {DEPT_ICONS[dept.department]}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-800">{dept.label}</p>
                          <p className="text-xs text-slate-500">
                            {dept.ordersCount} operation{dept.ordersCount !== 1 ? "s" : ""} · moy.{" "}
                            {formatMoney(dept.avgTicket, dept.currency)}
                            {dept.extra.total_persons ? ` · ${dept.extra.total_persons} pers.` : ""}
                          </p>
                          {dept.department === "hotel" && dept.revenue > 0 && (
                            <p className="mt-0.5 text-xs text-slate-400">
                              {dept.extra.sejours_revenue > 0 && `Sejours ${formatMoney(dept.extra.sejours_revenue, dept.currency)}`}
                              {dept.extra.moments_revenue > 0 && ` · Moments ${formatMoney(dept.extra.moments_revenue, dept.currency)}`}
                              {dept.extra.room_service_revenue > 0 && ` · Room svc ${formatMoney(dept.extra.room_service_revenue, dept.currency)}`}
                              {dept.extra.folio_charges_revenue > 0 && ` · Folio ${formatMoney(dept.extra.folio_charges_revenue, dept.currency)}`}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900">{formatMoney(dept.revenue, dept.currency)}</p>
                        <p className="text-xs text-slate-500">{pct}%</p>
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${progressClass}`}
                        style={{ width: `${Math.min(100, (dept.revenue / maxRevenue) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed table */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Departement</th>
                  <th className="px-5 py-3 text-right">Operations</th>
                  <th className="px-5 py-3 text-right">Revenu total</th>
                  <th className="px-5 py-3 text-right">Ticket moyen</th>
                  <th className="px-5 py-3 text-right">Part (%)</th>
                </tr>
              </thead>
              <tbody>
                {report.departments.map((dept) => {
                  const pct = report.totalRevenue > 0
                    ? ((dept.revenue / report.totalRevenue) * 100).toFixed(1)
                    : "0.0";
                  return (
                    <tr key={dept.department} className="border-t border-slate-100">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex rounded-lg border p-1.5 ${DEPT_COLORS[dept.department] ?? "bg-slate-50 border-slate-200 text-slate-700"}`}>
                            {DEPT_ICONS[dept.department]}
                          </span>
                          <span className="font-medium text-slate-800">{dept.label}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right text-slate-700">{dept.ordersCount}</td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-900">
                        {formatMoney(dept.revenue, dept.currency)}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-700">
                        {formatMoney(dept.avgTicket, dept.currency)}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-700">{pct}%</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                  <td className="px-5 py-3 text-slate-800">Total</td>
                  <td className="px-5 py-3 text-right text-slate-800">{report.totalOrders}</td>
                  <td className="px-5 py-3 text-right text-slate-900">{formatMoney(report.totalRevenue, report.currency)}</td>
                  <td className="px-5 py-3 text-right text-slate-700">
                    {report.totalOrders > 0 ? formatMoney(report.totalRevenue / report.totalOrders, report.currency) : "—"}
                  </td>
                  <td className="px-5 py-3 text-right text-slate-800">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
