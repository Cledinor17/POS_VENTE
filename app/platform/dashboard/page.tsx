"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, ArrowLeft, Building2, CheckCircle2, ChevronLeft, ChevronRight,
  CirclePause, Clock3, LogOut, RefreshCw, Search, ShieldAlert, ShieldCheck, Users,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { logout } from "@/lib/authApi";
import { getErrorMessage } from "@/lib/errors";
import {
  changePlatformBusinessStatus, getPlatformBusiness, getPlatformSummary,
  listPlatformBusinessEvents, listPlatformBusinesses, patchPlatformBusiness,
  type PlatformBusiness, type PlatformBusinessPatch, type PlatformEvent,
  type PlatformSummary,
} from "@/lib/platformApi";

type StatusFilter = "" | "active" | "suspended";
type ControlOperation = "suspend" | "reactivate";
const MODULES = [
  ["has_hotel", "Hôtel"], ["has_restaurant", "Restaurant"], ["has_pool", "Piscine"],
  ["has_services", "Services"], ["has_moment", "Séjours courts"],
] as const;
const BUSINESS_TYPES = [
  "retail", "hotel", "restaurant", "bar_cafe", "hardware_store", "pharmacy",
  "supermarket", "salon_beauty", "garage", "real_estate", "clinic",
  "school", "fashion", "electronics", "professional_services", "other",
];

function editable(business: PlatformBusiness): PlatformBusinessPatch {
  return {
    name: business.name,
    legal_name: business.legal_name || "",
    email: business.email || "",
    phone: business.phone || "",
    website: business.website || "",
    timezone: business.timezone || "America/Port-au-Prince",
    business_type: business.business_type || "other",
    has_hotel: business.has_hotel,
    has_restaurant: business.has_restaurant,
    has_pool: business.has_pool,
    has_services: business.has_services,
    has_moment: business.has_moment,
  };
}

function formattedDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("fr-FR");
}

function Status({ status }: { status: string }) {
  return status === "active"
    ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800"><CheckCircle2 className="h-3.5 w-3.5" /> Actif</span>
    : <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800"><CirclePause className="h-3.5 w-3.5" /> Suspendu</span>;
}

