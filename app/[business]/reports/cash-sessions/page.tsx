"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { usePermissionGuard } from "@/lib/usePermissionGuard";
import {
  listCashSessions,
  type CashSession,
  type ListCashSessionsParams,
} from "@/lib/cashSessionApi";
import { RefreshCcw, TrendingDown, TrendingUp, Minus } from "lucide-react";

function fmt(v: unknown): string {
  if (v instanceof ApiError) return v.message;
  if (v instanceof Error) return v.message;
  return "Une erreur est survenue.";
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function formatBreakdown(breakdown: Record<string, number> | null): string {
  if (!breakdown) return "—";
  return Object.entries(breakdown)
    .filter(([, v]) => v !== 0)
    .map(([k, v]) => `${v.toFixed(2)} ${k}`)
    .join(" + ") || "0";
}

function formatDt(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n + 1);
  return d.toISOString().slice(0, 10);
}

function DiffBadge({ amount, currency }: { amount: number | null; currency: string }) {
  if (amount === null) return <span className="text-slate-400">—</span>;
  if (Math.abs(amount) < 0.01)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
        <Minus className="h-3 w-3" /> Équilibré
      </span>
    );
  if (amount > 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
        <TrendingUp className="h-3 w-3" /> +{formatMoney(amount, currency)}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
      <TrendingDown className="h-3 w-3" /> {formatMoney(amount, currency)}
    </span>
  );
}

export default function CashSessionsHistoryPage() {
  const { allowed, loading: permLoading } = usePermissionGuard("reports.read");
  const params = useParams<{ business: string }>();
  const business = params?.business ?? "";

  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [from, setFrom] = useState(daysAgoIso(7));
  const [to, setTo] = useState(todayIso());
  const [statusFilter, setStatusFilter] = useState<"" | "open" | "closed">("");

  const load = useCallback(async (silent = false) => {
    if (!business) return;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const params: ListCashSessionsParams = { page, perPage: 25 };
      if (from) params.from = from;
      if (to) params.to = to;
      if (statusFilter) params.status = statusFilter;
      const result = await listCashSessions(business, params);
      setSessions(result.items);
      setLastPage(result.lastPage);
      setTotal(result.total);
    } catch (e) {
      setError(fmt(e));
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [business, page, from, to, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  if (permLoading || !allowed) return null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Historique des sessions de caisse</h1>
            <p className="text-sm text-slate-500 mt-0.5">{total} session{total !== 1 ? "s" : ""} trouvée{total !== 1 ? "s" : ""}</p>
          </div>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Actualiser
          </button>
        </div>
      </section>

      {/* Filters */}
      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            Du
            <input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(1); }}
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800"
            />
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            Au
            <input
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPage(1); }}
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800"
            />
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            Statut
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as "" | "open" | "closed"); setPage(1); }}
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800"
            >
              <option value="">Tous</option>
              <option value="open">Ouverte</option>
              <option value="closed">Fermée</option>
            </select>
          </label>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Table */}
      <section className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-400">Chargement...</div>
        ) : sessions.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">Aucune session trouvée pour cette période.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Caissier</th>
                  <th className="px-4 py-3">Ouverture</th>
                  <th className="px-4 py-3">Fonds départ</th>
                  <th className="px-4 py-3">Fermeture</th>
                  <th className="px-4 py-3">Montant compté</th>
                  <th className="px-4 py-3">Attendu</th>
                  <th className="px-4 py-3">Écart</th>
                  <th className="px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{s.userName || "—"}</p>
                      <p className="text-xs text-slate-400">{s.userEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <p>{formatDt(s.openedAt)}</p>
                      {s.openingNote && (
                        <p className="text-xs text-slate-400 truncate max-w-[140px]">{s.openingNote}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {formatBreakdown(s.openingAmountByCurrency)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {s.closedAt ? (
                        <>
                          <p>{formatDt(s.closedAt)}</p>
                          {s.closingNote && (
                            <p className="text-xs text-slate-400 truncate max-w-[140px]">{s.closingNote}</p>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400">En cours…</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {formatBreakdown(s.closingAmountByCurrency)}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {formatBreakdown(s.expectedAmountByCurrency)}
                    </td>
                    <td className="px-4 py-3">
                      <DiffBadge amount={s.differenceAmount} currency={s.currency} />
                    </td>
                    <td className="px-4 py-3">
                      {s.status === "open" ? (
                        <span className="inline-flex rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          Ouverte
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          Fermée
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {lastPage > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
            >
              Précédent
            </button>
            <span className="text-xs text-slate-500">Page {page} / {lastPage}</span>
            <button
              type="button"
              disabled={page >= lastPage}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
            >
              Suivant
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
