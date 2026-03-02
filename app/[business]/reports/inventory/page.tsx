"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  getInventorySummary,
  listInventoryMovements,
  type InventoryMovement,
  type InventorySummaryResult,
} from "@/lib/inventoryApi";

const EMPTY_SUMMARY: InventorySummaryResult = {
  summary: {
    totalProducts: 0,
    trackedProducts: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    stockUnits: 0,
    stockValue: 0,
    potentialRevenue: 0,
  },
  lowStockProducts: [],
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

function formatQty(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(value);
}

export default function InventoryReportsPage() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";

  const [summary, setSummary] = useState<InventorySummaryResult>(EMPTY_SUMMARY);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!businessSlug) return;
      setLoading(true);
      setError("");
      try {
        const [summaryRes, movementRes] = await Promise.all([
          getInventorySummary(businessSlug),
          listInventoryMovements(businessSlug, { page: 1, perPage: 10 }),
        ]);

        if (!mounted) return;
        setSummary(summaryRes);
        setMovements(movementRes.items);
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
  }, [businessSlug]);

  return (
    <div className="space-y-5">
      <section className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Rapports stock</h1>
        <p className="text-sm text-slate-500 mt-1">Synthese inventaire et derniers mouvements backend.</p>
      </section>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </section>
      ) : null}

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Produits suivis" value={String(summary.summary.trackedProducts)} tone="text-indigo-700" />
        <StatCard label="Stock total" value={formatQty(summary.summary.stockUnits)} tone="text-slate-800" />
        <StatCard label="Valeur stock" value={formatMoney(summary.summary.stockValue)} tone="text-sky-700" />
        <StatCard label="Ruptures" value={String(summary.summary.outOfStockCount)} tone="text-rose-700" />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b text-sm font-semibold text-slate-700">Derniers mouvements</div>
          {loading ? (
            <div className="py-8 text-center text-slate-500">Chargement...</div>
          ) : movements.length === 0 ? (
            <div className="py-8 text-center text-slate-500">Aucun mouvement trouve.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-3 pr-3 px-4 font-semibold">Date</th>
                    <th className="py-3 pr-3 font-semibold">Produit</th>
                    <th className="py-3 pr-3 font-semibold">Direction</th>
                    <th className="py-3 pr-3 font-semibold">Quantite</th>
                    <th className="py-3 px-4 font-semibold">Utilisateur</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-3 pr-3 px-4 text-slate-600">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString("fr-FR") : "-"}
                      </td>
                      <td className="py-3 pr-3 text-slate-700">{item.productName}</td>
                      <td className="py-3 pr-3 text-slate-700">{item.direction}</td>
                      <td className="py-3 pr-3 text-slate-800 font-semibold">{formatQty(item.quantity)}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {item.createdByName || (item.createdBy ? `#${item.createdBy}` : "-")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <h2 className="font-bold text-slate-900 mb-2">Alertes stock</h2>
          {loading ? (
            <p className="text-sm text-slate-500">Chargement...</p>
          ) : summary.lowStockProducts.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune alerte.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {summary.lowStockProducts.map((item) => (
                <div key={item.id} className="rounded-xl border border-amber-200 bg-amber-50 p-2.5">
                  <div className="text-sm font-semibold text-amber-800">{item.name}</div>
                  <div className="text-xs text-amber-700">
                    {item.sku || "N/A"} | stock {formatQty(item.stock)} / alerte{" "}
                    {formatQty(item.alertQuantity)}
                  </div>
                </div>
              ))}
            </div>
          )}
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
