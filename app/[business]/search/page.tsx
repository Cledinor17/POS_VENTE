"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";

type SearchGroup = { label: string; items: Array<{ id: string; title: string; detail: string; href: string }> };
function SearchResults() {
  const { business } = useParams<{ business: string }>();
  const q = useSearchParams().get("q")?.trim() ?? "";
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setGroups([]); setError("");
      if (q.length < 2) { setLoading(false); return; }
      setLoading(true);
      void apiFetch<{ groups: SearchGroup[] }>(`/api/app/${encodeURIComponent(business)}/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((result) => setGroups(result.groups))
        .catch((error) => { if (!controller.signal.aborted) setError(getErrorMessage(error, "Une erreur est survenue.")); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [business, q]);
  return <div className="space-y-5">
    <div className="rounded-2xl bg-slate-900 p-6 text-white"><h1 className="text-2xl font-bold">Recherche globale</h1><p className="mt-2 text-slate-200">{q ? `Résultats pour « ${q} »` : "Recherchez un produit, un client, une facture ou un devis."}</p></div>
    <form className="flex gap-2"><input name="q" defaultValue={q} key={q} minLength={2} maxLength={100} aria-label="Recherche globale" placeholder="Nom, référence, téléphone…" className="min-w-0 flex-1 rounded-xl border bg-white p-3" /><button className="rounded-xl bg-indigo-600 px-5 text-white">Rechercher</button></form>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-800">{error}</p>}
    {loading ? <p>Recherche en cours…</p> : q.length < 2 ? <p>Saisissez au moins deux caractères.</p> : !error && groups.every((group) => !group.items.length) ? <p>Aucun résultat dans les données auxquelles vous avez accès.</p> : null}
    <div className="grid gap-4 lg:grid-cols-2">{groups.filter((group) => group.items.length > 0).map((group) => <section key={group.label} className="rounded-2xl border bg-white p-5"><h2 className="mb-3 text-lg font-semibold">{group.label}</h2><ul className="divide-y">{group.items.map((item) => <li key={item.id}><Link href={item.href} className="block rounded-lg p-3 hover:bg-indigo-50"><p className="font-semibold text-indigo-800">{item.title}</p><p className="text-sm text-slate-600">{item.detail}</p></Link></li>)}</ul>{group.items.length === 10 && <p className="mt-3 text-xs text-slate-500">10 premiers résultats. Précisez votre recherche pour affiner.</p>}</section>)}</div>
  </div>;
}
export default function SearchPage() { return <Suspense fallback={<p>Chargement…</p>}><SearchResults /></Suspense>; }
