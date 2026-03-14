"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  createExpense,
  createExpenseCategory,
  listExpenseCategories,
  listExpenses,
  updateExpenseCategory,
  type ExpenseCategoryItem,
  type ExpenseItem,
} from "@/lib/expensesApi";

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

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("fr-FR");
}

function todayValue(): string {
  return new Date().toISOString().slice(0, 10);
}

type ExpensesPageContentProps = {
  initialSection?: "journal" | "categories";
};

export function ExpensesPageContent({
  initialSection = "journal",
}: ExpensesPageContentProps) {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";
  const categoriesSectionRef = useRef<HTMLDivElement | null>(null);

  const [categories, setCategories] = useState<ExpenseCategoryItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [categoryBusyId, setCategoryBusyId] = useState("");
  const [reloadSeq, setReloadSeq] = useState(0);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);

  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");

  const [expenseCategoryId, setExpenseCategoryId] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCurrency, setExpenseCurrency] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayValue);
  const [expensePurpose, setExpensePurpose] = useState("");
  const [expenseJustification, setExpenseJustification] = useState("");
  const [expenseMethod, setExpenseMethod] = useState("");
  const [expenseReference, setExpenseReference] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [expenseAttachment, setExpenseAttachment] = useState<File | null>(null);
  const [expenseAttachmentInputKey, setExpenseAttachmentInputKey] = useState(0);

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  const activeCategories = useMemo(
    () => categories.filter((category) => category.isActive),
    [categories],
  );

  useEffect(() => {
    let mounted = true;

    async function loadCategories() {
      if (!businessSlug) return;
      setLoadingCategories(true);
      try {
        const items = await listExpenseCategories(businessSlug, { includeInactive: true });
        if (!mounted) return;
        setCategories(items);
      } catch (e) {
        if (mounted) setError(getErrorMessage(e));
      } finally {
        if (mounted) setLoadingCategories(false);
      }
    }

    void loadCategories();
    return () => {
      mounted = false;
    };
  }, [businessSlug, reloadSeq]);

  useEffect(() => {
    if (!activeCategories.length) {
      setExpenseCategoryId("");
      return;
    }

    const exists = activeCategories.some((category) => category.id === expenseCategoryId);
    if (!expenseCategoryId || !exists) {
      setExpenseCategoryId(activeCategories[0].id);
    }
  }, [activeCategories, expenseCategoryId]);

  useEffect(() => {
    let mounted = true;

    async function loadExpenses() {
      if (!businessSlug) return;
      setLoadingExpenses(true);
      try {
        const res = await listExpenses(businessSlug, {
          page,
          perPage: 20,
          q: query || undefined,
          categoryId: categoryFilter || undefined,
          from: dateFrom || undefined,
          to: dateTo || undefined,
        });
        if (!mounted) return;
        setExpenses(res.items);
        setLastPage(res.lastPage);
        setTotal(res.total);
      } catch (e) {
        if (mounted) setError(getErrorMessage(e));
      } finally {
        if (mounted) setLoadingExpenses(false);
      }
    }

    void loadExpenses();
    return () => {
      mounted = false;
    };
  }, [businessSlug, page, query, categoryFilter, dateFrom, dateTo, reloadSeq]);

  useEffect(() => {
    if (!categoryModalOpen && !expenseModalOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (expenseModalOpen) {
        closeExpenseModal();
        return;
      }
      closeCategoryModal();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [categoryModalOpen, expenseModalOpen, activeCategories]);

  const currentPageTotal = useMemo(
    () => expenses.reduce((sum, item) => sum + item.amount, 0),
    [expenses],
  );

  useEffect(() => {
    if (initialSection !== "categories") return;
    const timeoutId = window.setTimeout(() => {
      categoriesSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
    return () => window.clearTimeout(timeoutId);
  }, [initialSection, loadingCategories]);

  function resetCategoryForm() {
    setCategoryName("");
    setCategoryDescription("");
  }

  function closeCategoryModal() {
    setCategoryModalOpen(false);
    resetCategoryForm();
  }

  function openCategoryModal() {
    resetCategoryForm();
    setError("");
    setInfo("");
    setCategoryModalOpen(true);
  }

  function resetExpenseForm() {
    setExpenseCategoryId(activeCategories[0]?.id ?? "");
    setExpenseAmount("");
    setExpenseCurrency("");
    setExpenseDate(todayValue());
    setExpensePurpose("");
    setExpenseJustification("");
    setExpenseMethod("");
    setExpenseReference("");
    setExpenseNotes("");
    setExpenseAttachment(null);
    setExpenseAttachmentInputKey((prev) => prev + 1);
  }

  function closeExpenseModal() {
    setExpenseModalOpen(false);
    resetExpenseForm();
  }

  function openExpenseModal() {
    resetExpenseForm();
    setError("");
    setInfo("");
    setExpenseModalOpen(true);
  }

  async function handleCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessSlug) return;

    if (!categoryName.trim()) {
      setError("Le nom de la categorie est obligatoire.");
      return;
    }

    setSavingCategory(true);
    setError("");
    setInfo("");

    try {
      await createExpenseCategory(businessSlug, {
        name: categoryName.trim(),
        description: categoryDescription.trim() || undefined,
        isActive: true,
      });
      closeCategoryModal();
      setInfo("Categorie de depense ajoutee.");
      setReloadSeq((prev) => prev + 1);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSavingCategory(false);
    }
  }

  async function handleCategoryToggle(category: ExpenseCategoryItem) {
    if (!businessSlug) return;
    setCategoryBusyId(category.id);
    setError("");
    setInfo("");

    try {
      await updateExpenseCategory(businessSlug, category.id, {
        isActive: !category.isActive,
      });
      setInfo(
        category.isActive
          ? `Categorie ${category.name} desactivee.`
          : `Categorie ${category.name} activee.`,
      );
      setReloadSeq((prev) => prev + 1);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setCategoryBusyId("");
    }
  }

  async function handleExpenseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessSlug) return;

    const amountValue = Number(expenseAmount);
    if (!expenseCategoryId) {
      setError("Selectionne une categorie de depense.");
      return;
    }
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setError("Montant invalide.");
      return;
    }
    if (!expensePurpose.trim()) {
      setError("L'objectif de la depense est obligatoire.");
      return;
    }

    setSavingExpense(true);
    setError("");
    setInfo("");

    try {
      await createExpense(businessSlug, {
        expenseCategoryId,
        amount: amountValue,
        currency: expenseCurrency.trim() || undefined,
        expenseDate,
        purpose: expensePurpose.trim(),
        justification: expenseJustification.trim() || undefined,
        paymentMethod: expenseMethod.trim() || undefined,
        reference: expenseReference.trim() || undefined,
        notes: expenseNotes.trim() || undefined,
        attachment: expenseAttachment,
      });

      closeExpenseModal();
      setInfo("Depense enregistree.");
      setPage(1);
      setReloadSeq((prev) => prev + 1);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSavingExpense(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Depenses</h1>
            <p className="mt-1 text-slate-500">
              Enregistre les categories, les sorties d'argent et l'utilisateur qui les a saisies.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm text-slate-500">
              {total} depense(s) | categories: {categories.length}
            </div>
            <button
              type="button"
              onClick={openCategoryModal}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Ajouter categorie
            </button>
            <button
              type="button"
              onClick={openExpenseModal}
              className="rounded-xl brand-primary-btn px-4 py-2 text-sm font-semibold text-white"
            >
              Nouvelle depense
            </button>
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

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6">
          <div
            ref={categoriesSectionRef}
            className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold text-slate-900">Categories</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">{activeCategories.length} active(s)</span>
                <button
                  type="button"
                  onClick={openCategoryModal}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Ajouter
                </button>
              </div>
            </div>

            {loadingCategories ? (
              <div className="py-6 text-center text-slate-500">Chargement des categories...</div>
            ) : categories.length === 0 ? (
              <div className="py-6 text-center text-slate-500">Aucune categorie.</div>
            ) : (
              <div className="space-y-3">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="rounded-xl border border-slate-200 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-800">{category.name}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {category.description || "Sans description"} | {category.expensesCount} depense(s)
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          void handleCategoryToggle(category);
                        }}
                        disabled={categoryBusyId === category.id}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                          category.isActive
                            ? "border-amber-300 text-amber-700 hover:bg-amber-50"
                            : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        } disabled:opacity-60`}
                      >
                        {categoryBusyId === category.id
                          ? "..."
                          : category.isActive
                            ? "Desactiver"
                            : "Activer"}
                      </button>
                    </div>
                    <div className="mt-3">
                      <span
                        className={
                          category.isActive
                            ? "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                            : "inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                        }
                      >
                        {category.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="xl:col-span-2 space-y-6">
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="text-sm text-slate-500">Depenses trouvees</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{total}</div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="text-sm text-slate-500">Montant page courante</div>
              <div className="mt-2 text-2xl font-bold text-rose-700">
                {formatMoney(currentPageTotal, expenses[0]?.currency ?? expenseCurrency ?? "USD")}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="text-sm text-slate-500">Categories actives</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{activeCategories.length}</div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-bold text-slate-900">Journal des depenses</h2>
                <button
                  type="button"
                  onClick={openExpenseModal}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Nouvelle depense
                </button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Objectif, justification, reference..."
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <select
                  value={categoryFilter}
                  onChange={(event) => {
                    setCategoryFilter(event.target.value);
                    setPage(1);
                  }}
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">Toutes categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => {
                    setDateFrom(event.target.value);
                    setPage(1);
                  }}
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => {
                    setDateTo(event.target.value);
                    setPage(1);
                  }}
                  className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            {loadingExpenses ? (
              <div className="py-8 text-center text-slate-500">Chargement des depenses...</div>
            ) : expenses.length === 0 ? (
              <div className="py-8 text-center text-slate-500">Aucune depense trouvee.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-slate-500">
                      <th className="py-3 pr-3 font-semibold">Date</th>
                      <th className="py-3 pr-3 font-semibold">Categorie</th>
                      <th className="py-3 pr-3 font-semibold">Montant</th>
                      <th className="py-3 pr-3 font-semibold">Objectif</th>
                      <th className="py-3 pr-3 font-semibold">Paiement</th>
                      <th className="py-3 pr-3 font-semibold">Utilisateur</th>
                      <th className="py-3 font-semibold">Saisie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-3 pr-3 text-slate-700">{formatDate(item.expenseDate)}</td>
                        <td className="py-3 pr-3 text-slate-700">{item.category?.name || "-"}</td>
                        <td className="py-3 pr-3 font-semibold text-slate-900">
                          {formatMoney(item.amount, item.currency)}
                        </td>
                        <td className="py-3 pr-3">
                          <div className="font-semibold text-slate-800">{item.purpose}</div>
                          <div className="text-xs text-slate-500">
                            {item.justification || item.notes || "-"}
                          </div>
                          {item.attachmentUrl ? (
                            <a
                              href={item.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                            >
                              Voir fiche
                            </a>
                          ) : null}
                        </td>
                        <td className="py-3 pr-3 text-slate-600">
                          <div>{item.paymentMethod || "-"}</div>
                          <div className="text-xs text-slate-500">{item.reference || "-"}</div>
                        </td>
                        <td className="py-3 pr-3 text-slate-600">
                          {item.createdByUser?.name || item.createdByUser?.email || "-"}
                        </td>
                        <td className="py-3 text-slate-600">{formatDateTime(item.createdAt)}</td>
                      </tr>
                    ))}
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
                  disabled={page <= 1 || loadingExpenses}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Precedent
                </button>
                <button
                  onClick={() => setPage((prev) => Math.min(lastPage, prev + 1))}
                  disabled={page >= lastPage || loadingExpenses}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Suivant
                </button>
              </div>
            </div>
          </section>
        </div>
      </section>

      {categoryModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6"
          onClick={closeCategoryModal}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-100 bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-bold text-slate-900">Categorie de depense</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Ajoute une categorie pour classer les sorties d'argent.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCategoryModal}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Fermer
              </button>
            </div>

            <form
              onSubmit={handleCategorySubmit}
              className="mt-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-3"
            >
              <input
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                placeholder="Nom categorie *"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />

              <textarea
                value={categoryDescription}
                onChange={(event) => setCategoryDescription(event.target.value)}
                rows={3}
                placeholder="Description"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeCategoryModal}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingCategory}
                  className="rounded-xl brand-primary-btn px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingCategory ? "Ajout..." : "Ajouter categorie"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {expenseModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6"
          onClick={closeExpenseModal}
        >
          <div
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-100 bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-bold text-slate-900">Nouvelle depense</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Enregistre le montant, l'objectif et une fiche justificative si disponible.
                </p>
              </div>
              <button
                type="button"
                onClick={closeExpenseModal}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Fermer
              </button>
            </div>

            <form
              onSubmit={handleExpenseSubmit}
              className="mt-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-3"
            >
              <select
                value={expenseCategoryId}
                onChange={(event) => setExpenseCategoryId(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">Selectionner une categorie</option>
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={expenseAmount}
                  onChange={(event) => setExpenseAmount(event.target.value)}
                  placeholder="Montant *"
                  className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <input
                  value={expenseCurrency}
                  onChange={(event) => setExpenseCurrency(event.target.value.toUpperCase())}
                  placeholder="Devise"
                  className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(event) => setExpenseDate(event.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <input
                value={expensePurpose}
                onChange={(event) => setExpensePurpose(event.target.value)}
                placeholder="Objectif / motif *"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  value={expenseMethod}
                  onChange={(event) => setExpenseMethod(event.target.value)}
                  placeholder="Mode de sortie (cash, banque, mobile...)"
                  className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <input
                  value={expenseReference}
                  onChange={(event) => setExpenseReference(event.target.value)}
                  placeholder="Reference"
                  className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <textarea
                value={expenseJustification}
                onChange={(event) => setExpenseJustification(event.target.value)}
                rows={3}
                placeholder="Justification"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />

              <textarea
                value={expenseNotes}
                onChange={(event) => setExpenseNotes(event.target.value)}
                rows={2}
                placeholder="Notes internes"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />

              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
                <div className="text-sm font-semibold text-slate-800">Fiche justificative</div>
                <div className="mt-1 text-xs text-slate-500">
                  Optionnel. Tu peux joindre une photo, un scan ou un PDF.
                </div>
                <input
                  key={expenseAttachmentInputKey}
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf,image/*,application/pdf"
                  onChange={(event) => setExpenseAttachment(event.target.files?.[0] ?? null)}
                  className="mt-3 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:font-semibold file:text-slate-700 hover:file:bg-slate-100"
                />
                {expenseAttachment ? (
                  <div className="mt-2 text-xs text-slate-500">Fichier choisi: {expenseAttachment.name}</div>
                ) : null}
              </div>

              {activeCategories.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  Ajoute d'abord une categorie active pour enregistrer une depense.
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeExpenseModal}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingExpense || activeCategories.length === 0}
                  className="rounded-xl brand-primary-btn px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingExpense ? "Enregistrement..." : "Enregistrer depense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ExpensesPage() {
  return <ExpensesPageContent />;
}
