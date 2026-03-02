"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { getArAging, getArSummary, type ArAgingResult, type ArSummaryResult } from "@/lib/reportsApi";

const EMPTY_SUMMARY: ArSummaryResult = { asOf: "", rows: [], totalAr: 0 };
const EMPTY_AGING: ArAgingResult = {
  asOf: "",
  totals: { current: 0, bucket1_30: 0, bucket31_60: 0, bucket61_90: 0, bucket90Plus: 0 },
  details: { current: [], bucket1_30: [], bucket31_60: [], bucket61_90: [], bucket90Plus: [] },
};

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function ArReportsPage() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";

  const [asOf, setAsOf] = useState("");
  const [summary, setSummary] = useState<ArSummaryResult>(EMPTY_SUMMARY);
  const [aging, setAging] = useState<ArAgingResult>(EMPTY_AGING);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!businessSlug) return;
      setLoading(true);
      setError("");
      try {
        const [summaryRes, agingRes] = await Promise.all([
          getArSummary(businessSlug, { asOf: asOf || undefined }),
          getArAging(businessSlug, { asOf: asOf || undefined }),
        ]);
        if (!mounted) return;
        setSummary(summaryRes);
        setAging(agingRes);
      } catch (e) {
        if (mounted) setError(getErrorMessage(e));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [businessSlug, asOf]);

  return (
    <div className="space-y-5">
      <section className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Creances clients (AR)</h1>
        <p className="text-sm text-slate-500 mt-1">Rapports backend `ar-summary` et `ar-aging`.</p>
      </section>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </section>
      ) : null}

      <section className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-600">Date de reference</label>
          <input
            type="date"
            value={asOf}
            onChange={(event) => setAsOf(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <button
            onClick={() => setAsOf("")}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Aujourd'hui
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total AR" value={formatMoney(summary.totalAr)} tone="text-indigo-700" />
        <StatCard label="Current" value={formatMoney(aging.totals.current)} tone="text-emerald-700" />
        <StatCard label="90+ jours" value={formatMoney(aging.totals.bucket90Plus)} tone="text-rose-700" />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b text-sm font-semibold text-slate-700">AR Summary par client</div>
          {loading ? (
            <div className="py-8 text-center text-slate-500">Chargement...</div>
          ) : summary.rows.length === 0 ? (
            <div className="py-8 text-center text-slate-500">Aucune creance.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-3 pr-3 px-4 font-semibold">Client</th>
                    <th className="py-3 px-4 font-semibold">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.rows.map((row) => (
                    <tr key={`${row.customerId}-${row.name}`} className="border-b last:border-0">
                      <td className="py-3 pr-3 px-4 text-slate-700">{row.name}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{formatMoney(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="text-sm font-semibold text-slate-700 mb-3">Aging buckets</div>
          <div className="space-y-2 text-sm">
            <Bucket label="Current" value={aging.totals.current} />
            <Bucket label="1-30 jours" value={aging.totals.bucket1_30} />
            <Bucket label="31-60 jours" value={aging.totals.bucket31_60} />
            <Bucket label="61-90 jours" value={aging.totals.bucket61_90} />
            <Bucket label="90+ jours" value={aging.totals.bucket90Plus} />
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function Bucket({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-800">
        {new Intl.NumberFormat("fr-FR", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
        }).format(value)}
      </span>
    </div>
  );
}
