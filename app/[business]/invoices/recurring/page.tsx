"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { listCustomers, type CustomerItem } from "@/lib/customersApi";
import {
  createRecurringInvoice,
  deleteRecurringInvoice,
  pauseRecurringInvoice,
  resumeRecurringInvoice,
  RECURRING_FREQUENCIES,
  type RecurringFrequency,
  type RecurringInvoiceItemInput,
  type RecurringInvoiceSummary,
  listRecurringInvoices,
} from "@/lib/recurringInvoicesApi";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

function formatDate(value: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR");
}

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: "Hebdomadaire",
  monthly: "Mensuelle",
  quarterly: "Trimestrielle",
  yearly: "Annuelle",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  paused: "En pause",
  cancelled: "Terminee",
};

function emptyItem(): RecurringInvoiceItemInput {
  return { name: "", quantity: 1, unitPrice: 0 };
}

export default function RecurringInvoicesPage() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";

  const [items, setItems] = useState<RecurringInvoiceSummary[]>([]);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busyId, setBusyId] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [title, setTitle] = useState("");
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [autoSend, setAutoSend] = useState(false);
  const [lineItems, setLineItems] = useState<RecurringInvoiceItemInput[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!businessSlug) return;
    setLoading(true);
    setError("");
    try {
      const [runs, custs] = await Promise.all([
        listRecurringInvoices(businessSlug),
        listCustomers(businessSlug, { perPage: 100 }),
      ]);
      setItems(runs.items);
      setCustomers(custs.items);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [businessSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateLineItem(index: number, patch: Partial<RecurringInvoiceItemInput>) {
    setLineItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function addLineItem() {
    setLineItems((prev) => [...prev, emptyItem()]);
  }

  function removeLineItem(index: number) {
    setLineItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!businessSlug) return;

    const validItems = lineItems.filter((it) => it.name.trim() && it.quantity > 0 && it.unitPrice >= 0);
    if (validItems.length === 0) {
      setError("Ajoutez au moins une ligne valide.");
      return;
    }

    setSaving(true);
    setError("");
    setInfo("");
    try {
      await createRecurringInvoice(businessSlug, {
        customerId: customerId ? Number(customerId) : null,
        title: title.trim() || undefined,
        frequency,
        startDate,
        endDate: endDate || null,
        autoSend,
        items: validItems,
      });
      setFormOpen(false);
      setTitle("");
      setLineItems([emptyItem()]);
      setInfo("Gabarit de facturation recurrente cree.");
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function onTogglePause(item: RecurringInvoiceSummary) {
    if (!businessSlug) return;
    setBusyId(item.id);
    setError("");
    try {
      if (item.status === "active") await pauseRecurringInvoice(businessSlug, item.id);
      else if (item.status === "paused") await resumeRecurringInvoice(businessSlug, item.id);
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId("");
    }
  }

  async function onDelete(item: RecurringInvoiceSummary) {
    if (!businessSlug) return;
    if (!window.confirm(`Supprimer le gabarit "${item.title || item.customerName}" ?`)) return;
    setBusyId(item.id);
    setError("");
    try {
      await deleteRecurringInvoice(businessSlug, item.id);
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-blue-200 bg-gradient-to-r from-[#0b4f88] via-[#0d63b8] to-emerald-600 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Factures recurrentes</h1>
            <p className="mt-1 text-sm text-slate-200">
              Gabarits generant automatiquement une facture a intervalle regulier.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white px-4 py-2 text-sm font-semibold text-[#0b4f88] hover:bg-slate-100"
          >
            Nouveau gabarit
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {info ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{info}</div>
      ) : null}

      {formOpen ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-0.5 text-xs">
                <span className="text-slate-500">Client</span>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                >
                  <option value="">Client comptoir</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-0.5 text-xs">
                <span className="text-slate-500">Titre</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Abonnement mensuel..."
                  className="block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
              </label>
              <label className="space-y-0.5 text-xs">
                <span className="text-slate-500">Frequence</span>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                  className="block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                >
                  {RECURRING_FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {FREQUENCY_LABELS[f]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 pt-5 text-xs">
                <input type="checkbox" checked={autoSend} onChange={(e) => setAutoSend(e.target.checked)} />
                <span className="text-slate-600">Envoyer la facture par email automatiquement</span>
              </label>
              <label className="space-y-0.5 text-xs">
                <span className="text-slate-500">Date de depart</span>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
              </label>
              <label className="space-y-0.5 text-xs">
                <span className="text-slate-500">Date de fin (optionnel)</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
              </label>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Articles</div>
              {lineItems.map((it, i) => (
                <div key={i} className="flex flex-wrap items-end gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Designation"
                    value={it.name}
                    onChange={(e) => updateLineItem(i, { name: e.target.value })}
                    className="min-w-[180px] flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  />
                  <input
                    type="number"
                    min={0.001}
                    step="0.001"
                    required
                    value={it.quantity}
                    onChange={(e) => updateLineItem(i, { quantity: Number(e.target.value) })}
                    className="w-24 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                    aria-label="Quantite"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={it.unitPrice}
                    onChange={(e) => updateLineItem(i, { unitPrice: Number(e.target.value) })}
                    className="w-28 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                    aria-label="Prix unitaire"
                  />
                  <button
                    type="button"
                    onClick={() => removeLineItem(i)}
                    className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    Retirer
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addLineItem}
                className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                + Ajouter une ligne
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#0b4f88] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0d63b8] disabled:opacity-60"
              >
                {saving ? "Creation..." : "Creer le gabarit"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {loading ? (
          <div className="py-10 text-center text-sm text-slate-500">Chargement...</div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">Aucun gabarit de facturation recurrente.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-slate-500">
                  <th className="pb-2 font-semibold">Client / Titre</th>
                  <th className="pb-2 font-semibold">Frequence</th>
                  <th className="pb-2 font-semibold">Prochaine generation</th>
                  <th className="pb-2 font-semibold">Statut</th>
                  <th className="pb-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b last:border-0">
                    <td className="py-2">
                      <div className="font-medium text-slate-800">{it.title || it.customerName || "-"}</div>
                      <div className="text-xs text-slate-500">{it.customerName}</div>
                    </td>
                    <td className="py-2 text-slate-700">{FREQUENCY_LABELS[it.frequency]}</td>
                    <td className="py-2 text-slate-700">{formatDate(it.nextRunDate)}</td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          it.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : it.status === "paused"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {STATUS_LABELS[it.status]}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-2">
                        {it.status !== "cancelled" ? (
                          <button
                            type="button"
                            disabled={busyId === it.id}
                            onClick={() => onTogglePause(it)}
                            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                          >
                            {it.status === "active" ? "Mettre en pause" : "Reactiver"}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={busyId === it.id}
                          onClick={() => onDelete(it)}
                          className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