export default function PlatformDashboard() {
  const router = useRouter();
  const { user, loading: authLoading, clear } = useAuth();
  const permitted = user?.is_platform_admin === true && Boolean(user?.email_verified_at);

  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [businesses, setBusinesses] = useState<PlatformBusiness[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [reload, setReload] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [selected, setSelected] = useState<PlatformBusiness | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [events, setEvents] = useState<PlatformEvent[]>([]);
  const [form, setForm] = useState<PlatformBusinessPatch>({});
  const [editOpen, setEditOpen] = useState(false);
  const [operation, setOperation] = useState<ControlOperation | null>(null);
  const [reason, setReason] = useState("");
  const [confirmSlug, setConfirmSlug] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionInfo, setActionInfo] = useState("");

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=%2Fplatform%2Fdashboard");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!permitted) return;
    let active = true;
    Promise.all([getPlatformSummary(), listPlatformBusinesses({ search, status: statusFilter, page })])
      .then(([stats, list]) => {
        if (!active) return;
        setSummary(stats);
        setBusinesses(list.data);
        setTotal(list.meta.total);
        setLastPage(Math.max(1, list.meta.last_page));
        setListError("");
      })
      .catch((error: unknown) => { if (active) setListError(getErrorMessage(error, "Impossible de charger les entreprises.")); })
      .finally(() => { if (active) setListLoading(false); });
    return () => { active = false; };
  }, [permitted, search, statusFilter, page, reload]);

  const openBusiness = useCallback(async (business: PlatformBusiness) => {
    setSelected(business);
    setForm(editable(business));
    setEditOpen(false);
    setActionError("");
    setActionInfo("");
    setDetailLoading(true);
    try {
      const [fresh, audit] = await Promise.all([
        getPlatformBusiness(business.id), listPlatformBusinessEvents(business.id),
      ]);
      setSelected(fresh);
      setForm(editable(fresh));
      setEvents(audit.data);
    } catch (error: unknown) {
      setActionError(getErrorMessage(error, "Impossible de charger les détails."));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  async function refreshSelected(id: number) {
    const [fresh, history] = await Promise.all([getPlatformBusiness(id), listPlatformBusinessEvents(id)]);
    setSelected(fresh);
    setForm(editable(fresh));
    setEvents(history.data);
    setListLoading(true);
    setReload(value => value + 1);
  }

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchDraft.trim());
    setListLoading(true);
    setReload(value => value + 1);
  }

  async function saveBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || saving) return;
    setSaving(true);
    setActionError("");
    setActionInfo("");
    try {
      await patchPlatformBusiness(selected.id, form);
      await refreshSelected(selected.id);
      setEditOpen(false);
      setActionInfo("Les paramètres administratifs ont été enregistrés.");
    } catch (error: unknown) {
      setActionError(getErrorMessage(error, "La mise à jour a échoué."));
    } finally {
      setSaving(false);
    }
  }

  async function applyOperation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !operation || saving || confirmSlug !== selected.slug || !currentPassword || reason.trim().length < (operation === "suspend" ? 10 : 5)) return;
    setSaving(true);
    setActionError("");
    setActionInfo("");
    try {
      await changePlatformBusinessStatus(selected.id, operation, reason.trim(), currentPassword);
      await refreshSelected(selected.id);
      setActionInfo(operation === "suspend" ? "L'entreprise est suspendue. L'API refuse maintenant ses opérations." : "L'entreprise est de nouveau active.");
      setOperation(null);
      setReason("");
      setConfirmSlug("");
      setCurrentPassword("");
    } catch (error: unknown) {
      setActionError(getErrorMessage(error, "L'opération a échoué."));
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    try { await logout(); } catch { /* Local sign-out remains possible. */ }
    clear();
    router.replace("/login");
  }

  if (authLoading || !user) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">Vérification de la session…</div>;
  }

  if (!permitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <section className="w-full max-w-lg rounded-3xl border border-rose-100 bg-white p-8 text-center shadow-sm">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-rose-600" />
          <h1 className="text-2xl font-bold text-slate-900">Accès réservé</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">Seul un compte administrateur NovaGest vérifié peut accéder à cette interface. Le rôle propriétaire d’une entreprise ne donne pas cet accès.</p>
          <Link href="/" className="mt-6 inline-flex rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white">Retour à l’accueil</Link>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#0a4d8f] p-2.5 text-white"><ShieldCheck className="h-6 w-6" /></div>
            <div><h1 className="text-lg font-bold">NovaGest · Super Admin</h1><p className="text-xs text-slate-500">Administration de la plateforme</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden max-w-48 truncate text-xs text-slate-600 sm:block">{user.email}</span>
            <Link href="/" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /> Accueil</Link>
            <button type="button" onClick={() => { setListLoading(true); setReload(n => n + 1); }} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"><RefreshCw className="h-4 w-4" /> Actualiser</button>
            <button type="button" onClick={() => void signOut()} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"><LogOut className="h-4 w-4" /> Déconnexion</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1480px] space-y-6 px-4 py-7 sm:px-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Vue globale des entreprises</h2>
          <p className="mt-1 text-sm text-slate-500">Contrôle administratif sans accès automatique aux données confidentielles de chaque caisse.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            { label: "Entreprises", value: summary?.total, icon: Building2 },
            { label: "Actives", value: summary?.active, icon: CheckCircle2 },
            { label: "Suspendues", value: summary?.suspended, icon: CirclePause },
            { label: "Créées ce mois", value: summary?.new_this_month, icon: Clock3 },
            { label: "Accès employés actifs", value: summary?.active_memberships, icon: Users },
          ].map(stat => (
            <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <stat.icon className="mb-3 h-5 w-5 text-[#0a4d8f]" />
              <p className="text-xs text-slate-500">{stat.label}</p>
              <p className="mt-1 text-2xl font-bold">{stat.value === undefined ? "—" : stat.value.toLocaleString("fr-FR")}</p>
            </div>
          ))}
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(365px,0.85fr)]">
          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="space-y-3 border-b border-slate-100 p-4 sm:p-5">
              <h3 className="font-bold">Entreprises enregistrées <span className="text-sm font-normal text-slate-500">({total})</span></h3>
              <form onSubmit={applySearch} className="flex flex-wrap gap-2">
                <label className="flex min-w-[180px] flex-1 items-center gap-2 rounded-lg border border-slate-300 px-3">
                  <Search className="h-4 w-4 shrink-0 text-slate-400" />
                  <input aria-label="Rechercher une entreprise" value={searchDraft} onChange={event => setSearchDraft(event.target.value)} placeholder="Nom, slug ou e-mail" className="min-w-0 flex-1 py-2.5 text-sm outline-none" />
                </label>
                <select aria-label="Filtrer par statut" value={statusFilter} onChange={event => { setStatusFilter(event.target.value as StatusFilter); setPage(1); setListLoading(true); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                  <option value="">Tous les statuts</option><option value="active">Actives</option><option value="suspended">Suspendues</option>
                </select>
                <button type="submit" className="rounded-lg bg-[#0a4d8f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#083a6d]">Rechercher</button>
              </form>
              {listError && <div role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{listError}</div>}
            </div>
            <div className="divide-y divide-slate-100">
              {listLoading ? <p className="p-8 text-center text-sm text-slate-500">Chargement…</p>
                : businesses.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Aucune entreprise trouvée.</p>
                : businesses.map(business => (
                  <button type="button" onClick={() => void openBusiness(business)} key={business.id}
                    className={`flex w-full flex-wrap items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-blue-50 sm:px-5 ${selected?.id === business.id ? "bg-blue-50" : ""}`}>
                    <div className="min-w-0">
                      <strong className="block truncate text-sm">{business.name}</strong>
                      <span className="text-xs text-slate-500">{business.slug} · {business.owners.map(owner => owner.name).join(", ") || "Propriétaire non défini"}</span>
                      <span className="mt-1 block text-xs text-slate-400">{business.users_count} utilisateur(s) · {business.branches_count} succursale(s)</span>
                    </div>
                    <Status status={business.status} />
                  </button>
                ))}
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
              <span>Page {page} sur {lastPage}</span>
              <div className="flex gap-2">
                <button type="button" aria-label="Page précédente" disabled={page <= 1} onClick={() => {setPage(p=>p-1);setListLoading(true);}} className="rounded-lg border px-3 py-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                <button type="button" aria-label="Page suivante" disabled={page >= lastPage} onClick={() => {setPage(p=>p+1);setListLoading(true);}} className="rounded-lg border px-3 py-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          </section>

          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            {!selected ? (
              <div className="py-24 text-center text-slate-500"><Building2 className="mx-auto mb-4 h-10 w-10 text-slate-300" /><p>Sélectionnez une entreprise pour voir ses paramètres et son historique.</p></div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><span className="text-xs font-semibold uppercase tracking-wide text-[#0a4d8f]">Fiche entreprise #{selected.id}</span><h3 className="mt-1 text-xl font-bold">{selected.name}</h3><span className="text-xs text-slate-500">{selected.slug}</span></div>
                  <Status status={selected.status} />
                </div>
                {detailLoading && <p className="text-xs text-slate-500">Actualisation…</p>}
                {actionError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{actionError}</p>}
                {actionInfo && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{actionInfo}</p>}
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-xs text-slate-500">Propriétaire(s)</dt><dd className="break-words font-semibold">{selected.owners.map(o=>o.name).join(", ") || "—"}</dd></div>
                  <div><dt className="text-xs text-slate-500">Création</dt><dd>{formattedDate(selected.created_at)}</dd></div>
                  <div><dt className="text-xs text-slate-500">Utilisateurs</dt><dd className="font-semibold">{selected.users_count}</dd></div>
                  <div><dt className="text-xs text-slate-500">Succursales</dt><dd className="font-semibold">{selected.branches_count}</dd></div>
                  <div className="col-span-2"><dt className="text-xs text-slate-500">E-mail entreprise</dt><dd className="break-all">{selected.email || "—"}</dd></div>
                </dl>
                {selected.status === "suspended" && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
                    <strong>Entreprise suspendue depuis {formattedDate(selected.suspended_at)}</strong>
                    <p className="mt-1 whitespace-pre-line">{selected.suspension_reason || "Raison non précisée"}</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => {setEditOpen(value=>!value);setOperation(null);setActionError("");}} className="rounded-lg border border-[#0a4d8f] px-4 py-2 text-sm font-semibold text-[#0a4d8f] hover:bg-blue-50">Modifier les paramètres</button>
                  <button type="button" onClick={() => {setOperation(selected.status==="active"?"suspend":"reactivate");setEditOpen(false);setReason("");setConfirmSlug("");setCurrentPassword("");setActionError("");}}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${selected.status === "active" ? "bg-rose-700 hover:bg-rose-800" : "bg-emerald-700 hover:bg-emerald-800"}`}>
                    {selected.status === "active" ? "Suspendre" : "Réactiver"}
                  </button>
                </div>

                {editOpen && (
                  <form onSubmit={event => void saveBusiness(event)} className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                    <h4 className="font-semibold">Paramètres administratifs</h4>
                    {([
                      ["name", "Nom commercial"], ["legal_name", "Raison sociale"],
                      ["email", "E-mail"], ["phone", "Téléphone"], ["website", "Site web"],
                      ["timezone", "Fuseau horaire"],
                    ] as const).map(([key,label])=>(
                      <label key={key} className="block text-xs font-medium text-slate-700">{label}
                        <input value={String(form[key] ?? "")} required={key === "name" || key === "timezone"} onChange={e=>setForm(prev=>({...prev,[key]:e.target.value}))}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
                      </label>
                    ))}
                    <label className="block text-xs font-medium">Type de business
                      <select value={form.business_type || "other"} onChange={e=>setForm(prev=>({...prev,business_type:e.target.value}))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm">
                        {BUSINESS_TYPES.map(type=><option key={type} value={type}>{type.replaceAll("_"," ")}</option>)}
                      </select>
                    </label>
                    <fieldset className="space-y-2"><legend className="text-xs font-semibold">Modules autorisés</legend>
                      <div className="grid grid-cols-2 gap-2">{MODULES.map(([key,label])=>(
                        <label key={key} className="flex items-center gap-2 text-xs">
                          <input type="checkbox" checked={form[key] === true} onChange={e=>setForm(prev=>({...prev,[key]:e.target.checked}))} />{label}
                        </label>
                      ))}</div>
                    </fieldset>
                    <p className="text-xs leading-5 text-slate-500">Identifiant (slug), propriétaire, prix, caisse et données financières ne sont pas modifiables ici.</p>
                    <div className="flex gap-2">
                      <button type="submit" disabled={saving} className="rounded-lg bg-[#0a4d8f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving?"Enregistrement…":"Enregistrer"}</button>
                      <button type="button" onClick={()=>{setEditOpen(false);setForm(editable(selected));}} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Annuler</button>
                    </div>
                  </form>
                )}

                {operation && (
                  <form onSubmit={event=>void applyOperation(event)} className={`space-y-3 rounded-xl border p-4 ${operation === "suspend" ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"}`}>
                    <h4 className="font-bold">{operation==="suspend"?"Confirmer la suspension":"Confirmer la réactivation"}</h4>
                    <p className="text-xs leading-5 text-slate-700">{operation==="suspend"
                      ? "La suspension bloque immédiatement les requêtes API de cette entreprise, sans supprimer ses données."
                      : "La réactivation redonne accès au business et à ses opérations existantes."}</p>
                    <label className="block text-xs font-medium">Motif obligatoire
                      <textarea value={reason} onChange={e=>setReason(e.target.value)} minLength={operation === "suspend" ? 10 : 5} maxLength={500} required rows={3} placeholder="Expliquez la décision"
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm" />
                    </label>
                    <label className="block text-xs font-medium">Saisissez <strong>{selected.slug}</strong> pour confirmer
                      <input value={confirmSlug} onChange={e=>setConfirmSlug(e.target.value)} autoComplete="off" required
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm" />
                    </label>
                    <label className="block text-xs font-medium">Votre mot de passe administrateur
                      <input type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} autoComplete="current-password" required
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm" />
                    </label>
                    <div className="flex gap-2">
                      <button type="submit" disabled={saving || confirmSlug !== selected.slug || !currentPassword || reason.trim().length < (operation==="suspend"?10:5)}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${operation==="suspend"?"bg-rose-700":"bg-emerald-700"}`}>
                        {saving?"Traitement…":operation==="suspend"?"Suspendre le business":"Réactiver le business"}
                      </button>
                      <button type="button" onClick={()=>{setOperation(null);setCurrentPassword("");}} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm">Annuler</button>
                    </div>
                  </form>
                )}

                <div className="border-t border-slate-200 pt-5">
                  <h4 className="mb-3 flex items-center gap-2 font-semibold"><Activity className="h-4 w-4 text-[#0a4d8f]" /> Historique des actions plateforme</h4>
                  <div className="max-h-80 space-y-3 overflow-y-auto">
                    {events.length===0 ? <p className="text-xs text-slate-500">Aucune action enregistrée.</p> :
                      events.map(event=>(
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3" key={event.id}>
                          <div className="flex justify-between gap-2 text-xs"><strong className="capitalize">{event.action === "active" ? "Réactivation" : event.action === "suspended" ? "Suspension" : "Modification"}</strong><time className="text-slate-500">{formattedDate(event.created_at)}</time></div>
                          <p className="mt-1 break-words text-xs text-slate-600">{event.actor_name || event.actor_email || "Administrateur"}</p>
                          {event.reason && <p className="mt-1 whitespace-pre-line text-xs">{event.reason}</p>}
                        </div>
                      ))
                    }
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
