"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Download, Package } from "lucide-react";
import { usePermissionGuard } from "@/lib/usePermissionGuard";
import { formatMoney } from "@/lib/currency";
import { downloadStockReport, getStockReport, type StockReport } from "@/lib/operationalReportsApi";

const localDate = () => new Date().toLocaleDateString("en-CA");
const qty = (value: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(value);
const errorMessage = (e: unknown) => e instanceof Error ? e.message : "Impossible de charger le rapport.";
const columns = ["opening", "supplied", "available", "sold", "unit_price", "sold_value", "remaining", "remaining_value", "defects", "adjustments"] as const;

export default function InventoryReportsPage() {
  const { business } = useParams<{ business: string }>();
  const { allowed, loading: permissionLoading } = usePermissionGuard("reports.read");
  const [from, setFrom] = useState(() => `${localDate().slice(0, 7)}-01`);
  const [to, setTo] = useState(localDate);
  const [period, setPeriod] = useState(() => ({ from, to }));
  const [report, setReport] = useState<StockReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!business || !allowed) return;
    let active = true;
    setLoading(true); setError("");
    getStockReport(business, period.from, period.to).then(data => { if (active) setReport(data); })
      .catch(e => { if (active) { setError(errorMessage(e)); setReport(null); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [business, allowed, period]);

  async function exportPdf() {
    if (!report) return;
    setExporting(true); setError("");
    try { await downloadStockReport(business, report.from, report.to); }
    catch (e) { setError(errorMessage(e)); }
    finally { setExporting(false); }
  }
  if (permissionLoading) return <p className="p-6 text-slate-500">Chargement…</p>;
  if (!allowed) return null;
  return <div className="space-y-5 p-4 md:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><Package className="h-6 w-6" /> Rapport de stock</h1>
        <p className="mt-1 text-sm text-slate-500">Approvisionnements, ventes, stock restant et valorisation par produit.</p></div>
      <button onClick={() => void exportPdf()} disabled={!report || loading || exporting}
        className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        <Download className="h-4 w-4" />{exporting ? "Préparation…" : "PDF à imprimer"}</button>
    </div>
    <form className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4" onSubmit={e => {
      e.preventDefault(); if (!from || !to || from > to) { setError("Choisis une période valide."); return; }
      setPeriod({ from, to });
    }}>
      <label className="text-sm font-semibold text-slate-600">Du<input aria-label="Début de période" type="date" required value={from} onChange={e => setFrom(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 p-2" /></label>
      <label className="text-sm font-semibold text-slate-600">Au<input aria-label="Fin de période" type="date" required min={from} value={to} onChange={e => setTo(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 p-2" /></label>
      <button disabled={loading} className="rounded-lg bg-slate-800 px-4 py-2 text-white disabled:opacity-50">Afficher le rapport</button>
      <span className="text-xs text-slate-500">Impression A4 paysage</span>
    </form>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {loading ? <p className="text-slate-500">Chargement du rapport…</p> : report && <>
      <div><h2 className="font-bold text-slate-800">{report.business_name} · {report.branch_name}</h2><p className="text-xs text-slate-500">Du {report.from} au {report.to} · {report.currency} · Édité le {report.generated_at}</p></div>
      {!!report.unassigned_movements_count && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">À rapprocher : {report.unassigned_movements_count} mouvement(s) de cette période ne sont rattachés à aucune succursale et ne sont pas inclus dans ce rapport par succursale.</p>}
      <div className="grid gap-3 sm:grid-cols-3">{[
        ["Stock restant", qty(report.totals.remaining)],
        ["Valeur au coût d’achat", formatMoney(report.totals.cost_value, report.currency)],
        ["Valeur au prix de vente", formatMoney(report.totals.remaining_value, report.currency)],
      ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-xl font-bold text-slate-900">{value}</div></div>)}</div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1300px] text-right text-xs"><thead className="bg-slate-800 text-white"><tr>{["Code-barres", "Catégorie", "Produit", "Stock 1 · début", "Stock 2 · appro.", "Qté totale", "Qté vendue", "Prix unitaire", "Valeur vendue*", "Qté restante", "Valeur restante", "Défectueux", "Autres +/−"].map(label => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead>
          <tbody>{report.rows.map(row => <tr key={row.product_id} className="border-t border-slate-100">
            <td className="px-3 py-3 font-mono">{row.barcode}</td><td className="px-3 py-3 text-left">{row.category}</td><td className="px-3 py-3 text-left font-semibold">{row.name}</td>
            {columns.map(key => <td key={key} className={`px-3 py-3 tabular-nums ${key === "opening" ? "bg-amber-50" : key.startsWith("remaining") ? "bg-emerald-50" : ""}`}>{key.includes("value") || key === "unit_price" ? row[key].toFixed(2) : qty(row[key])}</td>)}
          </tr>)}{!report.rows.length && <tr><td colSpan={13} className="p-6 text-center text-slate-500">Aucun produit suivi dans cette succursale.</td></tr>}</tbody>
          <tfoot className="bg-slate-100 font-bold"><tr><td colSpan={3} className="p-3 text-left">TOTAL</td>{columns.map(key => <td key={key} className="px-3 py-3">{key === "unit_price" ? "—" : key.includes("value") ? report.totals[key].toFixed(2) : qty(report.totals[key])}</td>)}</tr></tfoot>
        </table>
      </div>
      <div className="space-y-1 text-xs text-slate-500"><p>Qté totale = stock de début + approvisionnements. Stock restant = total − ventes − défectueux + autres mouvements nets.</p><p>Autres : retours, transferts, corrections et initialisations. * Valeurs aux prix et taux actuels, avant remises ; la valeur vendue est indicative et ne représente pas les encaissements.</p></div>
    </>}
  </div>;
}
