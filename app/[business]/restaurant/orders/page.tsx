"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { getProducts, type CatalogProduct } from "@/lib/catalogApi";
import { formatMoney } from "@/lib/currency";
import {
  createRestaurantOrder,
  getRestaurantTables,
  listRestaurantOrders,
  updateRestaurantOrderStatus,
  type RestaurantOrder,
  type RestaurantOrderStatus,
  type RestaurantTable,
} from "@/lib/restaurantApi";
import { ChefHat, Minus, Plus, X } from "lucide-react";
import { useBusinessDefaults } from "@/lib/useBusinessDefaults";

const STATUS_LABELS: Record<RestaurantOrderStatus, string> = {
  pending: "En attente",
  on_hold: "En pause",
  completed: "Confirmee",
  cancelled: "Annulee",
};

const STATUS_COLORS: Record<RestaurantOrderStatus, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  on_hold: "bg-sky-50 text-sky-700 border-sky-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",
};

const PAYMENT_METHODS = [
  { id: "cash", label: "Especes" },
  { id: "card", label: "Carte" },
  { id: "mobile_money", label: "Mobile money" },
  { id: "bank_transfer", label: "Virement" },
];

function err(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Une erreur est survenue.";
}

function formatDt(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("fr-FR");
}

type CartItem = { product: CatalogProduct; qty: number };

