"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  createPayrollRun,
  deletePayrollRun,
  finalizePayrollRun,
  getPayrollRun,
  listPayrollRuns,
  type PayrollRunDetail,
  type PayrollRunSummary,
} from "@/lib/payrollApi";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

function formatMoney(amount: number, currency: string): string {
  const nextCurrency = (currency || "USD").trim().toUpperCase();
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: nextCurrency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${nextCurrency}`;
  }
}

function formatDate(value: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR");
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfMonthIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

export default function PayrollPage() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";

  const [runs, setRuns] = useState<PayrollRunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<PayrollRunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState(startOfMonthIso());
  const [periodEnd, setPeriodEnd] = useState(todayIso());
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadRuns = useCallback(async () => {
    if (!businessSlug) return;
    setLoading(true);
    setError("");
    try {
      const result = await listPayrollRuns(businessSlug);
      setRuns(result.items);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [businessSlug]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  const loadDetail = useCallback(
    async (runId: string) => {
      if (!businessSlug || !runId) return;
      setDetailLoading(true);
      setError("");
      try {
        const result = await getPayrollRun(businessSlug, runId);
        setDetail(result);
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        setDetailLoading(false);
      }
    },
    [businessSlug]
  );

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  async function onCreateRun(e: FormEvent) {
    e.preventDefault();
    if (!businessSlug) return;
    setSaving(true);
    setError("");
    setInfo("");
    try {
      const created = await createPayrollRun(businessSlug, { periodStart: periodStart, periodEnd: periodEnd });
      setFormOpen(false);
      await loadRuns();
      setSelectedId(created.id);
      setInfo("Paie creee en brouillon. Verifiez les bulletins puis finalisez.");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function onFinalize() {
    if (!businessSlug || !selectedId) return;
    setBusy(true);
    setError("");
    setInfo("");
    try {
      await finalizePayrollRun(businessSlug, selectedId);
      await loadRuns();
      await loadDetail(selectedId);
      setInfo("Paie finalisee : paiements et ecritures comptables generes.");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!businessSlug || !selectedId) return;
    if (!window.confirm("Supprimer ce brouillon de paie ?")) return;
    setBusy(true);
    setError("");
    try {
      await deletePayrollRun(businessSlug, selectedId);
      setSelectedId("");
      setDetail(null);
      await loadRuns();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-blue-200 bg-gradient-to-r from-[#0b4f88] via-[#0d63b8] to-emerald-600 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Paie</h1>
            <p className="mt-1 text-sm text-slate-200">
              Generez les bulletins de salaire par periode et finalisez pour poser les paiements et ecritures comptables.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white px-4 py-2 text-sm font-semibold text-[#0b4f88] hover:bg-slate-100"
          >
            Nouvelle paie
          </button>
        </div>

        {formOpen ? (
          <form onSubmit={onCreateRun} className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl bg-white/10 p-4">
            <label className="space-y-0.5 text-xs">
              <span className="text-slate-200">Debut de periode</span>
              <input
                type="date"
                required
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="block w-40 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white focus:outline-none"
              />
            </label>
            <label className="space-y-0.5 text-xs">
              <span className="text-slate-200">Fin de periode</span>
              <input
                type="date"
                required
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="block w-40 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#0b4f88] hover:bg-slate-100 disabled:opacity-60"
            >
              {saving ? "Generation..." : "Generer les bulletins"}
            </button>
          </form>
        ) : null}
      </section>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {info ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{info}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-1">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Historique</h2>
          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500">Chargement...</div>
          ) : runs.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">Aucune paie generee.</div>
          ) : (
            <ul className="space-y-2">
              {runs.map((run) => (
                <li key={run.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(run.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                      selectedId === run.id
                        ? "border-[#0b4f88] bg-[#0b4f88]/5"
                        : "border-slate-200 hover:border-[#0b4f88]/40 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{run.number}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          run.status === "finalized"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {run.status === "finalized" ? "Finalisee" : "Brouillon"}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatDate(run.periodStart)} - {formatDate(run.periodEnd)} - {run.payslipsCount} bulletin(s)
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
          {!selectedId ? (
            <div className="py-16 text-center text-sm text-slate-500">
              Selectionnez une paie dans l historique ou creez en une nouvelle.
            </div>
          ) : detailLoading || !detail ? (
            <div className="py-16 text-center text-sm text-slate-500">Chargement...</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{detail.number}</h2>
                  <p className="text-xs text-slate-500">
                    {formatDate(detail.periodStart)} - {formatDate(detail.periodEnd)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {detail.status === "draft" ? (
                    <>
                      <button
                        type="button"
                        onClick={onDelete}
                        disabled={busy}
                        className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                      >
                        Supprimer
                      </button>
                      <button
                        type="button"
                        onClick={onFinalize}
                        disabled={busy}
                        className="rounded-xl bg-[#0b4f88] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#0d63b8] disabled:opacity-60"
                      >
                        {busy ? "Finalisation..." : "Finaliser"}
                      </button>
                    </>
                  ) : (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Finalisee le {detail.finalizedAt ? formatDate(detail.finalizedAt) : "-"}
                    </span>
                  )}
                </div>
              </div>

              {detail.totals.hasMixedCurrencies ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Certains employes sont payes dans une devise differente de {detail.currency}. Les totaux ci-dessous
                  n excluent que les montants en {detail.currency} pour rester exacts ; consultez le detail par
                  bulletin ci-dessous pour les autres devises.
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-xs uppercase text-slate-500">Brut total ({detail.currency})</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{formatMoney(detail.totals.gross, detail.currency)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-xs uppercase text-slate-500">Deductions ({detail.currency})</p>
                  <p className="mt-1 text-lg font-bold text-rose-700">{formatMoney(detail.totals.deductions, detail.currency)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-xs uppercase text-slate-500">Net total ({detail.currency})</p>
                  <p className="mt-1 text-lg font-bold text-emerald-700">{formatMoney(detail.totals.net, detail.currency)}</p>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-slate-500">
                      <th className="pb-2 font-semibold">Employe</th>
                      <th className="pb-2 text-right font-semibold">Brut</th>
                      <th className="pb-2 text-right font-semibold">Deductions</th>
                      <th className="pb-2 text-right font-semibold">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.payslips.map((p) => (
                      <tr key={p.id} className="border-b last:border-0 align-top">
                        <td className="py-2">
                          <div className="font-medium text-slate-800">{p.employeeName}</div>
                          <div className="text-xs text-slate-500">{p.jobTitle}</div>
                          {p.breakdown.length > 0 ? (
                            <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                              {p.breakdown.map((b, i) => (
                                <li key={i}>
                                  {b.label} ({b.type === "percent" ? `${b.rate}%` : formatMoney(b.rate, p.currency)}) : -
                                  {formatMoney(b.amount, p.currency)}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </td>
                        <td className="py-2 text-right text-slate-700">{formatMoney(p.grossAmount, p.currency)}</td>
                        <td className="py-2 text-right text-rose-700">{formatMoney(p.totalDeductions, p.currency)}</td>
                        <td className="py-2 text-right font-semibold text-emerald-700">{formatMoney(p.netAmount, p.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {detail.payslips.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-500">
                    Aucun employe actif avec un salaire configure pour cette periode.
                  </div>
                ) : null}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
