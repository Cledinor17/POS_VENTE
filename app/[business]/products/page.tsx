"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Ban, Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api";
import {
  DEFAULT_PRODUCT_AVATAR_PATH,
  resolveProductImageUrl,
} from "@/lib/productImage";
import {
  deleteProduct,
  getProduct,
  getProducts,
  updateProduct,
  type CatalogProduct,
  type ProductStatus,
  type UpdateProductInput,
} from "@/lib/catalogApi";
function statusClass(status: ProductStatus) {
  if (status === "active")
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "draft") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}
function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}
function toUpdatePayload(
  product: CatalogProduct,
  overrides: Partial<UpdateProductInput> = {},
): UpdateProductInput {
  return {
    name: product.name,
    sku: product.sku,
    categoryId: product.categoryId ?? undefined,
    type: product.type,
    barcode: product.barcode,
    price: product.price,
    cost: product.cost,
    stock: product.stock,
    reorderLevel: product.reorderLevel,
    unit: product.unit,
    taxRate: product.taxRate,
    status: product.status,
    description: product.description,
    active: product.active,
    isActive: product.active,
    ...overrides,
  };
}
export default function ProductsPage() {
  const params = useParams<{ business: string }>();
  const business = params?.business ?? "";
  const [allProducts, setAllProducts] = useState<CatalogProduct[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | ProductStatus>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string>("");
  const [updatingId, setUpdatingId] = useState<string>("");
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let mounted = true;
    async function loadProducts() {
      if (!business) return;
      setLoading(true);
      setError("");
      try {
        const items = await getProducts(business);
        if (mounted) setAllProducts(items);
      } catch (e) {
        if (mounted) setError(getErrorMessage(e));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadProducts();
    return () => {
      mounted = false;
    };
  }, [business]);
  async function onDelete(item: CatalogProduct) {
    if (!business) return;
    if (item.soldCount > 0) {
      setError(
        "Suppression interdite: ce produit a deja ete vendu au moins une fois.",
      );
      return;
    }
    const confirmed = window.confirm(`Supprimer le produit "${item.name}" ?`);
    if (!confirmed) return;
    const id = String(item.id);
    setDeletingId(id);
    setError("");
    try {
      await deleteProduct(business, item.id);
      setAllProducts((prev) =>
        prev.filter((product) => String(product.id) !== id),
      );
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setDeletingId("");
    }
  }
  async function onToggleActive(item: CatalogProduct) {
    if (!business) return;
    const id = String(item.id);
    setUpdatingId(id);
    setError("");
    try {
      const current = await getProduct(business, item.id);
      const nextActive = !current.active;
      const updated = await updateProduct(
        business,
        item.id,
        toUpdatePayload(current, {
          isActive: nextActive,
          active: nextActive,
          status: nextActive ? "active" : "archived",
        }),
      );
      setAllProducts((prev) =>
        prev.map((product) => (String(product.id) === id ? updated : product)),
      );
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setUpdatingId("");
    }
  }
  const products = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return allProducts.filter((item) => {
      const matchQuery =
        normalized.length === 0 ||
        item.name.toLowerCase().includes(normalized) ||
        item.sku.toLowerCase().includes(normalized) ||
        item.category.toLowerCase().includes(normalized);
      const matchStatus = status === "all" || item.status === status;
      return matchQuery && matchStatus;
    });
  }, [allProducts, query, status]);
  const lowStockCount = allProducts.filter(
    (item) => item.stock > 0 && item.stock <= 10,
  ).length;
  const outOfStockCount = allProducts.filter((item) => item.stock === 0).length;
  return (
    <div className="space-y-6">
      <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Catalogue produits
            </h1>
            <p className="text-slate-500 mt-1">
              Gere les references, prix et niveaux de stock.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={business ? `/${business}/categories` : "/"}
              className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Voir categories
            </Link>
            <Link
              href={business ? `/${business}/products/new` : "/"}
              className="inline-flex items-center rounded-xl brand-primary-btn px-4 py-2.5 text-sm font-semibold text-white "
            >
              Nouveau produit
            </Link>
          </div>
        </div>
      </section>
      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </section>
      ) : null}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Total produits"
          value={String(allProducts.length)}
          tone="text-indigo-700"
        />
        <StatCard
          label="Stock faible"
          value={String(lowStockCount)}
          tone="text-amber-700"
        />
        <StatCard
          label="Ruptures"
          value={String(outOfStockCount)}
          tone="text-rose-700"
        />
      </section>
      <section className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher par nom, SKU ou categorie"
            className="w-full md:flex-1 rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as "all" | ProductStatus)
            }
            className="w-full md:w-56 rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="draft">Brouillon</option>
            <option value="archived">Archive</option>
          </select>
        </div>
        {loading ? (
          <div className="py-8 text-center text-slate-500">
            Chargement des produits...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-3 pr-3 font-semibold">Produit</th>
                  <th className="py-3 pr-3 font-semibold">SKU</th>
                  <th className="py-3 pr-3 font-semibold">Categorie</th>
                  <th className="py-3 pr-3 font-semibold">Prix</th>
                  <th className="py-3 pr-3 font-semibold">Stock</th>
                  <th className="py-3 pr-3 font-semibold">Ventes</th>
                  <th className="py-3 pr-3 font-semibold">Statut</th>
                  <th className="py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((item) => {
                  const itemId = String(item.id);
                  const imageSrc = brokenImages[itemId]
                    ? DEFAULT_PRODUCT_AVATAR_PATH
                    : resolveProductImageUrl(item.imagePath);
                  return (
                    <tr key={itemId} className="border-b last:border-0">
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                            <img
                              src={imageSrc}
                              alt={item.name}
                              className="h-full w-full object-cover"
                              onError={() => {
                                setBrokenImages((prev) => ({
                                  ...prev,
                                  [itemId]: true,
                                }));
                              }}
                            />
                          </div>
                          <span className="font-semibold text-slate-800">
                            {item.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-slate-600">{item.sku}</td>
                      <td className="py-3 pr-3 text-slate-600">
                        {item.category}
                      </td>
                      <td className="py-3 pr-3 text-slate-700">
                        ${item.price.toFixed(2)}
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={
                            item.stock === 0
                              ? "font-semibold text-rose-600"
                              : item.stock <= 10
                                ? "font-semibold text-amber-700"
                                : "text-slate-700"
                          }
                        >
                          {item.stock}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-slate-700">
                        {item.soldCount}
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(item.status)}`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            href={
                              business
                                ? `/${business}/products/${itemId}/edit`
                                : "/"
                            }
                            title="Modifier le produit"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={() => onToggleActive(item)}
                            disabled={
                              updatingId === itemId || deletingId === itemId
                            }
                            title={
                              item.active
                                ? "Desactiver le produit"
                                : "Activer le produit"
                            }
                            className={
                              item.active
                                ? "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-60 disabled:cursor-not-allowed"
                                : "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-400 hover:bg-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
                            }
                          >
                            {item.active ? (
                              <Power className="h-4 w-4" />
                            ) : (
                              <PowerOff className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => onDelete(item)}
                            disabled={
                              deletingId === itemId ||
                              updatingId === itemId ||
                              item.soldCount > 0
                            }
                            title={
                              item.soldCount > 0
                                ? "Suppression impossible: produit deja vendu."
                                : "Supprimer le produit"
                            }
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {item.soldCount > 0 ? (
                              <Ban className="h-4 w-4" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      Aucun produit ne correspond a ta recherche.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}
