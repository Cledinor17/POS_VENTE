"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  addInvoicePayment,
  fetchInvoicePdf,
  listInvoices,
  type InvoiceItem,
  type InvoicePaymentMethod,
} from "@/lib/documentsApi";

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

function formatActor(name: string | null, id: string | null): string {
  if (name && name.trim().length > 0) return name;
  if (id && id.trim().length > 0) return `#${id}`;
  return "-";
}

export default function InvoicesPage() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";

  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [reloadSeq, setReloadSeq] = useState(0);
  const [rowBusyKey, setRowBusyKey] = useState("");
  const [info, setInfo] = useState("");
  const [paymentTarget, setPaymentTarget] = useState<InvoiceItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<InvoicePaymentMethod>("cash");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!businessSlug) return;
      setLoading(true);
      setError("");
      try {
        const res = await listInvoices(businessSlug, {
          page,
          perPage: 20,
          status: status || undefined,
          from: from || undefined,
          to: to || undefined,
        });
        if (!mounted) return;
        setItems(res.items);
        setLastPage(res.lastPage);
        setTotal(res.total);
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
  }, [businessSlug, page, status, from, to, reloadSeq]);

  function resetPaymentForm() {
    setPaymentAmount("");
    setPaymentMethod("cash");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentReference("");
    setPaymentNotes("");
  }

  function closePaymentModal() {
    setPaymentTarget(null);
    resetPaymentForm();
  }

  function openPaymentModal(item: InvoiceItem) {
    setError("");
    setInfo("");
    setPaymentTarget(item);
    setPaymentAmount(item.balanceDue > 0 ? item.balanceDue.toFixed(2) : "");
    setPaymentMethod("cash");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentReference("");
    setPaymentNotes("");
  }

  async function handlePrintInvoice(item: InvoiceItem) {
    if (!businessSlug) return;
    setRowBusyKey(`print-${item.id}`);
    setError("");
    setInfo("");
    try {
      const blob = await fetchInvoicePdf(businessSlug, item.id);
      const url = URL.createObjectURL(blob);
      const popup = window.open(url, "_blank", "noopener,noreferrer");
      const filename = item.number || `facture-${item.id}`;

      if (!popup) {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${filename}.pdf`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }

      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setRowBusyKey("");
    }
  }

  async function handleSubmitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessSlug || !paymentTarget) return;

    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Montant de paiement invalide.");
      return;
    }

    if (amount - paymentTarget.balanceDue > 0.000001) {
      setError("Le paiement depasse le solde restant.");
      return;
    }

    setRowBusyKey(`pay-${paymentTarget.id}`);
    setError("");
    setInfo("");
    try {
      const updated = await addInvoicePayment(businessSlug, paymentTarget.id, {
        amount,
        method: paymentMethod,
        paidAt: paymentDate || undefined,
        reference: paymentReference.trim() || undefined,
        notes: paymentNotes.trim() || undefined,
      });
      setInfo(
        `Paiement enregistre sur ${updated.number}: ${formatMoney(amount, updated.currency)} (${updated.status}).`,
      );
      closePaymentModal();
      setReloadSeq((prev) => prev + 1);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setRowBusyKey("");
    }
  }

  return (
    <div className="space-y-5">
      <section className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Factures</h1>
        <p className="text-sm text-slate-500 mt-1">
          Liste reliee a `invoices` backend.
        </p>
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

      <section className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            placeholder="Statut (issued, paid...)"
            className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <input
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <input
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <button
            onClick={() => {
              setStatus("");
              setFrom("");
              setTo("");
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Reinitialiser
          </button>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b text-sm text-slate-600">
          {total} facture(s)
        </div>
        {loading ? (
          <div className="py-10 text-center text-slate-500">Chargement...</div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-slate-500">
            Aucune facture trouvee.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-3 pr-3 px-4 font-semibold">Numero</th>
                  <th className="py-3 pr-3 font-semibold">Client</th>
                  <th className="py-3 pr-3 font-semibold">Operateur</th>
                  <th className="py-3 pr-3 font-semibold">Date</th>
                  <th className="py-3 pr-3 font-semibold">Echeance</th>
                  <th className="py-3 pr-3 font-semibold">Total</th>
                  <th className="py-3 pr-3 font-semibold">Paye</th>
                  <th className="py-3 pr-3 font-semibold">Solde</th>
                  <th className="py-3 pr-3 font-semibold">Lignes</th>
                  <th className="py-3 px-4 font-semibold">Statut</th>
                  <th className="py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const printBusy = rowBusyKey === `print-${item.id}`;
                  const payBusy = rowBusyKey === `pay-${item.id}`;
                  const paymentBlocked =
                    item.balanceDue <= 0.000001 ||
                    ["paid", "void", "refunded"].includes(
                      item.status.toLowerCase(),
                    );

                  return (
                    <tr
                      key={item.id || item.number || `invoice-${index}`}
                      className="border-b last:border-0"
                    >
                      <td className="py-3 pr-3 px-4 font-semibold text-slate-800">
                        {item.number}
                      </td>
                      <td className="py-3 pr-3 text-slate-700">
                        {item.customerName}
                      </td>
                      <td className="py-3 pr-3 text-slate-700">
                        {formatActor(item.createdByName, item.createdBy)}
                      </td>
                      <td className="py-3 pr-3 text-slate-600">
                        {item.issueDate || "-"}
                      </td>
                      <td className="py-3 pr-3 text-slate-600">
                        {item.dueDate || "-"}
                      </td>
                      <td className="py-3 pr-3 font-semibold text-slate-800">
                        {formatMoney(item.total, item.currency)}
                      </td>
                      <td className="py-3 pr-3 text-emerald-700 font-semibold">
                        {formatMoney(item.amountPaid, item.currency)}
                      </td>
                      <td className="py-3 pr-3 text-rose-700 font-semibold">
                        {formatMoney(item.balanceDue, item.currency)}
                      </td>
                      <td className="py-3 pr-3 text-slate-700">
                        {item.itemsCount}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              void handlePrintInvoice(item);
                            }}
                            disabled={printBusy || payBusy || loading}
                            title="Reimprimer facture"
                            aria-label="Reimprimer facture"
                            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <i
                              className="fa-solid fa-print"
                              aria-hidden="true"
                            />
                          </button>
                          <button
                            onClick={() => {
                              openPaymentModal(item);
                            }}
                            disabled={
                              paymentBlocked || printBusy || payBusy || loading
                            }
                            title="Ajouter paiement"
                            aria-label="Ajouter paiement"
                            className="rounded-lg border border-emerald-300 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            <i
                              className="fa-solid fa-money-bill-wave"
                              aria-hidden="true"
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-4 py-3 border-t flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Page {page}/{Math.max(1, lastPage)}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || loading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Precedent
            </button>
            <button
              onClick={() => setPage((prev) => Math.min(lastPage, prev + 1))}
              disabled={page >= lastPage || loading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Suivant
            </button>
          </div>
        </div>
      </section>

      {paymentTarget ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Ajouter paiement
                </h3>
                <p className="text-sm text-slate-500">
                  Facture {paymentTarget.number} | Solde:{" "}
                  {formatMoney(
                    paymentTarget.balanceDue,
                    paymentTarget.currency,
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={closePaymentModal}
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Fermer
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="mt-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                  placeholder="Montant"
                  className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <select
                  value={paymentMethod}
                  onChange={(event) =>
                    setPaymentMethod(event.target.value as InvoicePaymentMethod)
                  }
                  className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Carte</option>
                  <option value="bank">Banque</option>
                  <option value="moncash">Moncash</option>
                  <option value="cheque">Cheque</option>
                  <option value="other">Autre</option>
                </select>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(event) => setPaymentDate(event.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <input
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                  placeholder="Reference (optionnel)"
                  className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <textarea
                value={paymentNotes}
                onChange={(event) => setPaymentNotes(event.target.value)}
                placeholder="Notes (optionnel)"
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closePaymentModal}
                  className="cancel-default rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={rowBusyKey === `pay-${paymentTarget.id}`}
                  className="rounded-xl brand-primary-btn px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {rowBusyKey === `pay-${paymentTarget.id}`
                    ? "Enregistrement..."
                    : "Enregistrer paiement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
