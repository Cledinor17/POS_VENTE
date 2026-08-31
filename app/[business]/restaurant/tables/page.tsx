"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  createRestaurantTable,
  deleteRestaurantTable,
  getRestaurantTables,
  updateRestaurantTable,
  type RestaurantTable,
  type RestaurantTableStatus,
} from "@/lib/restaurantApi";
import { Plus, Save, Trash2, UtensilsCrossed, X } from "lucide-react";

const STATUS_LABELS: Record<RestaurantTableStatus, string> = {
  available: "Disponible",
  occupied: "Occupee",
  reserved: "Reservee",
  cleaning: "Nettoyage",
};

const STATUS_COLORS: Record<RestaurantTableStatus, string> = {
  available: "bg-emerald-50 text-emerald-700 border-emerald-200",
  occupied: "bg-blue-50 text-blue-700 border-blue-200",
  reserved: "bg-amber-50 text-amber-700 border-amber-200",
  cleaning: "bg-orange-50 text-orange-700 border-orange-200",
};

const SECTIONS = ["salle", "terrasse", "bar", "prive", "vip"];

function err(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Une erreur est survenue.";
}

type DraftStatus = Record<number, RestaurantTableStatus>;

export default function RestaurantTablesPage() {
  const params = useParams<{ business: string }>();
  const business = params?.business ?? "";

  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [draftStatus, setDraftStatus] = useState<DraftStatus>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [capacity, setCapacity] = useState("4");
  const [section, setSection] = useState("");
  const [floor, setFloor] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!business) return;
    setLoading(true);
    setError("");
    try {
      const data = await getRestaurantTables(business);
      setTables(data);
      setDraftStatus((prev) => {
        const next: DraftStatus = {};
        data.forEach((t) => { next[t.id] = prev[t.id] ?? t.status; });
        return next;
      });
    } catch (e) {
      setError(err(e));
    } finally {
      setLoading(false);
    }
  }, [business]);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => {
    const counts = { available: 0, occupied: 0, reserved: 0, cleaning: 0 };
    tables.forEach((t) => { counts[t.status] = (counts[t.status] ?? 0) + 1; });
    return counts;
  }, [tables]);

  function resetForm() {
    setName(""); setNumber(""); setCapacity("4"); setSection(""); setFloor("");
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !number.trim()) { setError("Nom et numero sont obligatoires."); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      await createRestaurantTable(business, {
        name: name.trim(), number: number.trim(),
        capacity: Number(capacity || 4),
        section: section.trim() || null,
        floor: floor.trim() || null,
      });
      resetForm(); setIsModalOpen(false); setSuccess("Table ajoutee.");
      await load();
    } catch (e) { setError(err(e)); } finally { setSaving(false); }
  }

  async function handleStatusSave(table: RestaurantTable) {
    const next = draftStatus[table.id];
    if (!next || next === table.status) return;
    setSavingId(table.id); setError(""); setSuccess("");
    try {
      await updateRestaurantTable(business, table.id, { status: next });
      setSuccess("Statut mis a jour.");
      await load();
    } catch (e) { setError(err(e)); } finally { setSavingId(null); }
  }

  async function handleDelete(table: RestaurantTable) {
    if (!window.confirm(`Supprimer la table "${table.name}" ?`)) return;
    setError(""); setSuccess("");
    try {
      await deleteRestaurantTable(business, table.id);
      setSuccess("Table supprimee.");
      await load();
    } catch (e) { setError(err(e)); }
  }

  const sectionGroups = useMemo(() => {
    const map = new Map<string, RestaurantTable[]>();
    tables.forEach((t) => {
      const key = t.section || "Autres";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [tables]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 text-slate-900">
              <UtensilsCrossed className="h-6 w-6 text-[#0d63b8]" />
              <h1 className="text-2xl font-extrabold">Restaurant — Tables</h1>
            </div>
            <p className="mt-1 text-sm text-slate-600">Gestion des tables par section, statuts en temps reel.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { resetForm(); setIsModalOpen(true); }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0d63b8] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0a4d8f]"
            >
              <Plus className="h-4 w-4" /> Nouvelle table
            </button>
            <Link
              href={`/${business}/restaurant/orders`}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Commandes
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["available", "occupied", "reserved", "cleaning"] as RestaurantTableStatus[]).map((s) => (
            <div key={s} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">{STATUS_LABELS[s]}</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">{stats[s]}</p>
            </div>
          ))}
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

      {/* Tables par section */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Chargement...</div>
      ) : sectionGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Aucune table. Cliquez sur &quot;Nouvelle table&quot; pour commencer.
        </div>
      ) : (
        sectionGroups.map(([sec, sectionTables]) => (
          <div key={sec} className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">{sec}</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-2 pr-4">Table</th>
                    <th className="py-2 pr-4">Capacite</th>
                    <th className="py-2 pr-4">Etage</th>
                    <th className="py-2 pr-4">Statut actuel</th>
                    <th className="py-2 pr-4">Changer statut</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sectionTables.map((table) => (
                    <tr key={table.id} className="border-t border-slate-100">
                      <td className="py-2 pr-4 font-semibold text-slate-800">
                        {table.name}
                        <span className="ml-1 text-xs text-slate-500">#{table.number}</span>
                      </td>
                      <td className="py-2 pr-4 text-slate-700">{table.capacity} pers.</td>
                      <td className="py-2 pr-4 text-slate-700">{table.floor || "-"}</td>
                      <td className="py-2 pr-4">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[table.status]}`}>
                          {STATUS_LABELS[table.status]}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <select
                          value={draftStatus[table.id] ?? table.status}
                          onChange={(e) => setDraftStatus((prev) => ({ ...prev, [table.id]: e.target.value as RestaurantTableStatus }))}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                        >
                          {(["available", "occupied", "reserved", "cleaning"] as RestaurantTableStatus[]).map((s) => (
                            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => void handleStatusSave(table)}
                            disabled={savingId === table.id || draftStatus[table.id] === table.status}
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-40"
                          >
                            <Save className="h-3 w-3" />
                            {savingId === table.id ? "..." : "Sauver"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(table)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {/* Modal create */}
      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div className="inline-flex items-center gap-2 text-slate-900">
                <UtensilsCrossed className="h-5 w-5 text-[#0d63b8]" />
                <h2 className="text-lg font-bold">Nouvelle table</h2>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Nom</span>
                  <input value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Table VIP"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Numero</span>
                  <input value={number} onChange={(e) => setNumber(e.target.value)}
                    placeholder="01"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Capacite</span>
                  <input type="number" min="1" max="50" value={capacity} onChange={(e) => setCapacity(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Section</span>
                  <input list="sections-list" value={section} onChange={(e) => setSection(e.target.value)}
                    placeholder="salle, terrasse..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
                  <datalist id="sections-list">
                    {SECTIONS.map((s) => <option key={s} value={s} />)}
                  </datalist>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Etage</span>
                  <input value={floor} onChange={(e) => setFloor(e.target.value)}
                    placeholder="RDC"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
                </label>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Annuler
                </button>
                <button type="submit" disabled={saving}
                  className="rounded-xl bg-[#0d63b8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a4d8f] disabled:opacity-60">
                  {saving ? "Enregistrement..." : "Ajouter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
