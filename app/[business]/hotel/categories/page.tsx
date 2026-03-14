"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  createHotelCategory,
  deleteHotelCategory,
  getHotelCategories,
  type HotelCategory,
} from "@/lib/hotelApi";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

function resolveImageUrl(category: HotelCategory): string {
  const absolute = (category.image_url || "").trim();
  if (absolute) return absolute;
  const path = (category.image_path || "").trim();
  if (!path) return "";
  const normalized = path.replace(/^\/+/, "");
  const relative = normalized.startsWith("storage/") ? normalized : `storage/${normalized}`;
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
  return base ? `${base}/${relative}` : `/${relative}`;
}

export default function HotelCategoriesPage() {
  const params = useParams<{ business: string }>();
  const business = params?.business ?? "";

  const [categories, setCategories] = useState<HotelCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  async function loadCategories() {
    if (!business) return;
    setLoading(true);
    setError("");
    try {
      const data = await getHotelCategories(business);
      setCategories(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCategories();
  }, [business]);

  const totalRooms = useMemo(
    () => categories.reduce((sum, category) => sum + (category.rooms_count || 0), 0),
    [categories]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!business) return;
    if (name.trim().length < 2) {
      setError("Nom categorie obligatoire (min 2 caracteres).");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await createHotelCategory(business, {
        name: name.trim(),
        description: description.trim(),
        imageFile,
      });
      setName("");
      setDescription("");
      setImageFile(null);
      setSuccess("Categorie chambre ajoutee.");
      await loadCategories();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(categoryId: number) {
    if (!business) return;
    if (!window.confirm("Supprimer cette categorie ?")) return;

    setError("");
    setSuccess("");
    try {
      await deleteHotelCategory(business, categoryId);
      setSuccess("Categorie supprimee.");
      await loadCategories();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Hotel • Categories chambres</h1>
            <p className="mt-1 text-sm text-slate-600">
              Ajoute des categories avec image (ex: Suite, Deluxe, Standard).
            </p>
          </div>
          <Link
            href={business ? `/${business}/hotel` : "/"}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Retour module hotel
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Categories</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">{categories.length}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chambres associees</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">{totalRooms}</div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Nouvelle categorie</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Nom</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
              placeholder="Suite Deluxe"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Image categorie</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>
        </div>
        <label className="space-y-1 text-sm block">
          <span className="font-semibold text-slate-700">Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
            rows={3}
            placeholder="Description de la categorie"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-[#0d63b8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a4d8f] disabled:opacity-60"
        >
          {saving ? "Enregistrement..." : "Ajouter categorie"}
        </button>
      </form>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold text-slate-900">Liste categories</h2>
        {loading ? (
          <div className="mt-4 text-sm text-slate-600">Chargement...</div>
        ) : categories.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
            Aucune categorie pour le moment.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {categories.map((category) => {
              const imageUrl = resolveImageUrl(category);
              return (
                <div key={category.id} className="rounded-xl border border-slate-200 p-3">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={`Categorie ${category.name}`}
                      className="h-40 w-full rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-40 w-full rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center text-sm">
                      Pas d'image
                    </div>
                  )}
                  <div className="mt-3">
                    <div className="text-base font-bold text-slate-900">{category.name}</div>
                    <div className="text-xs text-slate-500">{category.rooms_count} chambre(s)</div>
                    {category.description ? (
                      <p className="mt-2 text-sm text-slate-600">{category.description}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(category.id)}
                    className="mt-3 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Supprimer
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
