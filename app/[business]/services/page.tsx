"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { usePermissionGuard } from "@/lib/usePermissionGuard";
import { formatMoney } from "@/lib/currency";
import {
  createService,
  createServiceBooking,
  deleteService,
  downloadServiceBookingPdf,
  listServiceBookings,
  listServices,
  updateService,
  updateServiceBookingStatus,
  BOOKING_STATUS_LABELS,
  SERVICE_CATEGORY_LABELS,
  type BookingStatus,
  type CreateBookingInput,
  type Service,
  type ServiceBooking,
  type ServiceCategory,
} from "@/lib/servicesApi";
import {
  CheckCircle2,
  Clock,
  Pencil,
  Plus,
  Printer,
  RefreshCcw,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from "lucide-react";

const CATEGORIES = Object.keys(SERVICE_CATEGORY_LABELS) as ServiceCategory[];
const PAYMENT_METHODS = ["cash", "card", "mobile_money", "bank_transfer"];
const PAYMENT_LABELS: Record<string, string> = {
  cash: "Especes", card: "Carte", mobile_money: "Mobile money", bank_transfer: "Virement",
};

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-violet-50 text-violet-700 border-violet-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",
};

function err(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Une erreur est survenue.";
}

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Tab = "catalog" | "bookings";

export default function ServicesPage() {
  const { allowed, loading: permLoading } = usePermissionGuard("services.read");
  const params = useParams<{ business: string }>();
  const business = params?.business ?? "";

  const [tab, setTab] = useState<Tab>("bookings");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ── Catalog ──────────────────────────────────────────────────────────────
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [editService, setEditService] = useState<Service | null>(null);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [svcName, setSvcName] = useState("");
  const [svcDesc, setSvcDesc] = useState("");
  const [svcCategory, setSvcCategory] = useState<ServiceCategory>("other");
  const [svcPrice, setSvcPrice] = useState("");
  const [svcCurrency, setSvcCurrency] = useState("HTG");
  const [svcDuration, setSvcDuration] = useState("");
  const [savingSvc, setSavingSvc] = useState(false);

  const loadServices = useCallback(async () => {
    if (!business) return;
    setLoadingServices(true);
    try {
      setServices(await listServices(business));
    } catch (e) {
      setError(err(e));
    } finally {
      setLoadingServices(false);
    }
  }, [business]);

  useEffect(() => { void loadServices(); }, [loadServices]);

  function openCreateService() {
    setEditService(null);
    setSvcName(""); setSvcDesc(""); setSvcCategory("other");
    setSvcPrice(""); setSvcCurrency("HTG"); setSvcDuration("");
    setIsServiceModalOpen(true);
  }

  function openEditService(svc: Service) {
    setEditService(svc);
    setSvcName(svc.name); setSvcDesc(svc.description ?? "");
    setSvcCategory(svc.category); setSvcPrice(String(svc.price));
    setSvcCurrency(svc.currency); setSvcDuration(svc.durationMinutes ? String(svc.durationMinutes) : "");
    setIsServiceModalOpen(true);
  }

  async function handleSaveService(e: FormEvent) {
    e.preventDefault();
    if (!svcName.trim()) { setError("Nom requis."); return; }
    setSavingSvc(true); setError(""); setSuccess("");
    try {
      const input = {
        name: svcName.trim(),
        description: svcDesc.trim() || undefined,
        category: svcCategory,
        price: svcPrice ? Number(svcPrice) : 0,
        currency: svcCurrency,
        durationMinutes: svcDuration ? Number(svcDuration) : null,
      };
      if (editService) {
        await updateService(business, editService.id, input);
        setSuccess("Service modifie.");
      } else {
        await createService(business, input);
        setSuccess("Service cree.");
      }
      setIsServiceModalOpen(false);
      await loadServices();
    } catch (e) { setError(err(e)); } finally { setSavingSvc(false); }
  }

  async function handleDeleteService(svc: Service) {
    if (!window.confirm(`Supprimer "${svc.name}" ?`)) return;
    setError(""); setSuccess("");
    try {
      await deleteService(business, svc.id);
      setSuccess("Service supprime.");
      await loadServices();
    } catch (e) { setError(err(e)); }
  }

  const groupedServices = useMemo(() => {
    const map = new Map<string, Service[]>();
    services.forEach((s) => {
      const k = s.category;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [services]);

  // ── Bookings ─────────────────────────────────────────────────────────────
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [refreshingBookings, setRefreshingBookings] = useState(false);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "">("");
  const [dateFilter, setDateFilter] = useState(getTodayString());

  const loadBookings = useCallback(async (silent = false) => {
    if (!business) return;
    if (silent) setRefreshingBookings(true);
    else setLoadingBookings(true);
    try {
      const result = await listServiceBookings(business, { page, status: statusFilter, date: dateFilter, perPage: 25 });
      setBookings(result.items);
      setLastPage(result.lastPage);
      setTotal(result.total);
    } catch (e) {
      setError(err(e));
    } finally {
      if (silent) setRefreshingBookings(false);
      else setLoadingBookings(false);
    }
  }, [business, page, statusFilter, dateFilter]);

  useEffect(() => { if (tab === "bookings") void loadBookings(); }, [loadBookings, tab]);

  // New booking modal
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bkServiceId, setBkServiceId] = useState<number | "">("");
  const [bkGuestName, setBkGuestName] = useState("");
  const [bkQty, setBkQty] = useState("1");
  const [bkPrice, setBkPrice] = useState("");
  const [bkCurrency, setBkCurrency] = useState("HTG");
  const [bkPayment, setBkPayment] = useState("cash");
  const [bkScheduled, setBkScheduled] = useState("");
  const [bkNote, setBkNote] = useState("");
  const [savingBk, setSavingBk] = useState(false);

  const selectedService = useMemo(
    () => services.find((s) => s.id === bkServiceId) ?? null,
    [services, bkServiceId]
  );

  function openNewBooking() {
    setBkServiceId(""); setBkGuestName(""); setBkQty("1"); setBkPrice("");
    setBkCurrency("HTG"); setBkPayment("cash"); setBkScheduled(""); setBkNote("");
    setIsBookingModalOpen(true);
  }

  async function handleCreateBooking(e: FormEvent) {
    e.preventDefault();
    if (!bkServiceId) { setError("Choisissez un service."); return; }
    setSavingBk(true); setError(""); setSuccess("");
    try {
      const input: CreateBookingInput = {
        serviceId: Number(bkServiceId),
        guestName: bkGuestName.trim() || undefined,
        quantity: Math.max(1, Number(bkQty || 1)),
        unitPrice: bkPrice ? Number(bkPrice) : undefined,
        currency: bkCurrency,
        paymentMethod: bkPayment || undefined,
        scheduledAt: bkScheduled || undefined,
        note: bkNote.trim() || undefined,
      };
      await createServiceBooking(business, input);
      setIsBookingModalOpen(false);
      setSuccess("Reservation enregistree.");
      await loadBookings();
    } catch (e) { setError(err(e)); } finally { setSavingBk(false); }
  }

  // Status actions
  const [actionBooking, setActionBooking] = useState<{ booking: ServiceBooking; target: BookingStatus } | null>(null);
  const [actionPayment, setActionPayment] = useState("");
  const [actioning, setActioning] = useState(false);

  async function handleStatusAction() {
    if (!actionBooking) return;
    if (actionBooking.target === "completed" && !actionPayment) {
      setError("Mode de paiement obligatoire pour l'ecriture comptable.");
      return;
    }
    setActioning(true); setError(""); setSuccess("");
    try {
      await updateServiceBookingStatus(business, actionBooking.booking.id, {
        status: actionBooking.target,
        paymentMethod: actionBooking.target === "completed" ? actionPayment : undefined,
      });
      setActionBooking(null);
      setSuccess("Statut mis a jour.");
      await loadBookings(true);
    } catch (e) { setError(err(e)); } finally { setActioning(false); }
  }

  async function handlePrintBooking(booking: ServiceBooking) {
    try {
      const blob = await downloadServiceBookingPdf(business, booking.id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch { /* silently ignore */ }
  }

  if (permLoading || !allowed) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl border border-violet-200 bg-gradient-to-r from-violet-700 via-purple-600 to-pink-500 p-5 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-100">
              <Sparkles className="h-3.5 w-3.5" /> Services
            </div>
            <h1 className="mt-3 text-2xl font-semibold">Gestion des services</h1>
            <p className="mt-1 text-sm text-slate-200">Spa, massage, room service, transport et plus.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={openNewBooking}
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20">
              <Plus className="h-4 w-4" /> Nouvelle reservation
            </button>
            <button type="button" onClick={openCreateService}
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20">
              <Plus className="h-4 w-4" /> Ajouter un service
            </button>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 w-fit">
        {(["bookings", "catalog"] as Tab[]).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            {t === "bookings" ? `Reservations (${total})` : `Catalogue (${services.length})`}
          </button>
        ))}
      </div>

      {/* CATALOG TAB */}
      {tab === "catalog" && (
        <div className="space-y-4">
          {loadingServices ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Chargement...</div>
          ) : groupedServices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              Aucun service. Cliquez sur &quot;Ajouter un service&quot;.
            </div>
          ) : groupedServices.map(([cat, svcs]) => (
            <div key={cat} className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                {SERVICE_CATEGORY_LABELS[cat as ServiceCategory] ?? cat}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {svcs.map((svc) => (
                  <div key={svc.id} className="flex items-start justify-between rounded-xl border border-slate-200 p-3">
                    <div>
                      <p className="font-semibold text-slate-800">{svc.name}</p>
                      {svc.description ? <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{svc.description}</p> : null}
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <span className="text-sm font-bold text-slate-900">{formatMoney(svc.price, svc.currency)}</span>
                        {svc.durationMinutes ? (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <Clock className="h-3 w-3" /> {svc.durationMinutes} min
                          </span>
                        ) : null}
                        {!svc.isActive ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Inactif</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="ml-2 flex shrink-0 gap-1">
                      <button type="button" onClick={() => openEditService(svc)}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => void handleDeleteService(svc)}
                        className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* BOOKINGS TAB */}
      {tab === "bookings" && (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as BookingStatus | ""); setPage(1); }}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="">Tous les statuts</option>
              {(Object.keys(BOOKING_STATUS_LABELS) as BookingStatus[]).map((s) => (
                <option key={s} value={s}>{BOOKING_STATUS_LABELS[s]}</option>
              ))}
            </select>
            <input type="date" value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            <button type="button" onClick={() => setDateFilter("")}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
              Toutes les dates
            </button>
            <button type="button" onClick={() => void loadBookings(true)} disabled={refreshingBookings}
              className="ml-auto inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60">
              <RefreshCcw className={`h-4 w-4 ${refreshingBookings ? "animate-spin" : ""}`} />
            </button>
          </div>

          {loadingBookings ? (
            <div className="p-8 text-center text-sm text-slate-500">Chargement...</div>
          ) : bookings.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">Aucune reservation.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Ref</th>
                    <th className="px-4 py-3">Service</th>
                    <th className="px-4 py-3">Client / Invite</th>
                    <th className="px-4 py-3">Qte</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3">Programme</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((bk) => (
                    <tr key={bk.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{bk.invoiceNumber}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {bk.service?.name ?? "—"}
                        {bk.service?.category ? (
                          <span className="ml-1 text-xs text-slate-500">
                            ({SERVICE_CATEGORY_LABELS[bk.service.category]})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{bk.customer?.name || bk.guestName || "—"}</td>
                      <td className="px-4 py-3 text-center text-slate-700">{bk.quantity}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatMoney(bk.total, bk.currency)}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {bk.scheduledAt ? new Date(bk.scheduledAt).toLocaleString("fr-FR") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[bk.status]}`}>
                          {BOOKING_STATUS_LABELS[bk.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {bk.status === "pending" && (
                            <button type="button"
                              onClick={() => { setActionBooking({ booking: bk, target: "confirmed" }); setActionPayment("cash"); }}
                              className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50">
                              Confirmer
                            </button>
                          )}
                          {(bk.status === "confirmed" || bk.status === "in_progress") && (
                            <button type="button"
                              onClick={() => { setActionBooking({ booking: bk, target: "completed" }); setActionPayment(""); }}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50">
                              <CheckCircle2 className="h-3 w-3" /> Terminer
                            </button>
                          )}
                          {bk.status !== "completed" && bk.status !== "cancelled" && (
                            <button type="button"
                              onClick={() => { setActionBooking({ booking: bk, target: "cancelled" }); }}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50">
                              <XCircle className="h-3 w-3" />
                            </button>
                          )}
                          <button type="button" onClick={() => handlePrintBooking(bk)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">
                            <Printer className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {lastPage > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40">
                Precedent
              </button>
              <span className="text-xs text-slate-500">Page {page} / {lastPage}</span>
              <button type="button" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40">
                Suivant
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal: service form */}
      {isServiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <h2 className="text-lg font-bold text-slate-900">{editService ? "Modifier le service" : "Nouveau service"}</h2>
              <button type="button" onClick={() => setIsServiceModalOpen(false)}
                className="rounded-lg border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveService} className="space-y-4 p-5">
              <label className="block space-y-1 text-sm">
                <span className="font-semibold text-slate-700">Nom du service *</span>
                <input value={svcName} onChange={(e) => setSvcName(e.target.value)} required
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Categorie</span>
                  <select value={svcCategory} onChange={(e) => setSvcCategory(e.target.value as ServiceCategory)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    {CATEGORIES.map((c) => <option key={c} value={c}>{SERVICE_CATEGORY_LABELS[c]}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Duree (min)</span>
                  <input type="number" min="1" value={svcDuration} onChange={(e) => setSvcDuration(e.target.value)}
                    placeholder="60"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="space-y-1 text-sm sm:col-span-2">
                  <span className="font-semibold text-slate-700">Prix</span>
                  <input type="number" min="0" step="0.01" value={svcPrice} onChange={(e) => setSvcPrice(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Devise</span>
                  <select value={svcCurrency} onChange={(e) => setSvcCurrency(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    <option value="HTG">HTG</option>
                    <option value="USD">USD</option>
                  </select>
                </label>
              </div>
              <label className="block space-y-1 text-sm">
                <span className="font-semibold text-slate-700">Description (optionnel)</span>
                <textarea value={svcDesc} onChange={(e) => setSvcDesc(e.target.value)} rows={2}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              </label>
              {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button type="button" onClick={() => setIsServiceModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Annuler
                </button>
                <button type="submit" disabled={savingSvc}
                  className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60">
                  {savingSvc ? "Enregistrement..." : editService ? "Modifier" : "Creer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: new booking */}
      {isBookingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <h2 className="text-lg font-bold text-slate-900">Nouvelle reservation</h2>
              <button type="button" onClick={() => setIsBookingModalOpen(false)}
                className="rounded-lg border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateBooking} className="space-y-4 p-5">
              <label className="block space-y-1 text-sm">
                <span className="font-semibold text-slate-700">Service *</span>
                <select value={bkServiceId} onChange={(e) => {
                  const id = Number(e.target.value);
                  setBkServiceId(id || "");
                  const svc = services.find((s) => s.id === id);
                  if (svc) { setBkPrice(String(svc.price)); setBkCurrency(svc.currency); }
                }}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Choisir un service...</option>
                  {services.filter((s) => s.isActive).map((s) => (
                    <option key={s.id} value={s.id}>
                      {SERVICE_CATEGORY_LABELS[s.category]} — {s.name} ({formatMoney(s.price, s.currency)})
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Nom du client / invite</span>
                  <input value={bkGuestName} onChange={(e) => setBkGuestName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Quantite</span>
                  <input type="number" min="1" value={bkQty} onChange={(e) => setBkQty(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="space-y-1 text-sm sm:col-span-2">
                  <span className="font-semibold text-slate-700">Prix unitaire</span>
                  <input type="number" min="0" step="0.01" value={bkPrice} onChange={(e) => setBkPrice(e.target.value)}
                    placeholder={selectedService ? String(selectedService.price) : "0"}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Devise</span>
                  <select value={bkCurrency} onChange={(e) => setBkCurrency(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    <option value="HTG">HTG</option>
                    <option value="USD">USD</option>
                  </select>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Paiement</span>
                  <select value={bkPayment} onChange={(e) => setBkPayment(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    {PAYMENT_METHODS.map((pm) => <option key={pm} value={pm}>{PAYMENT_LABELS[pm]}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Date/heure programmee</span>
                  <input type="datetime-local" value={bkScheduled} onChange={(e) => setBkScheduled(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                </label>
              </div>
              <label className="block space-y-1 text-sm">
                <span className="font-semibold text-slate-700">Note</span>
                <input value={bkNote} onChange={(e) => setBkNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              </label>
              {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button type="button" onClick={() => setIsBookingModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Annuler
                </button>
                <button type="submit" disabled={savingBk}
                  className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60">
                  {savingBk ? "Enregistrement..." : "Reserver"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: status action */}
      {actionBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              {actionBooking.target === "completed" ? "Terminer le service" :
               actionBooking.target === "confirmed" ? "Confirmer la reservation" :
               "Annuler la reservation"}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Service : <strong>{actionBooking.booking.service?.name ?? "—"}</strong><br />
              Ref : {actionBooking.booking.invoiceNumber}
            </p>
            {actionBooking.target === "completed" && (
              <label className="mt-3 block space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Mode de paiement <span className="text-red-500">*</span>
                </span>
                <select value={actionPayment} onChange={(e) => setActionPayment(e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2 text-sm ${!actionPayment ? "border-red-400 bg-red-50" : "border-slate-300"}`}>
                  <option value="" disabled>-- Choisir --</option>
                  {PAYMENT_METHODS.map((pm) => <option key={pm} value={pm}>{PAYMENT_LABELS[pm]}</option>)}
                </select>
                {!actionPayment && (
                  <p className="text-xs text-red-500">Obligatoire pour l&apos;ecriture comptable.</p>
                )}
              </label>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setActionBooking(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Retour
              </button>
              <button type="button" onClick={handleStatusAction} disabled={actioning}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${actionBooking.target === "cancelled" ? "bg-red-600 hover:bg-red-700" : "bg-purple-600 hover:bg-purple-700"}`}>
                {actioning ? "..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
