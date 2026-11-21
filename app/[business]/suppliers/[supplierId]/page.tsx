"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CreditCard, Eye, Package, RefreshCw, Truck } from "lucide-react";
import { getSupplier, type SupplierItem } from "@/lib/suppliersApi";
import { listPurchaseOrders, type PurchaseOrderListResult, type PurchaseOrderStatus } from "@/lib/purchasesApi";
import { formatPhoneDisplay } from "@/lib/phone";

const statuses: Record<PurchaseOrderStatus, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "bg-slate-100 text-slate-600" },
  ordered: { label: "Commandée", color: "bg-blue-50 text-blue-700" },
  partially_received: { label: "Partiellement reçue", color: "bg-amber-50 text-amber-800" },
  received: { label: "Reçue", color: "bg-emerald-50 text-emerald-700" },
  cancelled: { label: "Annulée", color: "bg-rose-50 text-rose-700" },
};

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
}

function date(value: string | null) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "—";
}

export default function SupplierDetailsPage() {
  const params = useParams<{ business: string; supplierId: string }>();
  return <SupplierDetails key={`${params.business}:${params.supplierId}`} business={params.business} supplierId={params.supplierId} />;
}

function SupplierDetails({ business, supplierId }: { business: string; supplierId: string }) {
  const [supplier, setSupplier] = useState<SupplierItem | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<"orders" | "payments">("orders");
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<PurchaseOrderListResult | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const result = await getSupplier(business, supplierId);
        if (active) setSupplier(result);
      } catch (error) {
        if (active) setError(error instanceof Error ? error.message : "Impossible de charger le fournisseur.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [business, supplierId, reload]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!supplier) return;
      setOrdersLoading(true);
      setOrdersError("");
      try {
        const result = await listPurchaseOrders(business, { supplierId, page, perPage: 10 });
        if (active) {
          setOrders(result);
          if (page > result.lastPage) setPage(result.lastPage);
        }
      } catch (error) {
        if (active) setOrdersError(error instanceof Error ? error.message : "Impossible de charger les commandes.");
      } finally {
        if (active) setOrdersLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [business, supplierId, supplier, page, reload]);

  const buttonClass = "inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/${business}/suppliers`} className={buttonClass}><ArrowLeft aria-hidden="true" className="h-4 w-4" /> Fournisseurs</Link>
        <button type="button" onClick={() => setReload((value) => value + 1)} disabled={loading || (Boolean(supplier) && ordersLoading)} className={buttonClass}><RefreshCw aria-hidden="true" className="h-4 w-4" /> Actualiser</button>
      </div>
      {loading ? <p role="status" className="rounded-2xl bg-white p-8 text-center text-slate-500">Chargement du fournisseur…</p> : error ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</p>
      ) : supplier ? (
        <>
          <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Truck aria-hidden="true" className="h-6 w-6" /></span>
                <div className="min-w-0"><p className="text-sm text-slate-500">Fiche fournisseur</p><h1 className="break-words text-2xl font-bold text-slate-900">{supplier.name}</h1></div>
              </div>
              <Link href={`/${business}/purchase-orders?supplier=${encodeURIComponent(supplier.id)}#new-purchase-order`} className="inline-flex items-center gap-2 rounded-xl brand-primary-btn px-4 py-2.5 text-sm font-semibold text-white"><Package aria-hidden="true" className="h-4 w-4" /> Commander</Link>
            </div>
            <dl className="mt-6 grid gap-x-6 gap-y-5 border-t border-slate-100 pt-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Représentant", supplier.contactPerson],
                ["Téléphone", formatPhoneDisplay(supplier.phone)],
                ["E-mail", supplier.email],
                ["Adresse", supplier.address],
                ["Département", supplier.department],
                ["Entreprise", supplier.businessName || supplier.businessSlug],
                ["Devise", supplier.currency],
                ["Ajouté le", date(supplier.createdAt)],
                ["Produits commandés · succursale active", supplier.orderedProductsCount == null ? "—" : String(supplier.orderedProductsCount)],
              ].map(([label, value]) => (
                <div key={label}><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-800">{value || "Non renseigné"}</dd></div>
              ))}
            </dl>
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Solde enregistré</p>
              <p className={`mt-1 text-xl font-bold ${supplier.balance > 0 ? "text-rose-700" : "text-slate-800"}`}>{money(supplier.balance, supplier.currency)}</p>
              <p className="mt-1 text-xs text-slate-500">Montant saisi dans la fiche fournisseur, sans recalcul automatique à partir des commandes ou des paiements.</p>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4" aria-label="Historiques du fournisseur">
              <button type="button" aria-pressed={tab === "orders"} onClick={() => setTab("orders")} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${tab === "orders" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}><Package aria-hidden="true" className="h-4 w-4" /> Commandes</button>
              <button type="button" aria-pressed={tab === "payments"} onClick={() => setTab("payments")} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${tab === "payments" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}><CreditCard aria-hidden="true" className="h-4 w-4" /> Paiements</button>
            </div>
            {tab === "orders" ? (
              <div className="space-y-4 p-5">
                <div><h2 className="text-lg font-bold text-slate-900">Historique des commandes</h2><p className="mt-1 text-sm text-slate-500">Commandes liées à ce fournisseur dans la succursale active.</p></div>
                {ordersLoading ? <p role="status" className="py-8 text-center text-slate-500">Chargement des commandes…</p> : ordersError ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{ordersError}</p> : !orders?.items.length ? <p className="py-8 text-center text-slate-500">Aucune commande pour ce fournisseur dans cette succursale.</p> : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[700px] whitespace-nowrap text-left text-sm">
                        <thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500">{["Commande", "Date", "Livraison prévue", "Montant", "Statut", "Action"].map((label) => <th key={label} className="px-3 py-3 font-semibold">{label}</th>)}</tr></thead>
                        <tbody>{orders.items.map((order) => (
                          <tr key={order.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                            <td className="px-3 py-3 font-semibold text-slate-800">{order.number}</td>
                            <td className="px-3 py-3 text-slate-600">{date(order.orderDate)}</td>
                            <td className="px-3 py-3 text-slate-600">{date(order.expectedAt)}</td>
                            <td className="px-3 py-3 font-semibold text-slate-800">{money(order.total, order.currency)}</td>
                            <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statuses[order.status].color}`}>{statuses[order.status].label}</span></td>
                            <td className="px-3 py-3"><Link href={`/${business}/purchase-orders/${order.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"><Eye aria-hidden="true" className="h-3.5 w-3.5" /> Détail</Link></td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
                      <button type="button" onClick={() => setPage((value) => value - 1)} disabled={page <= 1} className={buttonClass}>Précédent</button>
                      <span>{orders.total} commande(s) · Page {page} / {orders.lastPage}</span>
                      <button type="button" onClick={() => setPage((value) => value + 1)} disabled={page >= orders.lastPage} className={buttonClass}>Suivant</button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3 p-5">
                <h2 className="text-lg font-bold text-slate-900">Historique des paiements</h2>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Le suivi des paiements fournisseurs n’est pas encore disponible dans l’application. Le solde enregistré et les commandes ne permettent pas de reconstituer les règlements effectués.
                </div>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
