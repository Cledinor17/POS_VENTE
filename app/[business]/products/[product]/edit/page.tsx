"use client";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toast";
import {
  DEFAULT_PRODUCT_AVATAR_PATH,
  resolveProductImageUrl,
} from "@/lib/productImage";
import {
  getCategories,
  getProduct,
  updateProduct,
  type CatalogCategory,
  type ProductStatus,
  type ProductType,
} from "@/lib/catalogApi";

type ProductFormState = {
  name: string;
  sku: string;
  categoryId: string;
  type: ProductType;
  barcode: string;
  price: string;
  cost: string;
  stock: string;
  reorderLevel: string;
  unit: string;
  taxRate: string;
  status: ProductStatus;
  active: boolean;
  description: string;
};
const initialFormState: ProductFormState = {
  name: "",
  sku: "",
  categoryId: "",
  type: "product",
  barcode: "",
  price: "",
  cost: "",
  stock: "0",
  reorderLevel: "0",
  unit: "piece",
  taxRate: "0",
  status: "active",
  active: true,
  description: "",
};
const unitOptions = ["piece", "box", "kg", "l"];
function isNumberLike(value: string) {
  if (value.trim().length === 0) return false;
  return !Number.isNaN(Number(value));
}
function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}
function validateForm(state: ProductFormState) {
  if (state.name.trim().length < 2)
    return "Le nom du produit est obligatoire (min 2 caracteres).";
  if (state.sku.trim().length < 2) return "Le SKU est obligatoire.";
  if (state.categoryId.trim().length === 0)
    return "La categorie est obligatoire.";
  if (state.type !== "product" && state.type !== "service")
    return "Le type doit etre produit ou service.";
  if (!isNumberLike(state.price) || Number(state.price) < 0)
    return "Le prix de vente est invalide.";
  if (!isNumberLike(state.cost) || Number(state.cost) < 0)
    return "Le cout d'achat est obligatoire et invalide.";
  if (!isNumberLike(state.stock) || Number(state.stock) < 0)
    return "Le stock est invalide.";
  if (!isNumberLike(state.reorderLevel) || Number(state.reorderLevel) < 0)
    return "Le seuil de stock est invalide.";
  if (!isNumberLike(state.taxRate) || Number(state.taxRate) < 0)
    return "La TVA est invalide.";
  return "";
}
export default function EditProductPage() {
  const router = useRouter();
  const params = useParams<{ business: string; product: string }>();
  const business = params?.business ?? "";
  const productId = params?.product ?? "";
  const [form, setForm] = useState<ProductFormState>(initialFormState);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [currentImagePath, setCurrentImagePath] = useState<string | null>(null);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const currentImageUrl = useMemo(
    () => resolveProductImageUrl(currentImagePath),
    [currentImagePath],
  );
  const displayedImageUrl =
    imagePreviewUrl ||
    (imageLoadFailed ? DEFAULT_PRODUCT_AVATAR_PATH : currentImageUrl);

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(imageFile);
    setImagePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  useEffect(() => {
    setImageLoadFailed(false);
  }, [currentImageUrl, imagePreviewUrl]);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      if (!business || !productId) return;
      setLoading(true);
      setError("");
      try {
        const [categoryItems, product] = await Promise.all([
          getCategories(business),
          getProduct(business, productId),
        ]);
        if (!mounted) return;
        setCategories(categoryItems);
        setCurrentImagePath(product.imagePath ?? null);
        setImageFile(null);
        setForm({
          name: product.name,
          sku: product.sku,
          categoryId:
            product.categoryId !== null && product.categoryId !== undefined
              ? String(product.categoryId)
              : categoryItems[0]
                ? String(categoryItems[0].id)
                : "",
          type: product.type,
          barcode: product.barcode,
          price: String(product.price),
          cost: String(product.cost),
          stock: String(product.stock),
          reorderLevel: String(product.reorderLevel),
          unit: product.unit || "piece",
          taxRate: String(product.taxRate),
          status: product.status,
          active: product.active,
          description: product.description,
        });
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
    void loadData();
    return () => {
      mounted = false;
    };
  }, [business, productId]);
  function setField<K extends keyof ProductFormState>(
    key: K,
    value: ProductFormState[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const validationMessage = validateForm(form);
    if (validationMessage) {
      setError(validationMessage);
      toastError(validationMessage);
      return;
    }
    setSaving(true);
    try {
      await updateProduct(business, productId, {
        name: form.name.trim(),
        sku: form.sku.trim().toUpperCase(),
        categoryId: form.categoryId,
        type: form.type,
        barcode: form.barcode.trim(),
        price: Number(form.price),
        cost: Number(form.cost),
        stock: Number(form.stock),
        reorderLevel: Number(form.reorderLevel),
        unit: form.unit,
        taxRate: Number(form.taxRate),
        status: form.status,
        active: form.active,
        isActive: form.active,
        description: form.description.trim(),
        imageFile,
      });
      toastSuccess("Produit modifie avec succes.");
      router.push(`/${business}/products`);
    } catch (e) {
      const message = getErrorMessage(e);
      setError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  }
  const isSubmitDisabled = useMemo(
    () => saving || loading || categories.length === 0,
    [saving, loading, categories.length],
  );
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
              Modifier produit
            </h1>{" "}
            <p className="text-slate-500 mt-1">
              Mets a jour les informations puis enregistre.
            </p>{" "}
          </div>{" "}
          <Link
            href={business ? `/${business}/products` : "/"}
            className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {" "}
            Retour catalogue{" "}
          </Link>{" "}
        </div>{" "}
      </section>{" "}
      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {" "}
          {error}{" "}
        </section>
      ) : null}{" "}
      <form
        onSubmit={onSubmit}
        className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5"
      >
        {" "}
        {loading ? (
          <div className="py-6 text-center text-slate-500">
            Chargement du produit...
          </div>
        ) : null}{" "}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {" "}
          <Field label="Nom produit *">
            {" "}
            <input
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />{" "}
          </Field>{" "}
          <Field label="SKU *">
            {" "}
            <input
              value={form.sku}
              onChange={(event) => setField("sku", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />{" "}
          </Field>{" "}
          <Field label="Categorie *">
            {" "}
            <select
              value={form.categoryId}
              onChange={(event) => setField("categoryId", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              {" "}
              {categories.map((item) => (
                <option key={String(item.id)} value={String(item.id)}>
                  {" "}
                  {item.name}{" "}
                </option>
              ))}{" "}
            </select>{" "}
          </Field>{" "}
          <Field label="Type">
            {" "}
            <select
              value={form.type}
              onChange={(event) =>
                setField("type", event.target.value as ProductType)
              }
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              {" "}
              <option value="product">Produit</option>{" "}
              <option value="service">Service</option>{" "}
            </select>{" "}
          </Field>{" "}
          <Field label="Prix vente *">
            {" "}
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(event) => setField("price", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />{" "}
          </Field>{" "}
          <Field label="Cout achat *">
            {" "}
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.cost}
              onChange={(event) => setField("cost", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />{" "}
          </Field>{" "}
          <Field label="Stock *">
            {" "}
            <input
              type="number"
              min="0"
              step="1"
              value={form.stock}
              onChange={(event) => setField("stock", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />{" "}
          </Field>{" "}
          <Field label="Seuil alerte *">
            {" "}
            <input
              type="number"
              min="0"
              step="1"
              value={form.reorderLevel}
              onChange={(event) => setField("reorderLevel", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />{" "}
          </Field>{" "}
          <Field label="Unite">
            {" "}
            <select
              value={form.unit}
              onChange={(event) => setField("unit", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              {" "}
              {unitOptions.map((item) => (
                <option key={item} value={item}>
                  {" "}
                  {item}{" "}
                </option>
              ))}{" "}
            </select>{" "}
          </Field>{" "}
          <Field label="TVA (%)">
            {" "}
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.taxRate}
              onChange={(event) => setField("taxRate", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />{" "}
          </Field>{" "}
          <Field label="Statut">
            {" "}
            <select
              value={form.status}
              onChange={(event) =>
                setField("status", event.target.value as ProductStatus)
              }
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              {" "}
              <option value="active">Actif</option>{" "}
              <option value="draft">Brouillon</option>{" "}
              <option value="archived">Archive</option>{" "}
            </select>{" "}
          </Field>{" "}
          <Field label="Active">
            {" "}
            <select
              value={form.active ? "1" : "0"}
              onChange={(event) =>
                setField("active", event.target.value === "1")
              }
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              {" "}
              <option value="1">Oui</option> <option value="0">Non</option>{" "}
            </select>{" "}
          </Field>{" "}
          <div className="md:col-span-2">
            {" "}
            <Field label="Code barres">
              {" "}
              <input
                value={form.barcode}
                onChange={(event) => setField("barcode", event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />{" "}
            </Field>{" "}
          </div>{" "}
          <div className="md:col-span-2">
            {" "}
            <Field label="Image produit (image_path)">
              {" "}
              <div className="space-y-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    setImageFile(event.target.files?.[0] ?? null)
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                    <img
                      src={displayedImageUrl || DEFAULT_PRODUCT_AVATAR_PATH}
                      alt="Apercu produit"
                      className="h-full w-full object-cover"
                      onError={() => setImageLoadFailed(true)}
                    />
                  </div>
                  <div className="text-xs text-slate-500">
                    {imageFile
                      ? `Nouveau fichier: ${imageFile.name}`
                      : currentImagePath
                        ? "Aucune nouvelle image choisie: l'image actuelle sera conservee."
                        : "Aucune image actuelle. Laisse vide pour garder le comportement actuel."}
                  </div>
                </div>
              </div>{" "}
            </Field>{" "}
          </div>{" "}
          <div className="md:col-span-2">
            {" "}
            <Field label="Description">
              {" "}
              <textarea
                rows={4}
                value={form.description}
                onChange={(event) =>
                  setField("description", event.target.value)
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />{" "}
            </Field>{" "}
          </div>{" "}
        </div>{" "}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {" "}
          <Link
            href={business ? `/${business}/products` : "/"}
            className="cancel-default inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {" "}
            Annuler{" "}
          </Link>{" "}
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="inline-flex items-center justify-center rounded-xl brand-primary-btn px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {" "}
            {saving ? "Mise a jour..." : "Enregistrer modifications"}{" "}
          </button>{" "}
        </div>{" "}
      </form>{" "}
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      {" "}
      <span className="text-sm font-medium text-slate-700">{label}</span>{" "}
      {children}{" "}
    </label>
  );
}
