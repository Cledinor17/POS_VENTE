"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  getBalanceSheet,
  getProfitAndLoss,
  getTrialBalance,
  type BalanceSheetResult,
  type ProfitAndLossResult,
  type TrialBalanceResult,
} from "@/lib/reportsApi";

const EMPTY_TB: TrialBalanceResult = {
  rows: [],
  totals: { debit: 0, credit: 0, balanced: false },
};

const EMPTY_PL: ProfitAndLossResult = {
  income: [],
  expenses: [],
  totals: { totalIncome: 0, totalExpenses: 0, netProfit: 0 },
};

const EMPTY_BS: BalanceSheetResult = {
  asOf: "",
  assets: [],
  liabilities: [],
  equity: [],
  totals: { assets: 0, liabilities: 0, equity: 0, balanced: false },
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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfMonthIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

export default function FinanceReportsPage() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";

  const [from, setFrom] = useState(startOfMonthIso());
  const [to, setTo] = useState(todayIso());
  const [asOf, setAsOf] = useState(todayIso());

  const [trialBalance, setTrialBalance] = useState<TrialBalanceResult>(EMPTY_TB);
  const [profitLoss, setProfitLoss] = useState<ProfitAndLossResult>(EMPTY_PL);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetResult>(EMPTY_BS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!businessSlug) return;
      setLoading(true);
      setError("");
      try {
        const [tb, pl, bs] = await Promise.all([
          getTrialBalance(businessSlug, { from, to }),
          getProfitAndLoss(businessSlug, { from, to }),
          getBalanceSheet(businessSlug, { asOf }),
        ]);

        if (!mounted) return;
        setTrialBalance(tb);
        setProfitLoss(pl);
        setBalanceSheet(bs);
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
  }, [businessSlug, from, to, asOf]);

  const topTbRows = useMemo(() => trialBalance.rows.slice(0, 8), [trialBalance.rows]);

  return (
    <div className="space-y-5">
      <section className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Bilan & Resultat</h1>
        <p className="text-sm text-slate-500 mt-1">Rapports backend: trial balance, P&L, balance sheet.</p>
      </section>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </section>
      ) : null}

      <section className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-500">Periode - du</label>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Periode - au</label>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Bilan a date</label>
            <input
              type="date"
              value={asOf}
              onChange={(event) => setAsOf(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total revenus" value={formatMoney(profitLoss.totals.totalIncome)} tone="text-emerald-700" />
        <StatCard label="Total charges" value={formatMoney(profitLoss.totals.totalExpenses)} tone="text-rose-700" />
        <StatCard label="Resultat net" value={formatMoney(profitLoss.totals.netProfit)} tone="text-indigo-700" />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b text-sm font-semibold text-slate-700">
            Trial Balance (top comptes)
          </div>
          {loading ? (
            <div className="py-8 text-center text-slate-500">Chargement...</div>
          ) : topTbRows.length === 0 ? (
            <div className="py-8 text-center text-slate-500">Aucune ligne.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-3 pr-3 px-4 font-semibold">Code</th>
                    <th className="py-3 pr-3 font-semibold">Compte</th>
                    <th className="py-3 pr-3 font-semibold">Debit</th>
                    <th className="py-3 pr-3 font-semibold">Credit</th>
                    <th className="py-3 px-4 font-semibold">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {topTbRows.map((row) => (
                    <tr key={`${row.accountId}-${row.code}`} className="border-b last:border-0">
                      <td className="py-3 pr-3 px-4 text-slate-700">{row.code}</td>
                      <td className="py-3 pr-3 text-slate-700">{row.name}</td>
                      <td className="py-3 pr-3 font-semibold text-slate-800">{formatMoney(row.debit)}</td>
                      <td className="py-3 pr-3 font-semibold text-slate-800">{formatMoney(row.credit)}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{formatMoney(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
          <h2 className="font-bold text-slate-900">Balance Sheet</h2>
          <div className="text-sm text-slate-600">Assets: {formatMoney(balanceSheet.totals.assets)}</div>
          <div className="text-sm text-slate-600">Liabilities: {formatMoney(balanceSheet.totals.liabilities)}</div>
          <div className="text-sm text-slate-600">Equity: {formatMoney(balanceSheet.totals.equity)}</div>
          <div
            className={
              balanceSheet.totals.balanced
                ? "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                : "inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700"
            }
          >
            {balanceSheet.totals.balanced ? "Bilan equilibre" : "Bilan non equilibre"}
          </div>
          <div
            className={
              trialBalance.totals.balanced
                ? "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                : "inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700"
            }
          >
            {trialBalance.totals.balanced ? "Trial balance OK" : "Trial balance KO"}
          </div>
        </aside>
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
