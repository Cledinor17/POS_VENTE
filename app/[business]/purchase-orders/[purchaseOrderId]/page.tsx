"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Plus, Save, Trash2, X } from "lucide-react";
import { ApiError } from "@/lib/api";
import { getProducts, type CatalogProduct } from "@/lib/catalogApi";
import {
  cancelPurchaseOrder,
  getPurchaseOrder,
  receivePurchaseOrder,
  updatePurchaseOrder,
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

function emptyLine(): FormLine {
  return { productId: "", quantity: "1", unitCost: "0", taxRate: "0", notes: "" };
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

function toFormLines(order: PurchaseOrder): FormLine[] {
  if (order.items.length === 0) return [emptyLine()];
  return order.items.map((item) => ({
    productId: item.productId,
    quantity: String(item.quantity),
    unitCost: String(item.unitCost),
    taxRate: String(item.taxRate),
    notes: item.notes ?? "",
  }));
}

export default function PurchaseOrderDetailPage() {
  const params = useParams<{ business: string; purchaseOrderId: string }>();
  const router = useRouter();
  const businessSlug = params?.business ?? "";
  const purchaseOrderId = params?.purchaseOrderId ?? "";

  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [supplierId, setSupplierId] = useState("");
  const [orderDate, setOrderDate] = useState("");
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

  const isEditable = order ? order.status !== "received" && order.status !== "cancelled" : false;

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
    if (!businessSlug || !purchaseOrderId) return;
    setLoading(true);
    setError("");
    try {
      const [orderRes, supplierRes, productRes] = await Promise.all([
        getPurchaseOrder(businessSlug, purchaseOrderId),
        listSuppliers(businessSlug, { perPage: 100 }),
        getProducts(businessSlug, { all: true, perPage: 100 }),
      ]);
      setOrder(orderRes);
      setSuppliers(supplierRes.items);
      setProducts(productRes.filter((product) => product.type === "product"));
      setSupplierId(orderRes.supplierId ?? "");
      setOrderDate(orderRes.orderDate ?? "");
      setExpectedAt(orderRes.expectedAt ?? "");
      setCurrency(orderRes.currency ?? "HTG");
      setNotes(orderRes.notes ?? "");
      setLines(toFormLines(orderRes));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [businessSlug, purchaseOrderId]);

  useEffect(() => {
    void load();
  }, [load]);

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
    if (!businessSlug || !purchaseOrderId) return;

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
      const updated = await updatePurchaseOrder(businessSlug, purchaseOrderId, {
        supplierId: supplierId || null,
        orderDate: orderDate || undefined,
        expectedAt: expectedAt || undefined,
        currency: currency.trim() || "HTG",
        notes: notes.trim() || undefined,
        items: payloadLines,
      });
      setOrder(updated);
      setInfo("Bon d achat mis a jour.");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleReceive() {
    if (!businessSlug || !order) return;
    if (!window.confirm(`Marquer ${order.number} comme recu et augmenter le stock ?`)) return;
    setActionLoading(true);
    setError("");
    setInfo("");
    try {
      const updated = await receivePurchaseOrder(businessSlug, order.id);
      setOrder(updated);
      setInfo(`${order.number} recu. Stock mis a jour.`);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    if (!businessSlug || !order) return;
    if (!window.confirm(`Annuler ${order.number} ?`)) return;
    setActionLoading(true);
    setError("");
    setInfo("");
    try {
      await cancelPurchaseOrder(businessSlug, order.id);
      setInfo(`${order.number} annule.`);
      void load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Chargement...</div>;
  }

  if (!order) {
    return (
      <div className="space-y-4 p-6">
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error || "Bon d achat introuvable."}
        </div>
        <Link href={`/${businessSlug}/purchase-orders`} className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Retour aux bons d achat
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <button
          type="button"
          onClick={() => router.push(`/${businessSlug}/purchase-orders`)}
          className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </button>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{order.number}</h1>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClassName(order.status)}`}>
                {statusLabel(order.status)}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {order.supplierName ? `Fournisseur: ${order.supplierName}` : "Sans fournisseur"}
              {order.receivedAt ? ` | Recu le ${new Date(order.receivedAt).toLocaleString("fr-FR")}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            {isEditable ? (
              <>
                <button type="button" onClick={() => void handleReceive()} disabled={actionLoading} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                  <CheckCircle2 className="h-4 w-4" />
                  Recevoir
                </button>
                <button type="button" onClick={() => void handleCancel()} disabled={actionLoading} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60">
                  <Trash2 className="h-4 w-4" />
                  Annuler
                </button>
              </>
            ) : null}
          </div>
        </div>
      </section>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</section>
      ) : null}
      {info ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{info}</section>
      ) : null}

      {!isEditable ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Ce bon d achat est {statusLabel(order.status).toLowerCase()} et ne peut plus etre modifie.
        </section>
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
              disabled={!isEditable}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="">Sans fournisseur</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-sm font-medium text-slate-700">
            Date commande
            <input type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} disabled={!isEditable} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500" />
          </label>
          <label className="space-y-1.5 text-sm font-medium text-slate-700">
            Date prevue
            <input type="date" value={expectedAt} onChange={(event) => setExpectedAt(event.target.value)} disabled={!isEditable} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500" />
          </label>
          <label className="space-y-1.5 text-sm font-medium text-slate-700">
            Devise
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              disabled={!isEditable}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500"
            >
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
                <th className="py-2 pr-3">Recu</th>
                <th className="py-2 pr-3">Cout</th>
                <th className="py-2 pr-3">Taxe %</th>
                <th className="py-2 pr-3">Note</th>
                {isEditable ? <th className="py-2 text-right">Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const receivedQuantity = order.items[index]?.receivedQuantity ?? 0;
                return (
                  <tr key={index} className="border-b border-slate-100">
                    <td className="py-2 pr-3">
                      <select
                        value={line.productId}
                        onChange={(event) => updateLine(index, { productId: event.target.value })}
                        disabled={!isEditable}
                        className="w-56 rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500"
                      >
                        <option value="">Produit</option>
                        {products.map((product) => (
                          <option key={String(product.id)} value={String(product.id)}>{product.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <input type="number" min="0.001" step="0.001" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} disabled={!isEditable} className="w-24 rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500" />
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{receivedQuantity}</td>
                    <td className="py-2 pr-3">
                      <input type="number" min="0" step="0.01" value={line.unitCost} onChange={(event) => updateLine(index, { unitCost: event.target.value })} disabled={!isEditable} className="w-24 rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500" />
                    </td>
                    <td className="py-2 pr-3">
                      <input type="number" min="0" max="100" step="0.01" value={line.taxRate} onChange={(event) => updateLine(index, { taxRate: event.target.value })} disabled={!isEditable} className="w-20 rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500" />
                    </td>
                    <td className="py-2 pr-3">
                      <input value={line.notes} onChange={(event) => updateLine(index, { notes: event.target.value })} disabled={!isEditable} className="w-48 rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500" />
                    </td>
                    {isEditable ? (
                      <td className="py-2 text-right">
                        <button type="button" onClick={() => removeLine(index)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Retirer la ligne">
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {isEditable ? (
            <button type="button" onClick={() => setLines((prev) => [...prev, emptyLine()])} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Plus className="h-4 w-4" />
              Ajouter ligne
            </button>
          ) : <span />}
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes" rows={2} disabled={!isEditable} className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500 md:w-80" />
            <div className="text-right text-sm text-slate-600">
              <div>Sous-total: {formatMoney(isEditable ? formTotals.subtotal : order.subtotal, currency || "HTG")}</div>
              <div>Taxe: {formatMoney(isEditable ? formTotals.taxTotal : order.taxTotal, currency || "HTG")}</div>
              <div>Total: <span className="font-bold text-slate-900">{formatMoney(isEditable ? formTotals.total : order.total, currency || "HTG")}</span></div>
            </div>
            {isEditable ? (
              <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                <Save className="h-4 w-4" />
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            ) : null}
          </div>
        </div>
      </form>
    </div>
  );
}
