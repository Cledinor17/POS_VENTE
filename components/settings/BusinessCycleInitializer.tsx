"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, Archive, RotateCcw } from "lucide-react";
import {
  previewBusinessCycle, startBusinessCycle, type BusinessCyclePreview,
} from "@/lib/businessCycleApi";

const LABELS: Record<string, string> = {
  invoices: "Ventes et factures",
  invoice_payments: "Paiements de factures",
  expenses: "Dépenses",
  stock_movements: "Mouvements de stock",
  cash_sessions: "Sessions de caisse",
  cash_movements: "Mouvements de caisse",
  orders: "Commandes",
  hotel_reservations: "Réservations d'hôtel",
  hotel_reservation_charges: "Frais d'hôtel",
  hotel_reservation_payments: "Paiements hôteliers",
  journal_entries: "Écritures comptables",
  stock_transfers: "Transferts de stock",
  purchase_orders: "Achats fournisseurs",
  pos_parked_carts: "Fiches en attente",
  pos_tab_deposit_events: "Dépôts et remboursements",
  pool_tickets: "Tickets piscine",
  service_bookings: "Réservations de services",
};

export default function BusinessCycleInitializer({
  business,
  platformBusinessId,
}: {
  business: string;
  platformBusinessId?: number;
}) {
  const [preview, setPreview] = useState<BusinessCyclePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const refresh = useCallback(async () => {
    if (!business) return;
    setLoading(true);
    try {
      const next = await previewBusinessCycle(business, platformBusinessId);
      setPreview(next);
      setConfirmation("");
      setPassword("");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de préparer l'initialisation.");
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [business, platformBusinessId]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview || !preview.can_start || confirmation !== preview.business.slug || !password) return;
    if (!window.confirm(
      `Initialiser une nouvelle période d'activité pour ${preview.business.name} ?\n\n` +
      "L'opération conservera l'historique en archive, le catalogue, les tarifs et le stock courant. " +
      "Une sauvegarde sera produite avant la bascule.",
    )) return;
    setWorking(true);
    setError("");
    setInfo("");
    try {
      const result = await startBusinessCycle(business, {
        previewToken: preview.preview_token, confirmation, password,
      }, platformBusinessId);
      setInfo(`Nouveau cycle #${result.cycle.id} ouvert. Sauvegarde : ${result.cycle.recovery_id}.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Initialisation refusée.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-amber-300 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <Archive className="h-6 w-6 shrink-0 text-amber-700" aria-hidden />
        <div>
          <h2 className="text-lg font-bold text-slate-900">Initialiser le business</h2>
          <p className="mt-1 text-sm text-slate-600">
            Démarrer une période opérationnelle à zéro sans supprimer les produits, catégories,
            services, tarifs, clients ni quantités de stock existantes.
            Les anciennes factures et écritures restent archivées et récupérables.
          </p>
        </div>
      </div>

      {error ? <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {info ? <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{info}</p> : null}

      <button
        type="button"
        disabled={loading || working}
        onClick={() => void refresh()}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"
      >
        <RotateCcw className="h-4 w-4" aria-hidden />
        {loading ? "Vérification..." : "Actualiser l’aperçu"}
      </button>

      {preview ? (
        <>
          {preview.latest_cycle ? (
            <p className="text-xs text-slate-600">
              Dernier cycle : #{preview.latest_cycle.id}, commencé le {preview.latest_cycle.started_at}.
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(preview.counts).map(([table, count]) => (
              <div key={table} className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs text-slate-600">{LABELS[table] || table}</div>
                <div className="mt-1 text-xl font-bold tabular-nums text-slate-900">{count}</div>
              </div>
            ))}
          </div>
          {preview.blockers.length > 0 ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                Initialisation bloquée : opérations non terminées
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
                {preview.blockers.map(item => (
                  <li key={item.code}>{item.message} ({item.count})</li>
                ))}
              </ul>
            </div>
          ) : null}
          <form onSubmit={start} className="space-y-3 border-t border-slate-200 pt-4">
            <p className="text-sm text-slate-600">
              Pour confirmer, saisissez <strong>{preview.business.slug}</strong> puis
              votre mot de passe. Une sauvegarde sera créée automatiquement.
            </p>
            <label className="block text-sm font-medium text-slate-800">
              Confirmation exacte du business
              <input value={confirmation} onChange={e => setConfirmation(e.target.value)}
                autoComplete="off"
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
            </label>
            <label className="block text-sm font-medium text-slate-800">
              Mot de passe de votre compte
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
            </label>
            <button
              type="submit"
              disabled={!preview.can_start || working || confirmation !== preview.business.slug || !password}
              className="rounded-xl border border-amber-500 bg-amber-100 px-4 py-2.5 text-sm font-bold text-amber-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {working ? "Initialisation..." : "Initialiser une nouvelle période"}
            </button>
          </form>
        </>
      ) : null}
    </section>
  );
}
