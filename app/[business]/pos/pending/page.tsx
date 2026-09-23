"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { listPendingSales, enqueuePendingSale, type PendingSale } from "@/lib/offlineDb";
import { syncPendingSales } from "@/lib/offlineSync";
import { listBusinessApprovers, type BusinessApproverItem } from "@/lib/businessUsersApi";
import { getErrorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/currency";
import { useOnlineStatus } from "@/lib/useOnlineStatus";
import SensitiveActionApprovalModal, { type SensitiveActionApproval } from "@/components/SensitiveActionApprovalModal";

export default function PendingSalesPage() {
  const { business } = useParams<{ business: string }>();
  const { user } = useAuth();
  const { branches } = useBranch();
  const online = useOnlineStatus();
  const [sales, setSales] = useState<PendingSale[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [approving, setApproving] = useState<PendingSale | null>(null);
  const [approvers, setApprovers] = useState<BusinessApproverItem[]>([]);
  const [legacyBranches, setLegacyBranches] = useState<Record<string, string>>({});
  const refresh = useCallback(async () => {
    try {
      const rows = await listPendingSales(business);
      setSales(rows.filter((row) => String(row.payload.cashierId ?? "") === String(user?.id ?? "")));
    } catch (error) { setError(getErrorMessage(error, "Une erreur est survenue.")); }
  }, [business, user?.id]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function retry(sale?: PendingSale, approval?: SensitiveActionApproval) {
    if (!user || busy) return;
    setBusy(true); setError("");
    try {
      await syncPendingSales(business, { userId: String(user.id), saleId: sale?.id, approval });
      setApproving(null);
    } catch (error) { setError(getErrorMessage(error, "Une erreur est survenue.")); }
    finally { setBusy(false); await refresh(); }
  }
  async function authorize(sale: PendingSale) {
    setBusy(true); setError("");
    try { setApprovers(await listBusinessApprovers(business, "discount_billing")); setApproving(sale); }
    catch (error) { setError(getErrorMessage(error, "Une erreur est survenue.")); }
    finally { setBusy(false); }
  }
  async function assignBranch(sale: PendingSale) {
    const branchId = legacyBranches[sale.id];
    if (!branchId) return;
    setBusy(true); setError("");
    try {
      await enqueuePendingSale({ ...sale, payload: { ...sale.payload, branchId } });
      await refresh();
    } catch (error) { setError(getErrorMessage(error, "Une erreur est survenue.")); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5 p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><Link href={`/${business}/pos`} className="text-sm text-indigo-700">Retour à la caisse</Link>
        <h1 className="text-2xl font-bold text-slate-900">Mes ventes en attente</h1>
        <p className="text-sm text-slate-600">Les reprises utilisent la référence et la succursale d’origine.</p></div>
      <button onClick={() => void retry()} disabled={busy || !online || sales.length === 0} className="rounded-xl bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">{busy ? "Synchronisation…" : "Réessayer toutes les ventes"}</button>
    </div>
    {!online && <p className="rounded-xl bg-amber-50 p-3 text-amber-900">Connexion indisponible. Les ventes restent sur ce poste.</p>}
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-800">{error}</p>}
    {!sales.length && <p className="rounded-2xl border bg-white p-6 text-slate-600">Aucune vente en attente pour votre compte sur ce poste.</p>}
    {sales.map((sale) => <article key={sale.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap justify-between gap-2"><strong>OFFLINE-{sale.id.slice(0, 8)}</strong><strong>{formatMoney(sale.totalDisplay, sale.currencyDisplay)}</strong></div>
      <p className="text-sm text-slate-600">{new Date(sale.createdAt).toLocaleString()} · {branches.find((branch) => branch.id === sale.payload.branchId)?.name ?? (sale.payload.branchId ? `Succursale ${sale.payload.branchId}` : "Succursale à confirmer")} · {sale.status === "syncing" ? "Envoi interrompu ou en cours" : sale.status === "failed" ? "À reprendre" : "En attente"}</p>
      <p className="text-sm">{sale.payload.items.map((item) => `${item.qty} × ${item.name ?? item.sku ?? item.productId}`).join(" · ")}</p>
      {sale.error && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{sale.error}</p>}
      {!sale.payload.branchId ? <div className="flex flex-wrap gap-2">
        <select aria-label="Succursale d’origine" value={legacyBranches[sale.id] ?? ""} onChange={(event) => setLegacyBranches({ ...legacyBranches, [sale.id]: event.target.value })} className="rounded-xl border p-2">
          <option value="">Choisir la succursale d’origine</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </select>
        <button disabled={busy || !legacyBranches[sale.id]} onClick={() => void assignBranch(sale)} className="rounded-xl border px-4 py-2 disabled:opacity-50">Confirmer la succursale</button>
      </div> : <button disabled={busy || !online} onClick={() => void (sale.requiresApproval ? authorize(sale) : retry(sale))} className="rounded-xl border border-indigo-200 px-4 py-2 text-indigo-700 disabled:opacity-50">{sale.requiresApproval ? "Autoriser et reprendre" : "Réessayer cette vente"}</button>}
    </article>)}
    <SensitiveActionApprovalModal open={Boolean(approving)} title="Autoriser la vente en attente" description="Le mot de passe est utilisé uniquement pour cet envoi. Il ne sera pas conservé sur ce poste." approvers={approvers} loading={busy} onClose={() => setApproving(null)} onConfirm={(approval) => retry(approving ?? undefined, approval)} />
  </div>;
}
