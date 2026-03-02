"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  createEmployee,
  createEmployeePayment,
  deleteEmployee,
  listEmployeePayments,
  listEmployees,
  updateEmployee,
  type EmployeeItem,
  type EmployeePaymentItem,
} from "@/lib/employeesApi";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

function formatMoney(amount: number, currency: string | null): string {
  const nextCurrency = (currency || "USD").trim().toUpperCase();
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: nextCurrency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${nextCurrency || "USD"}`;
  }
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR");
}

const PAY_FREQUENCIES: Array<"monthly" | "biweekly" | "weekly" | "hourly"> = [
  "monthly",
  "biweekly",
  "weekly",
  "hourly",
];

export default function EmployeesPage() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";

  const [items, setItems] = useState<EmployeeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"" | "1" | "0">("");
  const [reloadSeq, setReloadSeq] = useState(0);

  const [editingId, setEditingId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [salaryAmount, setSalaryAmount] = useState("");
  const [salaryCurrency, setSalaryCurrency] = useState("");
  const [payFrequency, setPayFrequency] = useState<"monthly" | "biweekly" | "weekly" | "hourly">("monthly");
  const [hiredAt, setHiredAt] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState("");

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [paymentItems, setPaymentItems] = useState<EmployeePaymentItem[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentReloadSeq, setPaymentReloadSeq] = useState(0);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentCurrency, setPaymentCurrency] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!businessSlug) return;
      setLoading(true);
      setError("");

      try {
        const res = await listEmployees(businessSlug, {
          page,
          perPage: 20,
          q: query || undefined,
          isActive: activeFilter === "" ? undefined : activeFilter === "1",
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
  }, [businessSlug, page, query, activeFilter, reloadSeq]);

  useEffect(() => {
    if (items.length === 0) {
      setSelectedEmployeeId("");
      return;
    }

    const exists = items.some((item) => item.id === selectedEmployeeId);
    if (!selectedEmployeeId || !exists) {
      setSelectedEmployeeId(items[0].id);
    }
  }, [items, selectedEmployeeId]);

  useEffect(() => {
    let mounted = true;

    async function loadPayments() {
      if (!businessSlug || !selectedEmployeeId) {
        setPaymentItems([]);
        return;
      }

      setPaymentLoading(true);
      try {
        const res = await listEmployeePayments(businessSlug, selectedEmployeeId, {
          page: 1,
          perPage: 20,
        });
        if (!mounted) return;
        setPaymentItems(res.items);
      } catch (e) {
        if (mounted) setError(getErrorMessage(e));
      } finally {
        if (mounted) setPaymentLoading(false);
      }
    }

    void loadPayments();
    return () => {
      mounted = false;
    };
  }, [businessSlug, selectedEmployeeId, paymentReloadSeq]);

  const activeCount = useMemo(
    () => items.filter((item) => item.isActive).length,
    [items],
  );

  const selectedEmployee = useMemo(
    () => items.find((item) => item.id === selectedEmployeeId) ?? null,
    [items, selectedEmployeeId],
  );

  function resetEmployeeForm() {
    setEditingId("");
    setName("");
    setEmail("");
    setPhone("");
    setJobTitle("");
    setSalaryAmount("");
    setSalaryCurrency("");
    setPayFrequency("monthly");
    setHiredAt("");
    setIsActive(true);
    setNotes("");
  }

  async function handleEmployeeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessSlug) return;

    if (!name.trim()) {
      setError("Le nom de l'employe est obligatoire.");
      return;
    }

    const parsedSalary = salaryAmount.trim().length > 0 ? Number(salaryAmount) : 0;
    if (!Number.isFinite(parsedSalary) || parsedSalary < 0) {
      setError("Salaire invalide.");
      return;
    }

    setSaving(true);
    setError("");
    setInfo("");

    try {
      if (editingId) {
        await updateEmployee(businessSlug, editingId, {
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          jobTitle: jobTitle.trim() || undefined,
          salaryAmount: parsedSalary,
          salaryCurrency: salaryCurrency.trim() || undefined,
          payFrequency,
          hiredAt: hiredAt || undefined,
          isActive,
          notes: notes.trim() || undefined,
        });
        setInfo("Employe mis a jour.");
      } else {
        await createEmployee(businessSlug, {
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          jobTitle: jobTitle.trim() || undefined,
          salaryAmount: parsedSalary,
          salaryCurrency: salaryCurrency.trim() || undefined,
          payFrequency,
          hiredAt: hiredAt || undefined,
          isActive,
          notes: notes.trim() || undefined,
        });
        setInfo("Employe ajoute.");
      }

      resetEmployeeForm();
      setPage(1);
      setReloadSeq((prev) => prev + 1);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(item: EmployeeItem) {
    setEditingId(item.id);
    setName(item.name);
    setEmail(item.email ?? "");
    setPhone(item.phone ?? "");
    setJobTitle(item.jobTitle ?? "");
    setSalaryAmount(String(item.salaryAmount ?? 0));
    setSalaryCurrency(item.salaryCurrency ?? "");
    setPayFrequency(
      item.payFrequency === "monthly" ||
        item.payFrequency === "biweekly" ||
        item.payFrequency === "weekly" ||
        item.payFrequency === "hourly"
        ? item.payFrequency
        : "monthly",
    );
    setHiredAt(item.hiredAt ?? "");
    setIsActive(item.isActive);
    setNotes(item.notes ?? "");
    setError("");
    setInfo("");
  }

  async function handleDelete(item: EmployeeItem) {
    if (!businessSlug) return;
    if (!window.confirm(`Supprimer ${item.name} ?`)) return;

    setBusyId(item.id);
    setError("");
    setInfo("");

    try {
      await deleteEmployee(businessSlug, item.id);
      setInfo("Employe supprime.");
      setReloadSeq((prev) => prev + 1);
      if (selectedEmployeeId === item.id) {
        setSelectedEmployeeId("");
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId("");
    }
  }

  async function handlePaymentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessSlug || !selectedEmployeeId) return;

    const amountValue = Number(paymentAmount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setError("Montant de paiement invalide.");
      return;
    }

    setPaymentSaving(true);
    setError("");
    setInfo("");

    try {
      await createEmployeePayment(businessSlug, selectedEmployeeId, {
        amount: amountValue,
        currency: paymentCurrency.trim() || undefined,
        paidAt: paymentDate || undefined,
        method: paymentMethod.trim() || undefined,
        reference: paymentReference.trim() || undefined,
        notes: paymentNotes.trim() || undefined,
      });

      setPaymentAmount("");
      setPaymentReference("");
      setPaymentNotes("");
      setInfo("Paiement employe enregistre.");
      setPaymentReloadSeq((prev) => prev + 1);
      setReloadSeq((prev) => prev + 1);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setPaymentSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Employes</h1>
            <p className="text-slate-500 mt-1">
              Gere les employes et enregistre les paiements de salaire.
            </p>
          </div>
          <div className="text-sm text-slate-500">
            {total} employe(s) | actifs sur page: {activeCount}
          </div>
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

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <form
          onSubmit={handleEmployeeSubmit}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3"
        >
          <h2 className="font-bold text-slate-900">
            {editingId ? "Modifier employe" : "Nouvel employe"}
          </h2>

          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nom *"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />

          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />

          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Telephone"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />

          <input
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
            placeholder="Poste"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />

          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={salaryAmount}
              onChange={(event) => setSalaryAmount(event.target.value)}
              placeholder="Salaire"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <input
              value={salaryCurrency}
              onChange={(event) => setSalaryCurrency(event.target.value.toUpperCase())}
              placeholder="Devise"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={payFrequency}
              onChange={(event) =>
                setPayFrequency(
                  event.target.value as "monthly" | "biweekly" | "weekly" | "hourly",
                )
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              {PAY_FREQUENCIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={hiredAt}
              onChange={(event) => setHiredAt(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            Employe actif
          </label>

          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="Notes"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />

          <div className="grid grid-cols-1 gap-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl brand-primary-btn text-white py-2.5 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving
                ? editingId
                  ? "Mise a jour..."
                  : "Ajout..."
                : editingId
                  ? "Mettre a jour"
                  : "Ajouter"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetEmployeeForm}
                disabled={saving}
                className="cancel-default w-full rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Annuler modification
              </button>
            ) : null}
          </div>
        </form>

        <div className="xl:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_170px_auto] gap-3">
            <input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Rechercher (nom, email, phone, poste)"
              className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <select
              value={activeFilter}
              onChange={(event) => {
                setActiveFilter(event.target.value as "" | "1" | "0");
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Tous</option>
              <option value="1">Actifs</option>
              <option value="0">Inactifs</option>
            </select>
            <button
              onClick={() => {
                setQuery(queryInput.trim());
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Filtrer
            </button>
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-500">
              Chargement des employes...
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-slate-500">
              Aucun employe trouve.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-3 pr-3 font-semibold">Employe</th>
                    <th className="py-3 pr-3 font-semibold">Poste</th>
                    <th className="py-3 pr-3 font-semibold">Salaire</th>
                    <th className="py-3 pr-3 font-semibold">Total paye</th>
                    <th className="py-3 pr-3 font-semibold">Statut</th>
                    <th className="py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const busy = busyId === item.id;
                    return (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-3 pr-3">
                          <div className="font-semibold text-slate-800">{item.name}</div>
                          <div className="text-xs text-slate-500">
                            {item.email || "-"} | {item.phone || "-"}
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-slate-600">{item.jobTitle || "-"}</td>
                        <td className="py-3 pr-3 text-slate-700">
                          {formatMoney(item.salaryAmount, item.salaryCurrency)}
                          <div className="text-xs text-slate-500">{item.payFrequency}</div>
                        </td>
                        <td className="py-3 pr-3 text-slate-700">
                          {formatMoney(item.totalPaidAmount, item.salaryCurrency)}
                        </td>
                        <td className="py-3 pr-3">
                          <span
                            className={
                              item.isActive
                                ? "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                                : "inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                            }
                          >
                            {item.isActive ? "Actif" : "Inactif"}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => beginEdit(item)}
                              disabled={busy}
                              title="Modifier"
                              aria-label="Modifier"
                              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            >
                              <i className="fa-solid fa-pen-to-square" aria-hidden="true" />
                            </button>
                            <button
                              onClick={() => setSelectedEmployeeId(item.id)}
                              disabled={busy}
                              title="Payer"
                              aria-label="Payer"
                              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            >
                              <i className="fa-solid fa-money-check-dollar" aria-hidden="true" />
                            </button>
                            <button
                              onClick={() => {
                                void handleDelete(item);
                              }}
                              disabled={busy}
                              title="Supprimer"
                              aria-label="Supprimer"
                              className="rounded-lg border border-rose-300 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                            >
                              <i className="fa-solid fa-trash" aria-hidden="true" />
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

          <div className="flex items-center justify-between">
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
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <form
          onSubmit={handlePaymentSubmit}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3"
        >
          <h2 className="font-bold text-slate-900">Paiement employe</h2>

          <select
            value={selectedEmployeeId}
            onChange={(event) => setSelectedEmployeeId(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">Selectionner un employe</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <input
            type="number"
            min="0"
            step="0.01"
            value={paymentAmount}
            onChange={(event) => setPaymentAmount(event.target.value)}
            placeholder="Montant *"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />

          <div className="grid grid-cols-2 gap-2">
            <input
              value={paymentCurrency}
              onChange={(event) => setPaymentCurrency(event.target.value.toUpperCase())}
              placeholder="Devise"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <input
              type="date"
              value={paymentDate}
              onChange={(event) => setPaymentDate(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <input
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value)}
            placeholder="Methode (cash, bank, mobile...)"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />

          <input
            value={paymentReference}
            onChange={(event) => setPaymentReference(event.target.value)}
            placeholder="Reference"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />

          <textarea
            value={paymentNotes}
            onChange={(event) => setPaymentNotes(event.target.value)}
            rows={3}
            placeholder="Notes"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />

          <button
            type="submit"
            disabled={paymentSaving || !selectedEmployeeId}
            className="w-full rounded-xl brand-primary-btn text-white py-2.5 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {paymentSaving ? "Enregistrement..." : "Enregistrer paiement"}
          </button>
        </form>

        <div className="xl:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900">
              Historique paiements
              {selectedEmployee ? ` - ${selectedEmployee.name}` : ""}
            </h2>
            {selectedEmployee ? (
              <div className="text-xs text-slate-500">
                Embauche: {formatDate(selectedEmployee.hiredAt)}
              </div>
            ) : null}
          </div>

          {paymentLoading ? (
            <div className="py-8 text-center text-slate-500">
              Chargement des paiements...
            </div>
          ) : paymentItems.length === 0 ? (
            <div className="py-8 text-center text-slate-500">
              Aucun paiement pour cet employe.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-3 pr-3 font-semibold">Date</th>
                    <th className="py-3 pr-3 font-semibold">Montant</th>
                    <th className="py-3 pr-3 font-semibold">Methode</th>
                    <th className="py-3 pr-3 font-semibold">Reference</th>
                    <th className="py-3 font-semibold">Par</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentItems.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-3 pr-3 text-slate-700">{formatDate(item.paidAt)}</td>
                      <td className="py-3 pr-3 text-slate-800 font-semibold">
                        {formatMoney(item.amount, item.currency)}
                      </td>
                      <td className="py-3 pr-3 text-slate-600">{item.method || "-"}</td>
                      <td className="py-3 pr-3 text-slate-600">{item.reference || "-"}</td>
                      <td className="py-3 text-slate-600">{item.recordedByName || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
