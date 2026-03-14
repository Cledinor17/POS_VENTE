"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  createHotelAmenity,
  deleteHotelAmenity,
  getHotelAmenities,
  type HotelAmenity,
} from "@/lib/hotelApi";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

export default function HotelAmenitiesPage() {
  const params = useParams<{ business: string }>();
  const business = params?.business ?? "";

  const [amenities, setAmenities] = useState<HotelAmenity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [description, setDescription] = useState("");

  async function loadAmenities() {
    if (!business) return;
    setLoading(true);
    setError("");
    try {
      const data = await getHotelAmenities(business);
      setAmenities(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAmenities();
  }, [business]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!business) return;
    if (name.trim().length < 2) {
      setError("Nom accessoire obligatoire (min 2 caracteres).");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await createHotelAmenity(business, {
        name: name.trim(),
        icon: icon.trim(),
        description: description.trim(),
      });
      setName("");
      setIcon("");
      setDescription("");
      setSuccess("Accessoire ajoute.");
      await loadAmenities();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(amenityId: number) {
    if (!business) return;
    if (!window.confirm("Supprimer cet accessoire ?")) return;
    setError("");
    setSuccess("");
    try {
      await deleteHotelAmenity(business, amenityId);
      setSuccess("Accessoire supprime.");
      await loadAmenities();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Hotel - Accessoires</h1>
            <p className="mt-1 text-sm text-slate-600">Services/equipements associes aux chambres.</p>
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
        <h2 className="text-lg font-bold text-slate-900">Nouvel accessoire</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Nom</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
              placeholder="Wi-Fi, Piscine..."
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Icone (texte)</span>
            <input
              value={icon}
              onChange={(event) => setIcon(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
              placeholder="wifi"
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
          {saving ? "Enregistrement..." : "Ajouter accessoire"}
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
        <h2 className="text-lg font-bold text-slate-900">Liste accessoires</h2>
        {loading ? (
          <div className="mt-4 text-sm text-slate-600">Chargement...</div>
        ) : amenities.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
            Aucun accessoire enregistre.
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {amenities.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-base font-bold text-slate-900">{item.name}</div>
                  {item.icon ? (
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
                      {item.icon}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-xs text-slate-500">{item.rooms_count} chambre(s)</div>
                {item.description ? (
                  <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleDelete(item.id)}
                  className="mt-3 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
