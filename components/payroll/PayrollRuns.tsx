"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import PayslipDetails from "@/components/payroll/PayslipDetails";
import {
  createPayrollRun,
  deletePayrollRun,
  finalizePayrollRun,
  getPayrollRun,
  listPayrollRuns,
  type PayrollRunDetail,
  type PayrollRunSummary,
  type PayslipItem,
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
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (parts) return `${parts[3]}/${parts[2]}/${parts[1]}`;
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

export default function PayrollRuns() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";

  const [runs, setRuns] = useState<PayrollRunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<PayrollRunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipItem | null>(null);
  const detailRequest = useRef(0);

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
      const request = ++detailRequest.current;
      setDetailLoading(true);
      setDetail(null);
      setError("");
      try {
        const result = await getPayrollRun(businessSlug, runId);
        if (request === detailRequest.current) setDetail(result);
      } catch (e) {
        if (request === detailRequest.current) setError(getErrorMessage(e));
      } finally {
        if (request === detailRequest.current) setDetailLoading(false);
      }
    },
    [businessSlug]
  );

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
    return () => { detailRequest.current += 1; };
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
    if (!businessSlug || !selectedId || busy || detail?.id !== selectedId || detail.status !== "draft") return;
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
            <h2 className="text-2xl font-semibold">Bulletins de paie</h2>
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

      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[240px] space-y-1 text-sm font-medium text-slate-700">
          <span>Période de paie</span>
          <select
            value={selectedId}
            disabled={loading || busy}
            onChange={(event) => { setSelectedPayslip(null); setSelectedId(event.target.value); }}
            className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
          >
            <option value="">Choisir une période</option>
            {runs.map((run) => <option key={run.id} value={run.id}>{formatDate(run.periodStart)} – {formatDate(run.periodEnd)} · {run.number}</option>)}
          </select>
        </label>
        <p className="pb-2 text-xs text-slate-500">Les présences ne sont pas encore renseignées dans l’application.</p>
      </div>

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
                    onClick={() => { setSelectedPayslip(null); setSelectedId(run.id); }}
                    disabled={busy}
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
          ) : detailLoading ? (
            <div className="py-16 text-center text-sm text-slate-500">Chargement...</div>
          ) : !detail || detail.id !== selectedId ? (
            <div className="py-16 text-center text-sm text-slate-500">Le détail de cette paie n’est pas disponible. Sélectionnez à nouveau la période pour réessayer.</div>
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
                        {busy ? "Validation…" : "Valider la paie de cette période"}
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
                  incluent uniquement les montants en {detail.currency} pour rester exacts ; consultez le detail par
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
                <table className="w-full min-w-[1060px] whitespace-nowrap text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-3 pr-4 font-semibold">Employé</th>
                      <th className="py-3 pr-4 font-semibold">Poste</th>
                      <th className="py-3 pr-4 font-semibold">Présences</th>
                      <th className="py-3 pr-4 text-right font-semibold">Salaire brut</th>
                      <th className="py-3 pr-4 text-right font-semibold">Déductions</th>
                      <th className="py-3 pr-4 text-right font-semibold">Net à payer</th>
                      <th className="py-3 pr-4 font-semibold">Statut de paie</th>
                      <th className="py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.payslips.map((p) => (
                      <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                        <td className="py-3 pr-4 font-semibold text-slate-800">{p.employeeName}</td>
                        <td className="py-3 pr-4 text-slate-600">{p.jobTitle || "—"}</td>
                        <td className="py-3 pr-4 text-xs text-slate-400">Non renseigné</td>
                        <td className="py-3 pr-4 text-right text-slate-700">{formatMoney(p.grossAmount, p.currency)}</td>
                        <td className="py-3 pr-4 text-right text-rose-700">{formatMoney(p.totalDeductions, p.currency)}</td>
                        <td className="py-3 pr-4 text-right font-semibold text-emerald-700">{formatMoney(p.netAmount, p.currency)}</td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${detail.status === "finalized" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                            {detail.status === "finalized" ? "Validé" : "Calculé · brouillon"}
                          </span>
                        </td>
                        <td className="py-3">
                          <button type="button" onClick={() => setSelectedPayslip(p)} aria-label={`Détail du bulletin de ${p.employeeName}`} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                            Détail
                          </button>
                        </td>
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
      {selectedPayslip && detail ? (
        <PayslipDetails payslip={selectedPayslip} run={detail} onClose={() => setSelectedPayslip(null)} />
      ) : null}
    </div>
  );
}
