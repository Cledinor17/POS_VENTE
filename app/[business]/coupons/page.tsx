"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  createCoupon,
  deleteCoupon,
  listCoupons,
  updateCoupon,
  type CouponDiscountType,
  type CouponItem,
} from "@/lib/couponsApi";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

export default function CouponsPage() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";

  const [items, setItems] = useState<CouponItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [info, setInfo] = useState("");
  const [reloadSeq, setReloadSeq] = useState(0);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [discountType, setDiscountType] = useState<CouponDiscountType>("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [minPurchaseAmount, setMinPurchaseAmount] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [maxUsesPerCustomer, setMaxUsesPerCustomer] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!businessSlug) return;
      setLoading(true);
      setPageError("");
      try {
        const res = await listCoupons(businessSlug);
        if (!mounted) return;
        setItems(res);
      } catch (e) {
        if (mounted) setPageError(getErrorMessage(e));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [businessSlug, reloadSeq]);

  const resetForm = useCallback(() => {
    setEditingId("");
    setCode("");
    setName("");
    setDiscountType("percent");
    setDiscountValue("");
    setMinPurchaseAmount("");
    setMaxUses("");
    setMaxUsesPerCustomer("");
    setStartsAt("");
    setExpiresAt("");
    setIsActive(true);
  }, []);

  function openCreateModal() {
    resetForm();
    setFormError("");
    setInfo("");
    setIsFormOpen(true);
  }

  const closeFormModal = useCallback(() => {
    if (saving) return;
    setIsFormOpen(false);
    setFormError("");
    resetForm();
  }, [resetForm, saving]);

  function beginEdit(item: CouponItem) {
    setEditingId(item.id);
    setCode(item.code);
    setName(item.name ?? "");
    setDiscountType(item.discountType);
    setDiscountValue(String(item.discountValue));
    setMinPurchaseAmount(item.minPurchaseAmount !== null ? String(item.minPurchaseAmount) : "");
    setMaxUses(item.maxUses !== null ? String(item.maxUses) : "");
    setMaxUsesPerCustomer(item.maxUsesPerCustomer !== null ? String(item.maxUsesPerCustomer) : "");
    setStartsAt(item.startsAt ?? "");
    setExpiresAt(item.expiresAt ?? "");
    setIsActive(item.isActive);
    setFormError("");
    setInfo("");
    setIsFormOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessSlug) return;
    if (!code.trim()) {
      setFormError("Le code est obligatoire.");
      return;
    }
    if (!discountValue.trim() || Number(discountValue) <= 0) {
      setFormError("La valeur de la remise doit etre superieure a zero.");
      return;
    }

    setSaving(true);
    setFormError("");
    setInfo("");
    try {
      const payload = {
        code: code.trim(),
        name: name.trim() || null,
        discountType,
        discountValue: Number(discountValue),
        minPurchaseAmount: minPurchaseAmount.trim() ? Number(minPurchaseAmount) : null,
        maxUses: maxUses.trim() ? Number(maxUses) : null,
        maxUsesPerCustomer: maxUsesPerCustomer.trim() ? Number(maxUsesPerCustomer) : null,
        startsAt: startsAt || null,
        expiresAt: expiresAt || null,
        isActive,
      };

      if (editingId) {
        const updated = await updateCoupon(businessSlug, editingId, payload);
        setItems((prev) => prev.map((row) => (row.id === editingId ? updated : row)));
        setInfo("Code promo mis a jour.");
      } else {
        await createCoupon(businessSlug, payload);
        setInfo("Code promo ajoute.");
      }
      resetForm();
      setIsFormOpen(false);
      setReloadSeq((prev) => prev + 1);
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: CouponItem) {
    if (!businessSlug) return;
    if (!window.confirm(`Supprimer le code promo "${item.code}" ?`)) return;
    setPageError("");
    setInfo("");
    try {
      await deleteCoupon(businessSlug, item.id);
      setInfo("Code promo supprime.");
      setReloadSeq((prev) => prev + 1);
    } catch (e) {
      setPageError(getErrorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Codes promo</h1>
            <p className="text-slate-500 mt-1">
              Cree des codes a saisir a la caisse pour appliquer une remise.
            </p>
          </div>
          <div className="text-sm text-slate-600">{items.length} code(s)</div>
        </div>
      </section>

      {pageError ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {pageError}
        </section>
      ) : null}
      {info ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {info}
        </section>
      ) : null}

      <section className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-600">
            Un code s&apos;applique une fois par vente, sans validation manager (regle deja
            approuvee a la creation du code).
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-xl brand-primary-btn px-4 py-2.5 text-sm font-semibold text-white"
          >
            Nouveau code promo
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-500">Chargement des codes promo...</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-slate-500">Aucun code promo configure.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-3 pr-3 font-semibold">Code</th>
                  <th className="py-3 pr-3 font-semibold">Remise</th>
                  <th className="py-3 pr-3 font-semibold">Utilisations</th>
                  <th className="py-3 pr-3 font-semibold">Validite</th>
                  <th className="py-3 pr-3 font-semibold">Statut</th>
                  <th className="py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-slate-800">{item.code}</div>
                      {item.name ? <div className="text-xs text-slate-500">{item.name}</div> : null}
                    </td>
                    <td className="py-3 pr-3 text-slate-600">
                      {item.discountType === "percent" ? `${item.discountValue}%` : item.discountValue}
                      {item.minPurchaseAmount ? (
                        <div className="text-xs text-slate-400">Min. {item.minPurchaseAmount}</div>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3 text-slate-600">
                      {item.usedCount}
                      {item.maxUses ? ` / ${item.maxUses}` : ""}
                      {item.maxUsesPerCustomer ? (
                        <div className="text-xs text-slate-400">Max {item.maxUsesPerCustomer}/client</div>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3 text-slate-600">
                      {item.startsAt ? `Debut ${item.startsAt}` : ""}
                      {item.expiresAt ? <div>Fin {item.expiresAt}</div> : null}
                      {!item.startsAt && !item.expiresAt ? "-" : null}
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
                          title="Modifier"
                          aria-label="Modifier"
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <i className="fa-solid fa-pen-to-square" aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          title="Supprimer"
                          aria-label="Supprimer"
                          className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                        >
                          <i className="fa-solid fa-trash" aria-hidden="true" />
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

      {isFormOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={closeFormModal}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-slate-100 bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold text-slate-900">
                  {editingId ? "Modifier le code promo" : "Nouveau code promo"}
                </h2>
                <button
                  type="button"
                  onClick={closeFormModal}
                  disabled={saving}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Fermer
                </button>
              </div>
              {formError ? (
                <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {formError}
                </section>
              ) : null}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="Code (ex: BIENVENUE10) *"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Libelle (optionnel)"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDiscountType("percent")}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                    discountType === "percent"
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Pourcentage
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType("fixed")}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                    discountType === "fixed"
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Montant fixe
                </button>
              </div>

              <input
                type="number"
                min="0.01"
                step="0.01"
                value={discountValue}
                onChange={(event) => setDiscountValue(event.target.value)}
                placeholder={discountType === "percent" ? "Valeur (%) *" : "Montant *"}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />

              <input
                type="number"
                min="0"
                step="0.01"
                value={minPurchaseAmount}
                onChange={(event) => setMinPurchaseAmount(event.target.value)}
                placeholder="Montant minimum d'achat (optionnel)"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={maxUses}
                  onChange={(event) => setMaxUses(event.target.value)}
                  placeholder="Nombre max d'utilisations (illimite si vide)"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={maxUsesPerCustomer}
                  onChange={(event) => setMaxUsesPerCustomer(event.target.value)}
                  placeholder="Max par client (illimite si vide)"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-500">Debut (optionnel)</span>
                  <input
                    type="date"
                    value={startsAt}
                    onChange={(event) => setStartsAt(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-500">Expiration (optionnel)</span>
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={(event) => setExpiresAt(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(event) => setIsActive(event.target.checked)}
                />
                Code actif
              </label>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-xl brand-primary-btn py-2.5 text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? (editingId ? "Mise a jour..." : "Ajout...") : editingId ? "Mettre a jour" : "Ajouter"}
                </button>
                <button
                  type="button"
                  onClick={closeFormModal}
                  disabled={saving}
                  className="cancel-default w-full rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {editingId ? "Annuler modification" : "Annuler"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
