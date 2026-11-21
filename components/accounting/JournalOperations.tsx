"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { hasPermission } from "@/lib/businessAccess";
import { getErrorMessage } from "@/lib/errors";
import { listJournalOperations, type JournalOperationsResult, type JournalOperationType } from "@/lib/journalOperationsApi";
import { useBusinessPermissions } from "@/lib/useBusinessPermissions";

const TYPE_LABELS: Record<JournalOperationType, string> = {
  income: "Revenu",
  expense: "Dépense",
  receipt: "Encaissement",
  refund: "Remboursement",
  reversal: "Annulation",
  transfer: "Transfert",
  other: "Autre écriture",
};

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function formatDate(date: string): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return parts ? `${parts[3]}/${parts[2]}/${parts[1]}` : date;
}

export default function JournalOperations({ business, active = true }: { business: string; active?: boolean }) {
  const { loading: permissionsLoading, permissions } = useBusinessPermissions(business);
  const allowed = hasPermission(permissions, ["accounting.read", "accounting.manage"]);
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<JournalOperationsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!active) return;
    let mounted = true;
    async function load() {
      if (!business || permissionsLoading || !allowed) return;
      setLoading(true);
      setError("");
      try {
        const response = await listJournalOperations(business, page);
        if (mounted) setResult(response);
      } catch (reason) {
        if (mounted) {
          setResult(null);
          setError(getErrorMessage(reason, "Le journal des opérations est indisponible pour le moment."));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, [allowed, business, page, permissionsLoading, reload, active]);

  return (
    <section aria-labelledby="journal-operations-title" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="journal-operations-title" className="text-lg font-bold text-slate-900">Journal des opérations</h2>
          <p className="mt-1 text-sm text-slate-500">Écritures comptabilisées, affichées dans leur devise d’enregistrement.</p>
        </div>
        {allowed ? (
          <button type="button" onClick={() => setReload((value) => value + 1)} disabled={loading || permissionsLoading} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </button>
        ) : null}
      </div>
      {permissionsLoading ? (
        <p role="status" className="py-8 text-center text-sm text-slate-500">Chargement du journal…</p>
      ) : !allowed ? (
        <p className="py-8 text-center text-sm text-slate-500">Vous n’avez pas accès au journal comptable.</p>
      ) : error ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : loading ? (
        <p role="status" className="py-8 text-center text-sm text-slate-500">Chargement du journal…</p>
      ) : !result?.data.length ? (
        <p className="py-8 text-center text-sm text-slate-500">Aucune opération comptabilisée pour le moment.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] whitespace-nowrap text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="py-3 pr-4 font-semibold">Date</th>
                  <th scope="col" className="py-3 pr-4 font-semibold">Opération</th>
                  <th scope="col" className="py-3 pr-4 font-semibold">Type</th>
                  <th scope="col" className="py-3 text-right font-semibold">Montant</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((row) => {
                  const tone = row.direction > 0 ? "text-emerald-700" : row.direction < 0 ? "text-rose-700" : "text-slate-700";
                  const badge = row.type === "income" ? "bg-emerald-50 text-emerald-700" : row.type === "expense" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600";
                  return (
                    <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                      <td className="py-3 pr-4 text-slate-500"><time dateTime={row.date}>{formatDate(row.date)}</time></td>
                      <td className="py-3 pr-4 font-medium text-slate-800">{row.operation}</td>
                      <td className="py-3 pr-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badge}`}>{TYPE_LABELS[row.type] ?? TYPE_LABELS.other}</span></td>
                      <td className={`py-3 text-right font-semibold tabular-nums ${tone}`}>{row.direction > 0 ? "+ " : row.direction < 0 ? "− " : ""}{formatAmount(row.amount, row.currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500">{result.meta.total} opération(s) · Page {result.meta.current_page}/{result.meta.last_page}</p>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Précédent</button>
              <button type="button" disabled={page >= result.meta.last_page} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Suivant</button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
