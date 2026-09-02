"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { type BranchItem, createBranch, listBranches, updateBranch } from "@/lib/branchesApi";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function BranchesPage() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";

  const [items, setItems] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [info, setInfo] = useState("");
  const [reloadSeq, setReloadSeq] = useState(0);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [editingIsMain, setEditingIsMain] = useState(false);
  const [copyCatalogue, setCopyCatalogue] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!businessSlug) return;
      setLoading(true);
      setPageError("");
      try {
        const res = await listBranches(businessSlug);
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
    setEditingIsMain(false);
    setName("");
    setSlug("");
    setSlugTouched(false);
    setCode("");
    setPhone("");
    setIsActive(true);
    setCopyCatalogue(true);
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

  function beginEdit(item: BranchItem) {
    setEditingId(item.id);
    setEditingIsMain(item.isMain);
    setName(item.name);
    setSlug(item.slug);
    setSlugTouched(true);
    setCode(item.code ?? "");
    setPhone(item.phone ?? "");
    setIsActive(item.isActive);
    setFormError("");
    setInfo("");
    setIsFormOpen(true);
  }

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessSlug) return;
    if (!name.trim()) {
      setFormError("Le nom de la succursale est obligatoire.");
      return;
    }
    const normalizedSlug = slugify(slug);
    if (!normalizedSlug) {
      setFormError("L'identifiant (slug) de la succursale est obligatoire.");
      return;
    }

    setSaving(true);
    setFormError("");
    setInfo("");
    try {
      const payload = {
        name: name.trim(),
        slug: normalizedSlug,
        code: code.trim() || null,
        phone: phone.trim() || null,
        isActive,
      };

      if (editingId) {
        const updated = await updateBranch(businessSlug, editingId, payload);
        setItems((prev) => prev.map((row) => (row.id === editingId ? updated : row)));
        setInfo("Succursale mise a jour.");
      } else {
        const mainBranchId = items.find((row) => row.isMain)?.id ?? null;
        await createBranch(businessSlug, {
          ...payload,
          copyProductsFromBranchId: copyCatalogue ? mainBranchId : null,
        });
        setInfo(
          copyCatalogue && mainBranchId
            ? "Succursale ajoutee avec le catalogue de la succursale principale."
            : "Succursale ajoutee.",
        );
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

  async function handleToggleActive(item: BranchItem) {
    if (!businessSlug || item.isMain) return;
    setPageError("");
    setInfo("");
    try {
      const updated = await updateBranch(businessSlug, item.id, { isActive: !item.isActive });
      setItems((prev) => prev.map((row) => (row.id === item.id ? updated : row)));
      setInfo(updated.isActive ? "Succursale activee." : "Succursale desactivee.");
    } catch (e) {
      setPageError(getErrorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Succursales</h1>
            <p className="text-slate-500 mt-1">
              Gere les points de vente ou entrepots de ce business. Le stock, la caisse et les
              ventes sont suivis separement pour chaque succursale.
            </p>
          </div>
          <div className="text-sm text-slate-600">{items.length} succursale(s)</div>
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
            Toute entreprise demarre avec une succursale &quot;Main&quot; qui ne peut pas etre
            desactivee. Ajoute-en d&apos;autres pour suivre plusieurs emplacements.
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-xl brand-primary-btn px-4 py-2.5 text-sm font-semibold text-white"
          >
            Nouvelle succursale
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-500">Chargement des succursales...</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-slate-500">Aucune succursale configuree.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-3 pr-3 font-semibold">Nom</th>
                  <th className="py-3 pr-3 font-semibold">Identifiant</th>
                  <th className="py-3 pr-3 font-semibold">Telephone</th>
                  <th className="py-3 pr-3 font-semibold">Statut</th>
                  <th className="py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-3 pr-3 font-semibold text-slate-800">
                      {item.name}
                      {item.isMain ? (
                        <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                          Principale
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3 text-slate-600">{item.slug}</td>
                    <td className="py-3 pr-3 text-slate-600">{item.phone ?? "-"}</td>
                    <td className="py-3 pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          item.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {item.isActive ? "Active" : "Inactive"}
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
                          onClick={() => handleToggleActive(item)}
                          disabled={item.isMain}
                          title={item.isMain ? "La succursale principale reste toujours active" : "Activer/Desactiver"}
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {item.isActive ? "Desactiver" : "Activer"}
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
                  {editingId ? "Modifier la succursale" : "Nouvelle succursale"}
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
              <input
                value={name}
                onChange={(event) => handleNameChange(event.target.value)}
                placeholder="Nom (ex: Boutique Delmas) *"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <input
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(event.target.value);
                }}
                placeholder="Identifiant (ex: delmas) *"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="Code (optionnel)"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Telephone (optionnel)"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={isActive}
                  disabled={editingIsMain}
                  onChange={(event) => setIsActive(event.target.checked)}
                />
                Succursale active
                {editingIsMain ? (
                  <span className="text-xs text-slate-400">(toujours active pour la succursale principale)</span>
                ) : null}
              </label>

              {!editingId ? (
                <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={copyCatalogue}
                    onChange={(event) => setCopyCatalogue(event.target.checked)}
                  />
                  <span>
                    Reprendre le catalogue de la succursale principale
                    <span className="mt-0.5 block text-xs text-slate-500">
                      Les memes produits seront vendus ici, avec un stock qui demarre a zero. Sans
                      cette option, la succursale demarre sans aucun produit.
                    </span>
                  </span>
                </label>
              ) : null}

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