export default function RestaurantOrdersPage() {
  const params = useParams<{ business: string }>();
  const business = params?.business ?? "";

  const { currency: defaultCurrency } = useBusinessDefaults(business);

  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filters
  const [statusFilter, setStatusFilter] = useState<RestaurantOrderStatus | "">("");
  const [tableFilter, setTableFilter] = useState<number | "">("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  // New order modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Confirm/cancel modal
  const [actionOrder, setActionOrder] = useState<RestaurantOrder | null>(null);
  const [actionType, setActionType] = useState<"completed" | "cancelled" | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [actioning, setActioning] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!business) return;
    setLoading(true);
    setError("");
    try {
      const result = await listRestaurantOrders(business, {
        page,
        perPage: 20,
        status: statusFilter,
        tableId: tableFilter || undefined,
      });
      setOrders(result.items);
      setLastPage(result.lastPage);
      setTotal(result.total);
    } catch (e) {
      setError(err(e));
    } finally {
      setLoading(false);
    }
  }, [business, page, statusFilter, tableFilter]);

  useEffect(() => {
    void (async () => {
      if (!business) return;
      try {
        const [t, p] = await Promise.all([
          getRestaurantTables(business),
          getProducts(business, { perPage: 200 }),
        ]);
        setTables(t.filter((tbl) => tbl.isActive));
        setProducts(p);
      } catch {}
    })();
  }, [business]);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  const filteredProducts = useMemo(() =>
    products.filter((p) =>
      !productSearch.trim() ||
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku?.toLowerCase().includes(productSearch.toLowerCase())
    ),
    [products, productSearch]
  );

  function addToCart(product: CatalogProduct) {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) return prev.map((item) => item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { product, qty: 1 }];
    });
  }

  function updateQty(productId: number, delta: number) {
    setCart((prev) =>
      prev
        .map((item) => item.product.id === productId ? { ...item, qty: item.qty + delta } : item)
        .filter((item) => item.qty > 0)
    );
  }

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + (Number(item.product.sellingPrice ?? item.product.price ?? 0) * item.qty), 0),
    [cart]
  );

  async function handleCreateOrder(e: FormEvent) {
    e.preventDefault();
    if (!selectedTable) { setError("Selectionnez une table."); return; }
    if (cart.length === 0) { setError("Ajoutez au moins un article."); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      await createRestaurantOrder(business, {
        tableId: Number(selectedTable),
        note: note.trim() || undefined,
        currency: defaultCurrency,
        items: cart.map((item) => ({
          productId: Number(item.product.id),
          quantity: item.qty,
          unitPrice: Number(item.product.sellingPrice ?? item.product.price ?? 0),
        })),
      });
      setIsModalOpen(false);
      setCart([]); setSelectedTable(""); setNote("");
      setSuccess("Commande envoyee.");
      await loadOrders();
    } catch (e) { setError(err(e)); } finally { setSaving(false); }
  }

  async function handleAction() {
    if (!actionOrder || !actionType) return;
    setActioning(true); setError(""); setSuccess("");
    try {
      await updateRestaurantOrderStatus(business, actionOrder.id, {
        status: actionType,
        paymentMethod: actionType === "completed" ? paymentMethod : undefined,
      });
      setActionOrder(null); setActionType(null);
      setSuccess(actionType === "completed" ? "Commande confirmee." : "Commande annulee.");
      await loadOrders();
    } catch (e) { setError(err(e)); } finally { setActioning(false); }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ChefHat className="h-6 w-6 text-[#0d63b8]" />
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">Restaurant — Commandes</h1>
              <p className="text-sm text-slate-600">{total} commande(s) au total</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setCart([]); setSelectedTable(""); setNote(""); setIsModalOpen(true); }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0d63b8] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0a4d8f]"
            >
              <Plus className="h-4 w-4" /> Nouvelle commande
            </button>
            <Link href={`/${business}/restaurant/tables`}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Tables
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap gap-3">
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as RestaurantOrderStatus | ""); setPage(1); }}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
            <option value="">Tous les statuts</option>
            {(["pending", "on_hold", "completed", "cancelled"] as RestaurantOrderStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <select value={tableFilter} onChange={(e) => { setTableFilter(e.target.value ? Number(e.target.value) : ""); setPage(1); }}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
            <option value="">Toutes les tables</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>{t.name} #{t.number}</option>
            ))}
          </select>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

      {/* Orders list */}
      <div className="rounded-2xl border border-slate-200 bg-white">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Chargement...</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Aucune commande.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Commande</th>
                  <th className="px-4 py-3">Table</th>
                  <th className="px-4 py-3">Articles</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Montant</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold text-slate-800">{order.invoiceNumber}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {order.table ? (
                        <div>
                          <div className="font-medium">{order.table.name}</div>
                          <div className="text-xs text-slate-500">{order.table.section ?? "—"}</div>
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {order.items.slice(0, 2).map((i) => i.product?.name ?? "Article").join(", ")}
                      {order.itemsCount > 2 ? ` +${order.itemsCount - 2}` : ""}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDt(order.createdAt)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatMoney(order.totalAmount, order.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[order.status]}`}>
                        {STATUS_LABELS[order.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {order.canConfirm && (
                          <button type="button"
                            onClick={() => { setActionOrder(order); setActionType("completed"); setPaymentMethod("cash"); }}
                            className="rounded-lg border border-emerald-200 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50">
                            Confirmer
                          </button>
                        )}
                        {order.canCancel && (
                          <button type="button"
                            onClick={() => { setActionOrder(order); setActionType("cancelled"); }}
                            className="rounded-lg border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50">
                            Annuler
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {lastPage > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40">
              Precedent
            </button>
            <span className="text-xs text-slate-500">Page {page} / {lastPage}</span>
            <button type="button" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40">
              Suivant
            </button>
          </div>
        )}
      </div>

      {/* Modal: new order */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/70 p-4">
          <div className="my-8 w-full max-w-4xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div className="inline-flex items-center gap-2">
                <ChefHat className="h-5 w-5 text-[#0d63b8]" />
                <h2 className="text-lg font-bold text-slate-900">Nouvelle commande restaurant</h2>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="p-5">
              <div className="grid gap-5 lg:grid-cols-2">
                {/* Left: product selection */}
                <div className="space-y-3">
                  <label className="space-y-1 text-sm">
                    <span className="font-semibold text-slate-700">Table</span>
                    <select value={selectedTable} onChange={(e) => setSelectedTable(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                      <option value="">-- Selectionnez une table --</option>
                      {tables.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} #{t.number}{t.section ? ` (${t.section})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="space-y-1 text-sm">
                    <span className="font-semibold text-slate-700">Produits</span>
                    <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Rechercher un produit..."
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                    <div className="mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200">
                      {filteredProducts.slice(0, 50).map((p) => (
                        <button key={p.id} type="button" onClick={() => addToCart(p)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0">
                          <div>
                            <div className="font-medium text-slate-800">{p.name}</div>
                            <div className="text-xs text-slate-500">{p.sku}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-slate-900">
                              {formatMoney(Number(p.sellingPrice ?? p.price ?? 0), p.sellingCurrency ?? "HTG")}
                            </div>
                            <Plus className="ml-auto h-3 w-3 text-[#0d63b8]" />
                          </div>
                        </button>
                      ))}
                      {filteredProducts.length === 0 && (
                        <div className="px-3 py-4 text-center text-xs text-slate-500">Aucun produit.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: cart */}
                <div className="space-y-3">
                  <div className="font-semibold text-sm text-slate-700">Panier ({cart.length} article(s))</div>
                  <div className="min-h-[180px] rounded-xl border border-slate-200 p-3 space-y-2">
                    {cart.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-sm text-slate-500">
                        Aucun article ajouté.
                      </div>
                    ) : (
                      cart.map((item) => (
                        <div key={item.product.id} className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-slate-800">{item.product.name}</div>
                            <div className="text-xs text-slate-500">
                              {formatMoney(Number(item.product.sellingPrice ?? item.product.price ?? 0), item.product.sellingCurrency ?? "HTG")} / u
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => updateQty(Number(item.product.id), -1)}
                              className="rounded-lg border border-slate-300 p-0.5 text-slate-700 hover:bg-slate-50">
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-6 text-center text-sm font-semibold">{item.qty}</span>
                            <button type="button" onClick={() => updateQty(Number(item.product.id), 1)}
                              className="rounded-lg border border-slate-300 p-0.5 text-slate-700 hover:bg-slate-50">
                              <Plus className="h-3 w-3" />
                            </button>
                            <span className="w-20 text-right text-sm font-semibold text-slate-900">
                              {formatMoney(Number(item.product.sellingPrice ?? item.product.price ?? 0) * item.qty, item.product.sellingCurrency ?? "HTG")}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {cart.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="flex items-center justify-between text-sm font-bold text-slate-900">
                        <span>Total</span>
                        <span>{formatMoney(cartTotal, cart[0]?.product.sellingCurrency ?? "HTG")}</span>
                      </div>
                    </div>
                  )}

                  <label className="space-y-1 text-sm block">
                    <span className="font-semibold text-slate-700">Note (optionnel)</span>
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                </div>
              </div>

              {error ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

              <div className="mt-4 flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Annuler
                </button>
                <button type="submit" disabled={saving || cart.length === 0}
                  className="rounded-xl bg-[#0d63b8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a4d8f] disabled:opacity-60">
                  {saving ? "Envoi..." : "Envoyer la commande"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: confirm/cancel action */}
      {actionOrder && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              {actionType === "completed" ? "Confirmer la commande" : "Annuler la commande"}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Commande <strong>{actionOrder.invoiceNumber}</strong>
              {actionOrder.table ? ` — ${actionOrder.table.name}` : ""}
              {" "}({formatMoney(actionOrder.totalAmount, actionOrder.currency)})
            </p>

            {actionType === "completed" && (
              <label className="mt-4 block space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Mode de paiement <span className="text-red-500">*</span>
                </span>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                >
                  <option value="" disabled>-- Choisir --</option>
                  {PAYMENT_METHODS.map((pm) => (
                    <option key={pm.id} value={pm.id}>{pm.label}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">Obligatoire pour l&apos;ecriture comptable.</p>
              </label>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => { setActionOrder(null); setActionType(null); }}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Retour
              </button>
              <button type="button" onClick={handleAction} disabled={actioning}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${actionType === "completed" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}>
                {actioning ? "..." : actionType === "completed" ? "Confirmer" : "Annuler la commande"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
