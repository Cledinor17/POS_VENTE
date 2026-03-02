"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Boxes,
  RefreshCcw,
  SlidersHorizontal,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import { getProducts, type CatalogProduct } from "@/lib/catalogApi";
import {
  adjustInventoryStock,
  exportInventoryMovementsCsv,
  getInventorySummary,
  listInventoryMovements,
  type InventoryMovement,
  type InventorySummaryResult,
} from "@/lib/inventoryApi";
import { toastError, toastSuccess } from "@/lib/toast";
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
function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}
function stockTone(product: CatalogProduct): string {
  if (product.type === "service" || !product.active) return "text-slate-500";
  if (product.stock <= 0.000001) return "text-rose-600 font-semibold";
  if (product.reorderLevel > 0 && product.stock <= product.reorderLevel)
    return "text-amber-700 font-semibold";
  return "text-slate-800";
}
function movementBadge(direction: "in" | "out"): string {
  return direction === "in"
    ? "bg-emerald-100 text-emerald-700"
    : "bg-rose-100 text-rose-700";
}
function movementActorLabel(movement: InventoryMovement): string {
  if (movement.createdByName && movement.createdByName.trim().length > 0)
    return movement.createdByName;
  if (movement.createdBy && movement.createdBy.trim().length > 0)
    return `#${movement.createdBy}`;
  return "N/A";
}
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
export default function InventoryPage() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [summary, setSummary] = useState<InventorySummaryResult>(EMPTY_SUMMARY);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingMovements, setLoadingMovements] = useState(true);
  const [submittingAdjustment, setSubmittingAdjustment] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [query, setQuery] = useState("");
  const [movementQuery, setMovementQuery] = useState("");
  const [movementDirection, setMovementDirection] = useState<"" | "in" | "out">(
    "",
  );
  const [movementPage, setMovementPage] = useState(1);
  const [movementLastPage, setMovementLastPage] = useState(1);
  const [movementTotal, setMovementTotal] = useState(0);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [operation, setOperation] = useState<"increase" | "decrease" | "set">(
    "increase",
  );
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("manual_adjustment");
  const [notes, setNotes] = useState("");
  const [unitCost, setUnitCost] = useState("");
  useEffect(() => {
    let mounted = true;
    async function loadBase() {
      if (!businessSlug) return;
      setLoadingBase(true);
      setError("");
      try {
        const [productRes, summaryRes] = await Promise.all([
          getProducts(businessSlug, { all: true }),
          getInventorySummary(businessSlug),
        ]);
        if (!mounted) return;
        setProducts(productRes);
        setSummary(summaryRes);
      } catch (e) {
        if (mounted) {
          const message = getErrorMessage(e);
          setError(message);
          toastError(message);
        }
      } finally {
        if (mounted) setLoadingBase(false);
      }
    }
    void loadBase();
    return () => {
      mounted = false;
    };
  }, [businessSlug]);
  useEffect(() => {
    let mounted = true;
    async function loadMovements() {
      if (!businessSlug) return;
      setLoadingMovements(true);
      setError("");
      try {
        const res = await listInventoryMovements(businessSlug, {
          page: movementPage,
          perPage: 20,
          q: movementQuery || undefined,
          direction: movementDirection || undefined,
        });
        if (!mounted) return;
        setMovements(res.items);
        setMovementLastPage(res.lastPage);
        setMovementTotal(res.total);
      } catch (e) {
        if (mounted) {
          const message = getErrorMessage(e);
          setError(message);
          toastError(message);
        }
      } finally {
        if (mounted) setLoadingMovements(false);
      }
    }
    void loadMovements();
    return () => {
      mounted = false;
    };
  }, [businessSlug, movementPage, movementQuery, movementDirection]);
  const selectedProduct = useMemo(
    () =>
      products.find((item) => String(item.id) === selectedProductId) ?? null,
    [products, selectedProductId],
  );
  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return products;
    return products.filter((item) => {
      return (
        item.name.toLowerCase().includes(normalized) ||
        item.sku.toLowerCase().includes(normalized) ||
        item.category.toLowerCase().includes(normalized)
      );
    });
  }, [products, query]);
  function resetAdjustmentForm() {
    setSelectedProductId("");
    setOperation("increase");
    setQuantity("");
    setReason("manual_adjustment");
    setNotes("");
    setUnitCost("");
  }
  async function refreshAll() {
    if (!businessSlug) return;
    setLoadingBase(true);
    setLoadingMovements(true);
    setError("");
    try {
      const [productRes, summaryRes, movementRes] = await Promise.all([
        getProducts(businessSlug, { all: true }),
        getInventorySummary(businessSlug),
        listInventoryMovements(businessSlug, {
          page: movementPage,
          perPage: 20,
          q: movementQuery || undefined,
          direction: movementDirection || undefined,
        }),
      ]);
      setProducts(productRes);
      setSummary(summaryRes);
      setMovements(movementRes.items);
      setMovementLastPage(movementRes.lastPage);
      setMovementTotal(movementRes.total);
    } catch (e) {
      const message = getErrorMessage(e);
      setError(message);
      toastError(message);
    } finally {
      setLoadingBase(false);
      setLoadingMovements(false);
    }
  }
  async function submitAdjustment() {
    if (!selectedProduct) {
      const message = "Selectionne un produit a ajuster.";
      setError(message);
      toastError(message);
      return;
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty < 0 || (operation !== "set" && qty <= 0)) {
      const message = "Quantite invalide pour cet ajustement.";
      setError(message);
      toastError(message);
      return;
    }
    const parsedUnitCost = unitCost.trim().length > 0 ? Number(unitCost) : null;
    if (
      parsedUnitCost !== null &&
      (!Number.isFinite(parsedUnitCost) || parsedUnitCost < 0)
    ) {
      const message = "Cout unitaire invalide.";
      setError(message);
      toastError(message);
      return;
    }
    setSubmittingAdjustment(true);
    setError("");
    setInfo("");
    try {
      const res = await adjustInventoryStock(businessSlug, {
        productId: selectedProduct.id,
        operation,
        quantity: qty,
        reason: reason.trim() || "manual_adjustment",
        notes: notes.trim() || undefined,
        unitCost: parsedUnitCost ?? undefined,
      });
      setInfo(
        `Ajustement applique sur ${res.product.name}: ${formatQty(res.product.oldStock)} -> ${formatQty(res.product.newStock)}`,
      );
      toastSuccess(
        `Stock ajuste sur ${res.product.name}: ${formatQty(res.product.oldStock)} -> ${formatQty(res.product.newStock)}.`,
      );
      resetAdjustmentForm();
      setMovementPage(1);
      await refreshAll();
    } catch (e) {
      const message = getErrorMessage(e);
      setError(message);
      toastError(message);
    } finally {
      setSubmittingAdjustment(false);
    }
  }
  function downloadCsv(content: string, filename: string) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
  async function exportMovementsCsv() {
    if (!businessSlug) return;
    setExportingCsv(true);
    setError("");
    try {
      const csv = await exportInventoryMovementsCsv(businessSlug, {
        q: movementQuery || undefined,
        direction: movementDirection || undefined,
      });
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      downloadCsv(csv, `inventory-movements-${stamp}.csv`);
      setInfo("Export CSV genere avec succes.");
      toastSuccess("Export CSV genere avec succes.");
    } catch (e) {
      const message = getErrorMessage(e);
      setError(message);
      toastError(message);
    } finally {
      setExportingCsv(false);
    }
  }
  return (
    <div className="space-y-6">
      <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Stock et inventaire
            </h1>
            <p className="text-slate-500 mt-1">
              Suivi du stock, ajustements manuels et mouvements.
            </p>
          </div>
          <button
            onClick={() => {
              void refreshAll();
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCcw className="h-4 w-4" /> Actualiser
          </button>
        </div>
      </section>
      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </section>
      ) : null}
      {info ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {info}
        </section>
      ) : null}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Produits"
          value={String(summary.summary.totalProducts)}
          tone="text-indigo-700"
        />
        <StatCard
          label="Stock bas"
          value={String(summary.summary.lowStockCount)}
          tone="text-amber-700"
        />
        <StatCard
          label="Ruptures"
          value={String(summary.summary.outOfStockCount)}
          tone="text-rose-700"
        />
        <StatCard
          label="Valeur stock"
          value={formatMoney(summary.summary.stockValue)}
          tone="text-sky-700"
        />
      </section>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Produits en stock
            </h2>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher produit, SKU, categorie..."
              className="w-full md:w-80 rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          {loadingBase ? (
            <div className="py-8 text-center text-slate-500">
              Chargement de l'inventaire...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-3 pr-3 font-semibold">Produit</th>
                    <th className="py-3 pr-3 font-semibold">SKU</th>
                    <th className="py-3 pr-3 font-semibold">Type</th>
                    <th className="py-3 pr-3 font-semibold">Stock</th>
                    <th className="py-3 pr-3 font-semibold">Alerte</th>
                    <th className="py-3 pr-3 font-semibold">Valeur</th>
                    <th className="py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr
                      key={String(product.id)}
                      className="border-b last:border-0"
                    >
                      <td className="py-3 pr-3">
                        <div className="font-semibold text-slate-800">
                          {product.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {product.category}
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-slate-600">
                        {product.sku || "-"}
                      </td>
                      <td className="py-3 pr-3 text-slate-600">
                        {product.type}
                      </td>
                      <td className={`py-3 pr-3 ${stockTone(product)}`}>
                        {formatQty(product.stock)}
                      </td>
                      <td className="py-3 pr-3 text-slate-600">
                        {formatQty(product.reorderLevel)}
                      </td>
                      <td className="py-3 pr-3 text-slate-700">
                        {formatMoney(product.stock * product.cost)}
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => {
                            setSelectedProductId(String(product.id));
                            setOperation("increase");
                            setQuantity("");
                            setReason("manual_adjustment");
                            setNotes("");
                            setUnitCost(
                              product.cost > 0 ? String(product.cost) : "",
                            );
                          }}
                          disabled={product.type !== "product"}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5" />
                          Ajuster
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-8 text-center text-slate-500"
                      >
                        Aucun produit trouve.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <aside className="space-y-4">
          <section className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-900">Ajustement manuel</h3>
            <select
              value={selectedProductId}
              onChange={(event) => setSelectedProductId(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Selectionner un produit</option>
              {products
                .filter((item) => item.type === "product")
                .map((item) => (
                  <option key={String(item.id)} value={String(item.id)}>
                    {item.name} ({item.sku || "N/A"})
                  </option>
                ))}
            </select>
            {selectedProduct ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                Stock actuel:
                <span className="font-semibold text-slate-800">
                  {formatQty(selectedProduct.stock)}
                </span>
              </div>
            ) : null}
            <select
              value={operation}
              onChange={(event) =>
                setOperation(
                  event.target.value as "increase" | "decrease" | "set",
                )
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="increase">Ajouter au stock</option>
              <option value="decrease">Retirer du stock</option>
              <option value="set">Definir le stock exact</option>
            </select>
            <input
              type="number"
              min="0"
              step="0.001"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="Quantite"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Raison (ex: correction, casse)"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={unitCost}
              onChange={(event) => setUnitCost(event.target.value)}
              placeholder="Cout unitaire (optionnel)"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Note interne"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              rows={3}
            />
            <button
              onClick={() => {
                void submitAdjustment();
              }}
              disabled={submittingAdjustment}
              className="w-full rounded-xl brand-primary-btn text-white py-2.5 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submittingAdjustment ? "Traitement..." : "Appliquer ajustement"}
            </button>
          </section>
          <section className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-2">
              Produits en alerte
            </h3>
            {summary.lowStockProducts.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune alerte de stock.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {summary.lowStockProducts.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-amber-200 bg-amber-50 p-2.5"
                  >
                    <div className="text-sm font-semibold text-amber-800">
                      {item.name}
                    </div>
                    <div className="text-xs text-amber-700">
                      {item.sku || "N/A"} - stock {formatQty(item.stock)} /
                      alerte {formatQty(item.alertQuantity)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
      <section className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-base font-bold text-slate-900">
            Mouvements de stock ({movementTotal})
          </h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={movementQuery}
              onChange={(event) => {
                setMovementQuery(event.target.value);
                setMovementPage(1);
              }}
              placeholder="Filtrer (produit, raison, note)"
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <select
              value={movementDirection}
              onChange={(event) => {
                setMovementDirection(event.target.value as "" | "in" | "out");
                setMovementPage(1);
              }}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Tous</option> <option value="in">Entree</option>
              <option value="out">Sortie</option>
            </select>
            <button
              onClick={() => {
                void exportMovementsCsv();
              }}
              disabled={exportingCsv}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {exportingCsv ? "Export..." : "Exporter CSV"}
            </button>
          </div>
        </div>
        {loadingMovements ? (
          <div className="py-8 text-center text-slate-500">
            Chargement des mouvements...
          </div>
        ) : movements.length === 0 ? (
          <div className="py-8 text-center text-slate-500">
            Aucun mouvement trouve.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-3 pr-3 font-semibold">Date</th>
                  <th className="py-3 pr-3 font-semibold">Produit</th>
                  <th className="py-3 pr-3 font-semibold">Direction</th>
                  <th className="py-3 pr-3 font-semibold">Quantite</th>
                  <th className="py-3 pr-3 font-semibold">Cout unit.</th>
                  <th className="py-3 pr-3 font-semibold">Raison</th>
                  <th className="py-3 pr-3 font-semibold">Utilisateur</th>
                  <th className="py-3 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id} className="border-b last:border-0">
                    <td className="py-3 pr-3 text-slate-600">
                      {movement.createdAt
                        ? new Date(movement.createdAt).toLocaleString("fr-FR")
                        : "-"}
                    </td>
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-slate-800">
                        {movement.productName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {movement.productSku || "N/A"}
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${movementBadge(movement.direction)}`}
                      >
                        {movement.direction === "in" ? (
                          <>
                            <ArrowDown className="h-3.5 w-3.5" /> Entree
                          </>
                        ) : (
                          <>
                            <ArrowUp className="h-3.5 w-3.5" /> Sortie
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3 pr-3 font-semibold text-slate-800">
                      {formatQty(movement.quantity)}
                    </td>
                    <td className="py-3 pr-3 text-slate-700">
                      {formatMoney(movement.unitCost)}
                    </td>
                    <td className="py-3 pr-3 text-slate-600">
                      {movement.reason}
                    </td>
                    <td className="py-3 pr-3 text-slate-600">
                      {movementActorLabel(movement)}
                    </td>
                    <td className="py-3 text-slate-600">
                      {movement.notes || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Page {movementPage}/{Math.max(1, movementLastPage)}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMovementPage((prev) => Math.max(1, prev - 1))}
              disabled={movementPage <= 1 || loadingMovements}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Precedent
            </button>
            <button
              onClick={() =>
                setMovementPage((prev) => Math.min(movementLastPage, prev + 1))
              }
              disabled={movementPage >= movementLastPage || loadingMovements}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Suivant
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-slate-500">{label}</p>
        <Boxes className="h-4 w-4 text-slate-300" />
      </div>
      <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}
