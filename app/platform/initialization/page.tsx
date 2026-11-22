"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import BusinessCycleInitializer from "@/components/settings/BusinessCycleInitializer";
import {
  listPlatformBusinessesForCycle,
  type PlatformBusinessForCycle,
} from "@/lib/businessCycleApi";

export default function PlatformBusinessInitializationPage() {
  const { user, loading } = useAuth();
  const [businesses, setBusinesses] = useState<PlatformBusinessForCycle[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PlatformBusinessForCycle | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const search = useCallback(async () => {
    if (user?.is_platform_admin !== true) return;
    setBusy(true);
    setError("");
    try {
      setBusinesses(await listPlatformBusinessesForCycle(query));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de recherche des entreprises.");
    } finally {
      setBusy(false);
    }
  }, [user?.is_platform_admin, query]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void search(); }, 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  if (loading) return <main className="mx-auto max-w-5xl p-6">Chargement...</main>;
  if (!user || user.is_platform_admin !== true) {
    return <main className="mx-auto max-w-5xl p-6" role="alert">
      Accès réservé au super-administrateur de la plateforme.
    </main>;
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
      <header className="space-y-2">
        <Link className="text-sm text-blue-700 underline" href="/app">Retour aux entreprises</Link>
        <h1 className="text-2xl font-bold">Super Admin — Initialiser un business</h1>
        <p className="text-sm text-slate-600">
          Choisissez une entreprise. L'opération est autorisée par le serveur,
          crée une sauvegarde et conserve le catalogue ainsi que les documents archivés.
        </p>
      </header>
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <label className="block text-sm font-medium">
          Rechercher l'entreprise
          <input
            className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5"
            placeholder="Nom ou identifiant..."
            value={query} onChange={e => setQuery(e.target.value)}
          />
        </label>
        {busy ? <p className="mt-2 text-sm text-slate-500">Recherche...</p> : null}
        {error ? <p className="mt-2 text-sm text-rose-700" role="alert">{error}</p> : null}
        <div className="mt-3 max-h-60 space-y-1 overflow-y-auto">
          {businesses.map(item => (
            <button
              type="button" key={item.id}
              onClick={() => setSelected(item)}
              className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
            >
              <span className="font-semibold">{item.name}</span>
              <span className="ml-2 text-xs text-slate-500">{item.slug}</span>
            </button>
          ))}
        </div>
      </section>
      {selected ? (
        <BusinessCycleInitializer
          key={selected.id}
          business={selected.slug}
          platformBusinessId={selected.id}
        />
      ) : null}
    </main>
  );
}
