"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { RefreshCcw, RotateCcw, Search } from "lucide-react";
import SensitiveActionApprovalModal, {
  type SensitiveActionApproval,
} from "@/components/SensitiveActionApprovalModal";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { hasPermission } from "@/lib/businessAccess";
import {
  listBusinessApprovers,
  type BusinessApproverItem,
} from "@/lib/businessUsersApi";
import {
  listPosSales,
  refundPosSale,
  type PosSaleHistoryItem,
} from "@/lib/posApi";

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

function refundableAmount(sale: PosSaleHistoryItem): number {
  return Math.max(0, Number(sale.amountPaid || 0));
}

export default function ReturnsPage() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";
  const { permissions } = useAuth();
  const canSelfApproveRefund = hasPermission(permissions, "billing.refund");
  const [items, setItems] = useState<PosSaleHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [reloadSeq, setReloadSeq] = useState(0);
  const [selectedSale, setSelectedSale] = useState<PosSaleHistoryItem | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvers, setApprovers] = useState<BusinessApproverItem[]>([]);
  const [approversLoading, setApproversLoading] = useState(false);

  const pageLabel = useMemo(() => `Page ${page}/${Math.max(1, lastPage)}`, [lastPage, page]);

  const load = useCallback(async () => {
    if (!businessSlug) return;
    setLoading(true);
    setError("");
    try {
      const res = await listPosSales(businessSlug, {
        page,
        perPage: 20,
        q: query || undefined,
      });
      setItems(res.items.filter((sale) => sale.status !== "void" && refundableAmount(sale) > 0));
      setLastPage(res.lastPage);
      setTotal(res.total);
      if (res.lastPage > 0 && page > res.lastPage) {
        setPage(res.lastPage);
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [businessSlug, page, query]);

  useEffect(() => {
    void load();
  }, [load, reloadSeq]);

  useEffect(() => {
    if (!approvalOpen || !businessSlug || canSelfApproveRefund) return;
    let cancelled = false;
    setApproversLoading(true);
    setApprovers([]);
    void listBusinessApprovers(businessSlug, "refund_payments")
      .then((rows) => {
        if (!cancelled) setApprovers(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(getErrorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setApproversLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [approvalOpen, businessSlug, canSelfApproveRefund]);

  function selectSale(sale: PosSaleHistoryItem) {
    setSelectedSale(sale);
    setAmount(String(refundableAmount(sale)));
    setMethod(sale.paymentMethod || "cash");
    setReference("");
    setNotes("");
    setError("");
    setInfo("");
  }

  async function submitRefund(approval?: SensitiveActionApproval) {
    if (!businessSlug || !selectedSale) return;
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Montant de remboursement invalide.");
      return;
    }
    if (parsedAmount > refundableAmount(selectedSale)) {
      setError("Le remboursement depasse le montant paye disponible.");
      return;
    }

    setSaving(true);
    setError("");
    setInfo("");
    try {
      await refundPosSale(businessSlug, selectedSale.id, {
        amount: parsedAmount,
        method,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        approval,
      });
      setInfo(`Remboursement applique sur ${selectedSale.receiptNo}.`);
      setSelectedSale(null);
      setAmount("");
      setReference("");
      setNotes("");
      setApprovalOpen(false);
      setReloadSeq((prev) => prev + 1);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function handleRefundSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSelfApproveRefund) {
      void submitRefund();
      return;
    }
    setApprovalOpen(true);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Retours et remboursements</h1>
            <p className="mt-1 text-sm text-slate-500">Remboursement des tickets payes avec validation si necessaire.</p>
          </div>
          <div className="text-sm text-slate-600">
            {total} ticket(s) | {pageLabel}
          </div>
        </div>
      </section>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</section>
      ) : null}
      {info ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{info}</section>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <form onSubmit={(event) => { event.preventDefault(); setPage(1); setQuery(queryInput.trim()); }} className="flex flex-1 gap-2">
              <div className="relative max-w-md flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Ticket, client, note" className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
              </div>
              <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Rechercher</button>
            </form>
            <button type="button" onClick={() => setReloadSeq((prev) => prev + 1)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Rafraichir">
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Ticket</th>
                  <th className="py-2 pr-4">Client</th>
                  <th className="py-2 pr-4">Statut</th>
                  <th className="py-2 pr-4 text-right">Payable</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-500">Chargement...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-500">Aucun ticket remboursable.</td></tr>
                ) : (
                  items.map((sale) => (
                    <tr key={sale.id} className="border-b border-slate-100">
                      <td className="py-3 pr-4 font-semibold text-slate-900">{sale.receiptNo}</td>
                      <td className="py-3 pr-4 text-slate-700">{sale.customerName || "-"}</td>
                      <td className="py-3 pr-4 text-slate-600">{sale.status}</td>
                      <td className="py-3 pr-4 text-right font-semibold text-slate-900">{formatMoney(refundableAmount(sale), sale.currency)}</td>
                      <td className="py-3 text-right">
                        <button type="button" onClick={() => selectSale(sale)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                          <RotateCcw className="h-4 w-4" />
                          Rembourser
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1} className="rounded-xl border border-slate-200 px-3 py-2 font-semibold disabled:opacity-50">Precedent</button>
            <span>{pageLabel}</span>
            <button type="button" onClick={() => setPage((prev) => Math.min(lastPage, prev + 1))} disabled={page >= lastPage} className="rounded-xl border border-slate-200 px-3 py-2 font-semibold disabled:opacity-50">Suivant</button>
          </div>
        </div>

        <form onSubmit={handleRefundSubmit} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Remboursement</h2>
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {selectedSale ? (
                <>
                  <div className="font-semibold text-slate-900">{selectedSale.receiptNo}</div>
                  <div>{selectedSale.customerName || "Client comptoir"}</div>
                  <div>Disponible: {formatMoney(refundableAmount(selectedSale), selectedSale.currency)}</div>
                </>
              ) : (
                "Selectionne un ticket dans la liste."
              )}
            </div>
            <label className="block space-y-1.5 text-sm font-medium text-slate-700">
              Montant
              <input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={!selectedSale} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100" />
            </label>
            <label className="block space-y-1.5 text-sm font-medium text-slate-700">
              Methode
              <select value={method} onChange={(event) => setMethod(event.target.value)} disabled={!selectedSale} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100">
                <option value="cash">Cash</option>
                <option value="card">Carte</option>
                <option value="bank">Virement</option>
                <option value="moncash">Mobile</option>
                <option value="cheque">Cheque</option>
              </select>
            </label>
            <label className="block space-y-1.5 text-sm font-medium text-slate-700">
              Reference
              <input value={reference} onChange={(event) => setReference(event.target.value)} disabled={!selectedSale} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100" />
            </label>
            <label className="block space-y-1.5 text-sm font-medium text-slate-700">
              Notes
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={!selectedSale} rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100" />
            </label>
            <button type="submit" disabled={!selectedSale || saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              <RotateCcw className="h-4 w-4" />
              {saving ? "Traitement..." : "Valider le remboursement"}
            </button>
          </div>
        </form>
      </section>

      <SensitiveActionApprovalModal
        open={approvalOpen}
        title="Autorisation remboursement"
        description="Cette action demande un manager ou superviseur autorise."
        confirmLabel="Autoriser le remboursement"
        loading={saving}
        approvers={canSelfApproveRefund ? undefined : approvers}
        approversLoading={approversLoading}
        onClose={() => {
          if (!saving) setApprovalOpen(false);
        }}
        onConfirm={(approval) => submitRefund(approval)}
      />
    </div>
  );
}
