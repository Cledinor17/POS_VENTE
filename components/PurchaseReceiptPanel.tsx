"use client";
import { useEffect, useRef, useState } from "react";
import { safeGetItem, safeSetItem, safeRemoveItem } from "@/lib/safeStorage";
import { ApiError } from "@/lib/api";
import { receivePurchaseOrder, type PurchaseOrder } from "@/lib/purchasesApi";
import { getErrorMessage } from "@/lib/errors";

export default function PurchaseReceiptPanel({ business, order, onUpdated }: { business: string; order: PurchaseOrder; onUpdated: (order: PurchaseOrder) => void }) {
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [ready, setReady] = useState(false);
  const storageKey = `pos-purchase-receipt:${business}:${order.id}`;
  const request = useRef<Parameters<typeof receivePurchaseOrder>[2]>(undefined);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = safeGetItem(storageKey);
        if (saved) {
          const pending = JSON.parse(saved) as NonNullable<Parameters<typeof receivePurchaseOrder>[2]>;
          if (pending && typeof pending.idempotencyKey === "string" && pending.idempotencyKey && Array.isArray(pending.items) && pending.items.length > 0 && pending.items.every((item) => item && typeof item.id === "string" && Number.isFinite(item.quantity) && item.quantity > 0)) {
            request.current = pending;
            setNotes(pending.notes ?? "");
            setQuantities(Object.fromEntries(pending.items.map((item) => [item.id, String(item.quantity)])));
            setUncertain(true);
          } else throw new Error("Invalid saved receipt");
        }
      } catch { setReady(false); setError("La dernière réception locale est illisible. Faites vérifier l’historique avant un nouvel envoi."); return; }
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [storageKey]);
  const canReceive = order.status === "draft" || order.status === "ordered" || order.status === "partially_received";
  async function receive() {
    if (busy || !ready) return;
    setError("");
    if (!request.current) {
      const invalid = order.items.some((item) => { const value = Number(quantities[item.id] ?? 0); return !Number.isFinite(value) || value < 0 || value > Math.round((item.quantity - item.receivedQuantity) * 1000) / 1000; });
      if (invalid) { setError("Vérifiez les quantités : elles doivent être positives et ne pas dépasser le reste à livrer."); return; }
      const items = order.items.map((item) => ({ id: item.id, quantity: Number(quantities[item.id] ?? 0) })).filter((item) => item.quantity > 0);
      if (!items.length) { setError("Saisissez les quantités réellement livrées."); return; }
      request.current = { idempotencyKey: crypto.randomUUID(), notes, items };
      safeSetItem(storageKey, JSON.stringify(request.current));
      if (!safeGetItem(storageKey)) { request.current = undefined; setError("Le stockage local est indisponible. Activez-le avant de recevoir une livraison."); return; }
    }
    setBusy(true);
    try {
      const updated = await receivePurchaseOrder(business, order.id, request.current);
      onUpdated(updated); safeRemoveItem(storageKey); request.current = undefined; setQuantities({}); setNotes(""); setUncertain(false);
    } catch (error) {
      setError(getErrorMessage(error, "Une erreur est survenue."));
      if (error instanceof ApiError && error.status === 422) { safeRemoveItem(storageKey); request.current = undefined; setUncertain(false); }
      else setUncertain(true);
    } finally { setBusy(false); }
  }
  return <section id="purchase-receipts" className="space-y-4 rounded-2xl border bg-white p-5">
    <h2 className="text-lg font-bold">Réceptions et reste à livrer</h2>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-800">{error}</p>}
    {uncertain && <p className="rounded-xl bg-amber-50 p-3 text-amber-900">Confirmation indisponible. Réessayez le même envoi pour vérifier son résultat.</p>}
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-2">Produit</th><th>Commandé</th><th>Reçu</th><th>Reste</th>{canReceive && <th>Livré maintenant</th>}</tr></thead>
      <tbody>{order.items.map((item) => { const remaining = Math.max(0, Math.round((item.quantity - item.receivedQuantity) * 1000) / 1000); return <tr key={item.id} className="border-b"><td className="py-3">{item.productName}</td><td>{item.quantity}</td><td>{item.receivedQuantity}</td><td>{remaining}</td>{canReceive && <td><input type="number" aria-label={`Quantité reçue : ${item.productName}`} min="0" max={remaining} step="0.001" value={quantities[item.id] ?? ""} disabled={busy || uncertain || remaining === 0} onChange={(event) => setQuantities({ ...quantities, [item.id]: event.target.value })} className="w-28 rounded-lg border px-2 py-1" /></td>}</tr>; })}</tbody>
    </table></div>
    {(canReceive || uncertain) && <div className="flex flex-wrap items-center gap-3"><input value={notes} disabled={busy || uncertain} onChange={(event) => setNotes(event.target.value)} placeholder="Référence livraison / notes" className="min-w-56 flex-1 rounded-xl border p-2" /><button disabled={busy || !ready} onClick={() => void receive()} className="rounded-xl bg-emerald-600 px-4 py-2 text-white disabled:opacity-50">{busy ? "Enregistrement…" : uncertain ? "Vérifier cet envoi" : "Enregistrer la réception"}</button></div>}
    {order.receipts.length > 0 && <div className="space-y-2"><h3 className="font-semibold">Historique des livraisons</h3>{order.receipts.map((receipt) => <div key={receipt.id} className="rounded-xl bg-slate-50 p-3 text-sm"><p className="font-medium">{receipt.receivedAt} · {receipt.receiverName}</p><p>{receipt.items.map((item) => `${item.quantity} × ${item.productName}`).join(" · ")}</p>{receipt.notes && <p className="text-slate-600">{receipt.notes}</p>}</div>)}</div>}
  </section>;
}
