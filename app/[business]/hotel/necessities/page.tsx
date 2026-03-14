"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  createHotelNecessity,
  deleteHotelNecessity,
  getHotelNecessities,
  type HotelNecessity,
} from "@/lib/hotelApi";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

export default function HotelNecessitiesPage() {
  const params = useParams<{ business: string }>();
  const business = params?.business ?? "";

  const [necessities, setNecessities] = useState<HotelNecessity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [description, setDescription] = useState("");
  const [stockQuantity, setStockQuantity] = useState("0");
  const [reorderLevel, setReorderLevel] = useState("0");

  async function loadNecessities() {
    if (!business) return;
    setLoading(true);
    setError("");
    try {
      const data = await getHotelNecessities(business);
      setNecessities(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNecessities();
  }, [business]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!business) return;
    if (name.trim().length < 2) {
      setError("Nom necessaire obligatoire (min 2 caracteres).");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await createHotelNecessity(business, {
        name: name.trim(),
        unit: unit.trim(),
        description: description.trim(),
        stockQuantity: Number(stockQuantity || 0),
        reorderLevel: Number(reorderLevel || 0),
      });
      setName("");
      setUnit("");
      setDescription("");
      setStockQuantity("0");
      setReorderLevel("0");
      setSuccess("Necessaire ajoute.");
      await loadNecessities();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(necessityId: number) {
    if (!business) return;
    if (!window.confirm("Supprimer ce necessaire ?")) return;
    setError("");
    setSuccess("");
    try {
      await deleteHotelNecessity(business, necessityId);
      setSuccess("Necessaire supprime.");
      await loadNecessities();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Hotel • Necessaires</h1>
            <p className="mt-1 text-sm text-slate-600">Stock interne des necessaires pour les chambres.</p>
          </div>
          <Link
            href={business ? `/${business}/hotel` : "/"}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Retour module hotel
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Nouveau necessaire</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Nom</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
              placeholder="Serviette, savon..."
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Unite</span>
            <input
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
              placeholder="piece"
            />
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Stock actuel</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={stockQuantity}
              onChange={(event) => setStockQuantity(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Seuil alerte</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={reorderLevel}
              onChange={(event) => setReorderLevel(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
            />
          </label>
        </div>
        <label className="space-y-1 text-sm block">
          <span className="font-semibold text-slate-700">Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-[#0d63b8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a4d8f] disabled:opacity-60"
        >
          {saving ? "Enregistrement..." : "Ajouter necessaire"}
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
        <h2 className="text-lg font-bold text-slate-900">Liste necessaires</h2>
        {loading ? (
          <div className="mt-4 text-sm text-slate-600">Chargement...</div>
        ) : necessities.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
            Aucun necessaire enregistre.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2 pr-3">Nom</th>
                  <th className="py-2 pr-3">Unite</th>
                  <th className="py-2 pr-3">Stock</th>
                  <th className="py-2 pr-3">Seuil</th>
                  <th className="py-2 pr-3">Chambres</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {necessities.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="py-2 pr-3 font-semibold text-slate-800">{item.name}</td>
                    <td className="py-2 pr-3 text-slate-600">{item.unit || "-"}</td>
                    <td className="py-2 pr-3 text-slate-700">{item.stock_quantity.toFixed(2)}</td>
                    <td className="py-2 pr-3 text-slate-700">{item.reorder_level.toFixed(2)}</td>
                    <td className="py-2 pr-3 text-slate-600">{item.rooms_count}</td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => void handleDelete(item.id)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
