"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, Eye, Plus, RefreshCcw, Search, Trash2, X } from "lucide-react";
import { ApiError } from "@/lib/api";
import { getProducts, type CatalogProduct } from "@/lib/catalogApi";
import {
  cancelPurchaseOrder,
  createPurchaseOrder,
  listPurchaseOrders,
  receivePurchaseOrder,
  type PurchaseOrder,
  type PurchaseOrderStatus,
} from "@/lib/purchasesApi";
import { listSuppliers, type SupplierItem } from "@/lib/suppliersApi";
import { SUPPORTED_CURRENCIES } from "@/lib/businessApi";

type FormLine = {
  productId: string;
  quantity: string;
  unitCost: string;
  taxRate: string;
  notes: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

function formatMoney(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyLine(): FormLine {
  return {
    productId: "",
    quantity: "1",
    unitCost: "0",
    taxRate: "0",
    notes: "",
  };
}

function statusLabel(status: PurchaseOrderStatus): string {
  if (status === "ordered") return "Commandee";
  if (status === "received") return "Recue";
  if (status === "cancelled") return "Annulee";
  return "Brouillon";
}

function statusClassName(status: PurchaseOrderStatus): string {
  if (status === "received") return "bg-emerald-100 text-emerald-700";
  if (status === "ordered") return "bg-blue-100 text-blue-700";
  if (status === "cancelled") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

export default function PurchaseOrdersPage() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [reloadSeq, setReloadSeq] = useState(0);
  const [supplierId, setSupplierId] = useState("");
  const [orderDate, setOrderDate] = useState(today());
  const [expectedAt, setExpectedAt] = useState("");
  const [currency, setCurrency] = useState("HTG");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<FormLine[]>([emptyLine()]);

  const productById = useMemo(() => {
    const map = new Map<string, CatalogProduct>();
    for (const product of products) {
      map.set(String(product.id), product);
    }
    return map;
  }, [products]);

  const formTotals = useMemo(() => {
    return lines.reduce(
      (acc, line) => {
        const quantity = Number(line.quantity);
        const unitCost = Number(line.unitCost);
        const taxRate = Number(line.taxRate);
        if (!Number.isFinite(quantity) || !Number.isFinite(unitCost)) return acc;
        const lineTotal = quantity * unitCost;
        const taxAmount = Number.isFinite(taxRate) ? (lineTotal * taxRate) / 100 : 0;
        return {
          subtotal: acc.subtotal + lineTotal,
          taxTotal: acc.taxTotal + taxAmount,
          total: acc.total + lineTotal + taxAmount,
        };
      },
      { subtotal: 0, taxTotal: 0, total: 0 },
    );
  }, [lines]);

  const load = useCallback(async () => {
    if (!businessSlug) return;
    setLoading(true);
    setError("");
    try {
      const [orderRes, supplierRes, productRes] = await Promise.all([
        listPurchaseOrders(businessSlug, {
          page,
          perPage: 20,
          q: query || undefined,
          status: statusFilter || undefined,
        }),
        listSuppliers(businessSlug, { perPage: 100 }),
        getProducts(businessSlug, { all: true, perPage: 100 }),
      ]);
      setOrders(orderRes.items);
      setLastPage(orderRes.lastPage);
      setTotal(orderRes.total);
      setSuppliers(supplierRes.items);
      setProducts(productRes.filter((product) => product.type === "product"));
      if (orderRes.lastPage > 0 && page > orderRes.lastPage) {
        setPage(orderRes.lastPage);
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [businessSlug, page, query, reloadSeq, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setSupplierId("");
    setOrderDate(today());
    setExpectedAt("");
    setCurrency("HTG");
    setNotes("");
    setLines([emptyLine()]);
  }

  function updateLine(index: number, patch: Partial<FormLine>) {
    setLines((prev) =>
      prev.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        const next = { ...line, ...patch };
        if (patch.productId) {
          const product = productById.get(patch.productId);
          if (product) {
            next.unitCost = String(product.cost || 0);
          }
        }
        return next;
      }),
    );
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, lineIndex) => lineIndex !== index)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessSlug) return;

    const payloadLines = lines.map((line) => ({
      productId: line.productId,
      quantity: Number(line.quantity),
      unitCost: Number(line.unitCost),
      taxRate: Number(line.taxRate) || 0,
      notes: line.notes.trim() || undefined,
    }));

    if (payloadLines.some((line) => !line.productId)) {
      setError("Chaque ligne doit avoir un produit.");
      return;
    }
    if (payloadLines.some((line) => !Number.isFinite(line.quantity) || line.quantity <= 0)) {
      setError("Chaque quantite doit etre superieure a zero.");
      return;
    }
    if (payloadLines.some((line) => !Number.isFinite(line.unitCost) || line.unitCost < 0)) {
      setError("Chaque cout unitaire doit etre valide.");
      return;
    }

    setSaving(true);
    setError("");
    setInfo("");
    try {
      await createPurchaseOrder(businessSlug, {
        supplierId: supplierId || null,
        status: "ordered",
        orderDate: orderDate || undefined,
        expectedAt: expectedAt || undefined,
        currency: currency.trim() || "HTG",
        notes: notes.trim() || undefined,
        items: payloadLines,
      });
      setInfo("Bon d achat cree.");
      resetForm();
      setPage(1);
      setReloadSeq((prev) => prev + 1);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleReceive(order: PurchaseOrder) {
    if (!businessSlug) return;
    if (!window.confirm(`Marquer ${order.number} comme recu et augmenter le stock ?`)) return;
    setActionLoadingId(order.id);
    setError("");
    setInfo("");
    try {
      await receivePurchaseOrder(businessSlug, order.id);
      setInfo(`${order.number} recu. Stock mis a jour.`);
      setReloadSeq((prev) => prev + 1);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleCancel(order: PurchaseOrder) {
    if (!businessSlug) return;
    if (!window.confirm(`Annuler ${order.number} ?`)) return;
    setActionLoadingId(order.id);
    setError("");
    setInfo("");
    try {
      await cancelPurchaseOrder(businessSlug, order.id);
      setInfo(`${order.number} annule.`);
      setReloadSeq((prev) => prev + 1);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Bons d achat</h1>
            <p className="mt-1 text-sm text-slate-500">Creation des achats fournisseurs et reception stock.</p>
          </div>
          <div className="text-sm text-slate-600">
            {total} bon(s) | Page {page}/{Math.max(1, lastPage)}
          </div>
        </div>
      </section>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</section>
      ) : null}
      {info ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{info}</section>
      ) : null}

      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <label className="space-y-1.5 text-sm font-medium text-slate-700">
            Fournisseur
            <select
              value={supplierId}
              onChange={(event) => {
                const nextSupplierId = event.target.value;
                setSupplierId(nextSupplierId);
                const supplier = suppliers.find((item) => item.id === nextSupplierId);
                if (supplier) setCurrency(supplier.currency);
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Sans fournisseur</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-sm font-medium text-slate-700">
            Date commande
            <input type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
          </label>
          <label className="space-y-1.5 text-sm font-medium text-slate-700">
            Date prevue
            <input type="date" value={expectedAt} onChange={(event) => setExpectedAt(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
          </label>
          <label className="space-y-1.5 text-sm font-medium text-slate-700">
            Devise
            <select value={currency} onChange={(event) => setCurrency(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100">
              {SUPPORTED_CURRENCIES.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.code} - {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-3">Produit</th>
                <th className="py-2 pr-3">Quantite</th>
                <th className="py-2 pr-3">Cout</th>
                <th className="py-2 pr-3">Taxe %</th>
                <th className="py-2 pr-3">Note</th>
                <th className="py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index} className="border-b border-slate-100">
                  <td className="py-2 pr-3">
                    <select value={line.productId} onChange={(event) => updateLine(index, { productId: event.target.value })} className="w-56 rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100">
                      <option value="">Produit</option>
                      {products.map((product) => (
                        <option key={String(product.id)} value={String(product.id)}>{product.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3">
                    <input type="number" min="0.001" step="0.001" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} className="w-28 rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                  </td>
                  <td className="py-2 pr-3">
                    <input type="number" min="0" step="0.01" value={line.unitCost} onChange={(event) => updateLine(index, { unitCost: event.target.value })} className="w-28 rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                  </td>
                  <td className="py-2 pr-3">
                    <input type="number" min="0" max="100" step="0.01" value={line.taxRate} onChange={(event) => updateLine(index, { taxRate: event.target.value })} className="w-20 rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                  </td>
                  <td className="py-2 pr-3">
                    <input value={line.notes} onChange={(event) => updateLine(index, { notes: event.target.value })} className="w-48 rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                  </td>
                  <td className="py-2 text-right">
                    <button type="button" onClick={() => removeLine(index)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Retirer la ligne">
                      <X className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <button type="button" onClick={() => setLines((prev) => [...prev, emptyLine()])} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Plus className="h-4 w-4" />
            Ajouter ligne
          </button>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes" rows={2} className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 md:w-80" />
            <div className="text-right text-sm text-slate-600">
              <div>Sous-total: {formatMoney(formTotals.subtotal, currency || "HTG")}</div>
              <div>Taxe: {formatMoney(formTotals.taxTotal, currency || "HTG")}</div>
              <div>Total: <span className="font-bold text-slate-900">{formatMoney(formTotals.total, currency || "HTG")}</span></div>
            </div>
            <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              <CheckCircle2 className="h-4 w-4" />
              {saving ? "Enregistrement..." : "Creer bon"}
            </button>
          </div>
        </div>
      </form>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <form onSubmit={(event) => { event.preventDefault(); setPage(1); setQuery(queryInput.trim()); }} className="flex flex-1 gap-2">
            <div className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Recherche numero, fournisseur, note" className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
            </div>
            <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Rechercher</button>
          </form>
          <div className="flex gap-2">
            <select value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value); }} className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100">
              <option value="">Tous statuts</option>
              <option value="draft">Brouillon</option>
              <option value="ordered">Commandee</option>
              <option value="received">Recue</option>
              <option value="cancelled">Annulee</option>
            </select>
            <button type="button" onClick={() => setReloadSeq((prev) => prev + 1)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Rafraichir">
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-4">Numero</th>
                <th className="py-2 pr-4">Fournisseur</th>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Statut</th>
                <th className="py-2 pr-4 text-right">Total</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-8 text-center text-slate-500">Chargement...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-slate-500">Aucun bon d achat.</td></tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-semibold text-slate-900">
                      <Link href={`/${businessSlug}/purchase-orders/${order.id}`} className="hover:underline">
                        {order.number}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-slate-700">{order.supplierName || "-"}</td>
                    <td className="py-3 pr-4 text-slate-600">{order.orderDate || "-"}</td>
                    <td className="py-3 pr-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClassName(order.status)}`}>{statusLabel(order.status)}</span></td>
                    <td className="py-3 pr-4 text-right font-semibold text-slate-900">{formatMoney(order.total, order.currency)}</td>
                    <td className="py-3 text-right">
                      <div className="inline-flex gap-2">
                        <Link href={`/${businessSlug}/purchase-orders/${order.id}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                          <Eye className="h-4 w-4" />
                          Voir
                        </Link>
                        {order.status !== "received" && order.status !== "cancelled" ? (
                          <button type="button" onClick={() => void handleReceive(order)} disabled={actionLoadingId === order.id} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                            <CheckCircle2 className="h-4 w-4" />
                            Recevoir
                          </button>
                        ) : null}
                        {order.status !== "received" && order.status !== "cancelled" ? (
                          <button type="button" onClick={() => void handleCancel(order)} disabled={actionLoadingId === order.id} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60">
                            <Trash2 className="h-4 w-4" />
                            Annuler
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1} className="rounded-xl border border-slate-200 px-3 py-2 font-semibold disabled:opacity-50">Precedent</button>
          <span>Page {page}/{Math.max(1, lastPage)}</span>
          <button type="button" onClick={() => setPage((prev) => Math.min(lastPage, prev + 1))} disabled={page >= lastPage} className="rounded-xl border border-slate-200 px-3 py-2 font-semibold disabled:opacity-50">Suivant</button>
        </div>
      </section>
    </div>
  );
}
