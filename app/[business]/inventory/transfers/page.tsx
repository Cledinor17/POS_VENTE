"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowRight, PackageCheck, PackageX, Truck } from "lucide-react";
import { ApiError } from "@/lib/api";
import { useBranch } from "@/context/BranchContext";
import { getProducts, type CatalogProduct } from "@/lib/catalogApi";
import {
  cancelStockTransfer,
  createStockTransfer,
  listStockTransfers,
  receiveStockTransfer,
  type StockTransfer,
} from "@/lib/stockTransfersApi";
import { usePermissionGuard } from "@/lib/usePermissionGuard";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("fr-FR");
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  sent: { label: "En transit", className: "bg-amber-50 text-amber-700" },
  received: { label: "Recu", className: "bg-emerald-50 text-emerald-700" },
  cancelled: { label: "Annule", className: "bg-slate-100 text-slate-500" },
};

type DraftLine = { productId: string; quantity: string };

export default function StockTransfersPage() {
  const { allowed, loading: permLoading } = usePermissionGuard("inventory.read");
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";
  const { branches, currentBranch } = useBranch();

  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [reloadSeq, setReloadSeq] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toBranchId, setToBranchId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([{ productId: "", quantity: "" }]);

  const otherBranches = useMemo(
    () => branches.filter((item) => item.isActive && item.id !== currentBranch?.id),
    [branches, currentBranch],
  );

  const reload = useCallback(async () => {
    if (!businessSlug) return;
    setLoading(true);
    setError("");
    try {
      const result = await listStockTransfers(businessSlug);
      setTransfers(result.items);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [businessSlug]);

  useEffect(() => {
    void reload();
  }, [reload, reloadSeq, currentBranch?.id]);

  useEffect(() => {
    let mounted = true;
    async function loadProducts() {
      if (!businessSlug) return;
      try {
        const data = await getProducts(businessSlug, { all: true });
        if (mounted) setProducts(data);
      } catch {
        if (mounted) setProducts([]);
      }
    }
    void loadProducts();
    return () => {
      mounted = false;
    };
  }, [businessSlug, currentBranch?.id]);

  function resetForm() {
    setToBranchId("");
    setNotes("");
    setLines([{ productId: "", quantity: "" }]);
  }

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessSlug) return;

    const items = lines
      .filter((line) => line.productId && Number(line.quantity) > 0)
      .map((line) => ({ productId: line.productId, quantity: Number(line.quantity) }));

    if (!toBranchId) {
      setError("Choisis la succursale de destination.");
      return;
    }
    if (items.length === 0) {
      setError("Ajoute au moins un produit avec une quantite.");
      return;
    }

    setSaving(true);
    setError("");
    setInfo("");
    try {
      const created = await createStockTransfer(businessSlug, { toBranchId, notes, items });
      setInfo(`Transfert ${created.reference} envoye. Le stock est en transit jusqu'a la reception.`);
      setFormOpen(false);
      resetForm();
      setReloadSeq((prev) => prev + 1);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleReceive(transfer: StockTransfer) {
    if (!businessSlug) return;
    setBusyId(transfer.id);
    setError("");
    setInfo("");
    try {
      await receiveStockTransfer(businessSlug, transfer.id);
      setInfo(`Transfert ${transfer.reference} recu.`);
      setReloadSeq((prev) => prev + 1);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId("");
    }
  }

  async function handleReceivePartial(transfer: StockTransfer) {
    if (!businessSlug) return;

    const received: Array<{ id: string; receivedQuantity: number }> = [];
    for (const item of transfer.items) {
      const answer = window.prompt(
        `${item.productName} — quantite reellement recue (envoyee: ${item.quantity})`,
        String(item.quantity),
      );
      if (answer === null) return;
      const value = Number(answer);
      if (!Number.isFinite(value) || value < 0 || value > item.quantity) {
        setError(`Quantite invalide pour ${item.productName} (max ${item.quantity}).`);
        return;
      }
      received.push({ id: item.id, receivedQuantity: value });
    }

    setBusyId(transfer.id);
    setError("");
    setInfo("");
    try {
      const result = await receiveStockTransfer(businessSlug, transfer.id, received);
      setInfo(
        result.hasDiscrepancy
          ? `Transfert ${transfer.reference} recu avec un ecart : la difference est signalee sur le document.`
          : `Transfert ${transfer.reference} recu.`,
      );
      setReloadSeq((prev) => prev + 1);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId("");
    }
  }

  async function handleCancel(transfer: StockTransfer) {
    if (!businessSlug) return;
    if (!window.confirm(`Annuler le transfert ${transfer.reference} ? Le stock revient a la succursale expeditrice.`)) {
      return;
    }
    setBusyId(transfer.id);
    setError("");
    setInfo("");
    try {
      await cancelStockTransfer(businessSlug, transfer.id);
      setInfo(`Transfert ${transfer.reference} annule, stock restitue.`);
      setReloadSeq((prev) => prev + 1);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId("");
    }
  }

  if (permLoading || !allowed) return null;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Transferts de stock</h1>
            <p className="mt-1 text-slate-500">
              Envoie du stock vers une autre succursale. Il quitte la succursale de depart
              immediatement et n&apos;entre chez le destinataire qu&apos;a la reception.
            </p>
          </div>
          {otherBranches.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setFormOpen(true);
                setError("");
                setInfo("");
              }}
              className="rounded-xl brand-primary-btn px-4 py-2.5 text-sm font-semibold text-white"
            >
              Nouveau transfert
            </button>
          ) : null}
        </div>
        {currentBranch ? (
          <div className="mt-3 text-sm text-slate-600">
            Succursale active : <span className="font-semibold text-slate-900">{currentBranch.name}</span>
          </div>
        ) : null}
      </section>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</section>
      ) : null}
      {info ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{info}</section>
      ) : null}

      {otherBranches.length === 0 ? (
        <section className="rounded-2xl border border-slate-100 bg-white p-6 text-center text-slate-500 shadow-sm">
          Il faut au moins deux succursales actives pour transferer du stock.
        </section>
      ) : null}

      {formOpen ? (
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <form onSubmit={handleSend} className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <label className="text-sm font-semibold text-slate-700">Destination *</label>
                <select
                  value={toBranchId}
                  onChange={(event) => setToBranchId(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">Choisir une succursale...</option>
                  {otherBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[220px] flex-1">
                <label className="text-sm font-semibold text-slate-700">Note (optionnel)</label>
                <input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Ex: livraison camion mardi"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div className="space-y-2">
              {lines.map((line, index) => (
                <div key={index} className="flex flex-wrap items-center gap-2">
                  <select
                    value={line.productId}
                    onChange={(event) => updateLine(index, { productId: event.target.value })}
                    className="min-w-[240px] flex-1 rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">Produit...</option>
                    {products.map((product) => (
                      <option key={String(product.id)} value={String(product.id)}>
                        {product.name} ({product.stock} en stock)
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={line.quantity}
                    onChange={(event) => updateLine(index, { quantity: event.target.value })}
                    placeholder="Quantite"
                    className="w-32 rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                  <button
                    type="button"
                    onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                    disabled={lines.length === 1}
                    className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Retirer
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setLines((prev) => [...prev, { productId: "", quantity: "" }])}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                + Ajouter une ligne
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl brand-primary-btn px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Envoi..." : "Envoyer le transfert"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false);
                  resetForm();
                }}
                disabled={saving}
                className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Annuler
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        {loading ? (
          <div className="py-8 text-center text-slate-500">Chargement des transferts...</div>
        ) : transfers.length === 0 ? (
          <div className="py-8 text-center text-slate-500">Aucun transfert pour cette succursale.</div>
        ) : (
          transfers.map((transfer) => {
            const isIncoming = transfer.toBranchId === currentBranch?.id;
            const status = STATUS_LABELS[transfer.status] ?? STATUS_LABELS.sent;
            const busy = busyId === transfer.id;

            return (
              <div key={transfer.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Truck className="h-5 w-5 shrink-0 text-slate-400" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                        {transfer.fromBranchName}
                        <ArrowRight className="h-4 w-4 text-slate-400" />
                        {transfer.toBranchName}
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>
                          {status.label}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            isIncoming ? "bg-sky-50 text-sky-700" : "bg-violet-50 text-violet-700"
                          }`}
                        >
                          {isIncoming ? "Entrant" : "Sortant"}
                        </span>
                        {transfer.hasDiscrepancy ? (
                          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                            Ecart constate
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {transfer.reference} | envoye le {formatDate(transfer.sentAt)}
                        {transfer.sentBy ? ` par ${transfer.sentBy}` : ""}
                        {transfer.receivedAt ? ` | recu le ${formatDate(transfer.receivedAt)}` : ""}
                        {transfer.receivedBy ? ` par ${transfer.receivedBy}` : ""}
                      </div>
                    </div>
                  </div>

                  {transfer.status === "sent" ? (
                    <div className="flex flex-wrap gap-2">
                      {isIncoming ? (
                        <>
                          <button
                            onClick={() => void handleReceive(transfer)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                          >
                            <PackageCheck className="h-3.5 w-3.5" /> Tout recu
                          </button>
                          <button
                            onClick={() => void handleReceivePartial(transfer)}
                            disabled={busy}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                          >
                            Reception partielle
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => void handleCancel(transfer)}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                        >
                          <PackageX className="h-3.5 w-3.5" /> Annuler
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-slate-500">
                        <th className="py-1.5 pr-3 font-semibold">Produit</th>
                        <th className="py-1.5 pr-3 font-semibold">Envoye</th>
                        <th className="py-1.5 font-semibold">Recu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transfer.items.map((item) => {
                        const short =
                          item.receivedQuantity !== null && item.receivedQuantity < item.quantity;
                        return (
                          <tr key={item.id} className="border-b last:border-0">
                            <td className="py-1.5 pr-3 text-slate-800">
                              {item.productName}
                              {item.productSku ? (
                                <span className="ml-1.5 text-xs text-slate-400">{item.productSku}</span>
                              ) : null}
                            </td>
                            <td className="py-1.5 pr-3 text-slate-600">{item.quantity}</td>
                            <td className={`py-1.5 ${short ? "font-semibold text-rose-700" : "text-slate-600"}`}>
                              {item.receivedQuantity === null ? "-" : item.receivedQuantity}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {transfer.notes ? (
                  <div className="mt-2 text-xs text-slate-500">Note : {transfer.notes}</div>
                ) : null}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
