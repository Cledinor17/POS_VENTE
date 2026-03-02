"use client";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toast";
import {
  createCategory,
  deleteCategory,
  getCategories,
  getProducts,
  updateCategory,
  type CatalogCategory,
  type CatalogProduct,
} from "@/lib/catalogApi";
function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}
export default function CategoriesPage() {
  const params = useParams<{ business: string }>();
  const business = params?.business ?? "";
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string>("");
  const [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    async function loadCategories() {
      if (!business) return;
      setLoading(true);
      setError("");
      try {
        const [categoryItems, productItems] = await Promise.all([
          getCategories(business),
          getProducts(business),
        ]);
        if (!mounted) return;
        setCategories(categoryItems);
        setProducts(productItems);
      } catch (e) {
        if (mounted) {
          const message = getErrorMessage(e);
          setError(message);
          toastError(message);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadCategories();
    return () => {
      mounted = false;
    };
  }, [business]);
  const categoriesWithCounts = useMemo(() => {
    const byCategoryId = new Map<string, number>();
    const byCategoryName = new Map<string, number>();
    for (const product of products) {
      if (product.categoryId !== null && product.categoryId !== undefined) {
        const key = String(product.categoryId);
        byCategoryId.set(key, (byCategoryId.get(key) ?? 0) + 1);
      }
      const nameKey = product.category.trim().toLowerCase();
      if (nameKey) {
        byCategoryName.set(nameKey, (byCategoryName.get(nameKey) ?? 0) + 1);
      }
    }
    return categories.map((category) => {
      const idCount = byCategoryId.get(String(category.id)) ?? 0;
      const nameCount =
        byCategoryName.get(category.name.trim().toLowerCase()) ?? 0;
      const computedCount = Math.max(idCount, nameCount);
      return { ...category, productsCount: computedCount };
    });
  }, [categories, products]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (normalized.length === 0) return categoriesWithCounts;
    return categoriesWithCounts.filter(
      (item) =>
        item.name.toLowerCase().includes(normalized) ||
        item.description.toLowerCase().includes(normalized),
    );
  }, [categoriesWithCounts, query]);
  async function refreshCategories() {
    if (!business) return;
    const [categoryItems, productItems] = await Promise.all([
      getCategories(business),
      getProducts(business),
    ]);
    setCategories(categoryItems);
    setProducts(productItems);
  }
  async function handleCreateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!business) return;
    if (!name.trim()) {
      const message = "Le nom de la categorie est obligatoire.";
      setError(message);
      toastError(message);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createCategory(business, {
        name: name.trim(),
        description: description.trim(),
        isActive: true,
      });
      await refreshCategories();
      setName("");
      setDescription("");
      toastSuccess("Categorie ajoutee avec succes.");
    } catch (e) {
      const message = getErrorMessage(e);
      setError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  }
  async function toggleActive(item: CatalogCategory) {
    if (!business) return;
    const id = String(item.id);
    setBusyId(id);
    setError("");
    try {
      const updated = await updateCategory(business, item.id, {
        isActive: !item.active,
      });
      setCategories((prev) =>
        prev.map((category) =>
          String(category.id) === id ? updated : category,
        ),
      );
      toastSuccess(
        updated.active
          ? `Categorie activee: ${updated.name}.`
          : `Categorie desactivee: ${updated.name}.`,
      );
    } catch (e) {
      const message = getErrorMessage(e);
      setError(message);
      toastError(message);
    } finally {
      setBusyId("");
    }
  }
  async function handleDelete(item: CatalogCategory) {
    if (!business) return;
    const confirmed = window.confirm(`Supprimer la categorie "${item.name}" ?`);
    if (!confirmed) return;
    const id = String(item.id);
    setBusyId(id);
    setError("");
    try {
      await deleteCategory(business, item.id);
      setCategories((prev) =>
        prev.filter((category) => String(category.id) !== id),
      );
      toastSuccess(`Categorie supprimee: ${item.name}.`);
    } catch (e) {
      const message = getErrorMessage(e);
      setError(message);
      toastError(message);
    } finally {
      setBusyId("");
    }
  }
  async function handleRename(item: CatalogCategory) {
    if (!business) return;
    const nextName = window.prompt("Nouveau nom de la categorie", item.name);
    if (!nextName) return;
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === item.name) return;
    const id = String(item.id);
    setBusyId(id);
    setError("");
    try {
      const updated = await updateCategory(business, item.id, {
        name: trimmed,
      });
      setCategories((prev) =>
        prev.map((category) =>
          String(category.id) === id ? updated : category,
        ),
      );
      toastSuccess(`Categorie renommee: ${updated.name}.`);
    } catch (e) {
      const message = getErrorMessage(e);
      setError(message);
      toastError(message);
    } finally {
      setBusyId("");
    }
  }
  return (
    <div className="space-y-6">
      {" "}
      <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        {" "}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {" "}
          <div>
            {" "}
            <h1 className="text-2xl font-bold text-slate-900">
              Categories produits
            </h1>{" "}
            <p className="text-slate-500 mt-1">
              Organise ton catalogue par familles de produits.
            </p>{" "}
          </div>{" "}
          <Link
            href={business ? `/${business}/products` : "/"}
            className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {" "}
            Retour aux produits{" "}
          </Link>{" "}
        </div>{" "}
      </section>{" "}
      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {" "}
          {error}{" "}
        </section>
      ) : null}{" "}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {" "}
        <form
          onSubmit={handleCreateCategory}
          className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4"
        >
          {" "}
          <h2 className="text-base font-bold text-slate-900">
            Nouvelle categorie
          </h2>{" "}
          <div>
            {" "}
            <label className="text-sm font-medium text-slate-700">
              Nom
            </label>{" "}
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex: Sauces"
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />{" "}
          </div>{" "}
          <div>
            {" "}
            <label className="text-sm font-medium text-slate-700">
              Description
            </label>{" "}
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              placeholder="Infos optionnelles"
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />{" "}
          </div>{" "}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl brand-primary-btn py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {" "}
            {saving ? "Ajout..." : "Ajouter la categorie"}{" "}
          </button>{" "}
        </form>{" "}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          {" "}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {" "}
            <h2 className="text-base font-bold text-slate-900">
              Liste des categories
            </h2>{" "}
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filtrer par nom ou description"
              className="w-full md:w-72 rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />{" "}
          </div>{" "}
          {loading ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              {" "}
              Chargement des categories...{" "}
            </div>
          ) : (
            <div className="space-y-3">
              {" "}
              {filtered.map((item) => (
                <article
                  key={String(item.id)}
                  className="rounded-xl border border-slate-200 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                >
                  {" "}
                  <div>
                    {" "}
                    <h3 className="font-semibold text-slate-800">
                      {item.name}
                    </h3>{" "}
                    <p className="text-sm text-slate-500">{item.description}</p>{" "}
                    <p className="text-xs text-slate-400 mt-1">
                      {item.productsCount} produits associes
                    </p>{" "}
                  </div>{" "}
                  <div className="flex items-center gap-2">
                    {" "}
                    <span
                      className={
                        item.active
                          ? "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                          : "inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                      }
                    >
                      {" "}
                      {item.active ? "Active" : "Inactive"}{" "}
                    </span>{" "}
                    <button
                      onClick={() => handleRename(item)}
                      disabled={busyId === String(item.id)}
                      title="Renommer la categorie"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {" "}
                      <Pencil className="h-4 w-4" />{" "}
                    </button>{" "}
                    <button
                      onClick={() => toggleActive(item)}
                      disabled={busyId === String(item.id)}
                      title={
                        item.active
                          ? "Desactiver la categorie"
                          : "Activer la categorie"
                      }
                      className={
                        item.active
                          ? "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                          : "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-400 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                      }
                    >
                      {" "}
                      {item.active ? (
                        <Power className="h-4 w-4" />
                      ) : (
                        <PowerOff className="h-4 w-4" />
                      )}{" "}
                    </button>{" "}
                    <button
                      onClick={() => handleDelete(item)}
                      disabled={busyId === String(item.id)}
                      title="Supprimer la categorie"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {" "}
                      <Trash2 className="h-4 w-4" />{" "}
                    </button>{" "}
                  </div>{" "}
                </article>
              ))}{" "}
              {filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  {" "}
                  Aucune categorie trouvee.{" "}
                </div>
              ) : null}{" "}
            </div>
          )}{" "}
        </div>{" "}
      </section>{" "}
    </div>
  );
}
