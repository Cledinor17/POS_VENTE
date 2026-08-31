"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { usePermissionGuard } from "@/lib/usePermissionGuard";
import { formatMoney } from "@/lib/currency";
import {
  cancelPoolTicket,
  createPoolTicket,
  listPoolTickets,
  POOL_TICKET_TYPE_LABELS,
  downloadPoolTicketPdf,
  recordPoolExit,
  type CreatePoolTicketInput,
  type PoolTicket,
  type PoolTicketStatus,
  type PoolTicketType,
} from "@/lib/poolApi";
import { useBusinessDefaults } from "@/lib/useBusinessDefaults";
import {
  Clock,
  DoorOpen,
  LogOut,
  Plus,
  Printer,
  RefreshCcw,
  Users,
  Wallet,
  Waves,
  X,
} from "lucide-react";

const STATUS_LABELS: Record<PoolTicketStatus, string> = {
  active: "En piscine",
  completed: "Sorti",
  cancelled: "Annule",
};
const STATUS_COLORS: Record<PoolTicketStatus, string> = {
  active: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",
};

const PAYMENT_METHODS = [
  { id: "cash", label: "Especes" },
  { id: "card", label: "Carte" },
  { id: "mobile_money", label: "Mobile money" },
  { id: "bank_transfer", label: "Virement" },
];

const TICKET_TYPES: PoolTicketType[] = ["day_pass", "hour_pass", "month_pass", "resident"];

function err(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Une erreur est survenue.";
}

function formatDt(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("fr-FR");
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return "-";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function getTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function PoolPage() {
  const { allowed, loading: permLoading } = usePermissionGuard("pool.read");
  const params = useParams<{ business: string }>();
  const business = params?.business ?? "";

  const [tickets, setTickets] = useState<PoolTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [todayActive, setTodayActive] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState<PoolTicketStatus | "">("");
  const [dateFilter, setDateFilter] = useState(getTodayString());

  const { currency: defaultCurrency } = useBusinessDefaults(business);

  // New ticket modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [ticketType, setTicketType] = useState<PoolTicketType>("day_pass");
  const [persons, setPersons] = useState("1");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);

  // Sync currency with business default once it loads (modal not open)
  useEffect(() => {
    if (!isModalOpen) setCurrency(defaultCurrency);
  }, [defaultCurrency, isModalOpen]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Exit confirm
  const [exitTicket, setExitTicket] = useState<PoolTicket | null>(null);
  const [cancelTicket, setCancelTicket] = useState<PoolTicket | null>(null);
  const [actioning, setActioning] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!business) return;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const result = await listPoolTickets(business, {
        page,
        perPage: 25,
        status: statusFilter,
        date: dateFilter,
      });
      setTickets(result.items);
      setLastPage(result.lastPage);
      setTotal(result.total);
      setTodayActive(result.todayActive);
      setTodayRevenue(result.todayRevenue);
    } catch (e) {
      setError(err(e));
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [business, page, statusFilter, dateFilter]);

  useEffect(() => { void load(); }, [load]);

  function resetForm() {
    setGuestName(""); setTicketType("day_pass"); setPersons("1");
    setPrice(""); setCurrency(defaultCurrency); setPaymentMethod(""); setNote("");
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!guestName.trim() && !price) { setError("Nom du visiteur ou prix requis."); return; }
    if (!paymentMethod) { setError("Mode de paiement obligatoire pour l'ecriture comptable."); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      const input: CreatePoolTicketInput = {
        guestName: guestName.trim() || undefined,
        ticketType,
        persons: Math.max(1, Number(persons || 1)),
        price: price ? Number(price) : 0,
        currency,
        paymentMethod,
        note: note.trim() || undefined,
      };
      await createPoolTicket(business, input);
      resetForm(); setIsModalOpen(false);
      setSuccess("Entree enregistree.");
      await load();
    } catch (e) { setError(err(e)); } finally { setSaving(false); }
  }

  async function handleExit() {
    if (!exitTicket) return;
    setActioning(true); setError(""); setSuccess("");
    try {
      await recordPoolExit(business, exitTicket.id);
      setExitTicket(null); setSuccess("Sortie enregistree.");
      await load();
    } catch (e) { setError(err(e)); } finally { setActioning(false); }
  }

  async function handleCancel() {
    if (!cancelTicket) return;
    setActioning(true); setError(""); setSuccess("");
    try {
      await cancelPoolTicket(business, cancelTicket.id);
      setCancelTicket(null); setSuccess("Ticket annule.");
      await load();
    } catch (e) { setError(err(e)); } finally { setActioning(false); }
  }

  async function handlePrintTicket(ticket: PoolTicket) {
    try {
      const blob = await downloadPoolTicketPdf(business, ticket.id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch { /* silently ignore */ }
  }

  const activeTickets = useMemo(() => tickets.filter((t) => t.status === "active"), [tickets]);

  if (permLoading || !allowed) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl border border-blue-200 bg-gradient-to-r from-[#0b4f88] via-[#0d63b8] to-[#06b6d4] p-5 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-100">
              <Waves className="h-3.5 w-3.5" /> Piscine
            </div>
            <h1 className="mt-3 text-2xl font-semibold">Gestion de la piscine</h1>
            <p className="mt-1 text-sm text-slate-200">Entrees, sorties, pass journee et abonnements.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { resetForm(); setIsModalOpen(true); }}
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20">
              <Plus className="h-4 w-4" /> Enregistrer une entree
            </button>
            <button type="button" onClick={() => void load(true)} disabled={loading || refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-60">
              <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Actualiser
            </button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="inline-flex rounded-xl bg-blue-50 p-2"><Users className="h-5 w-5 text-blue-700" /></span>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">En piscine maintenant</p>
              <p className="mt-1 text-2xl font-bold text-blue-700">{todayActive}</p>
            </div>
          </div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="inline-flex rounded-xl bg-emerald-50 p-2"><Wallet className="h-5 w-5 text-emerald-700" /></span>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Revenus aujourd&apos;hui</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700">{formatMoney(todayRevenue, defaultCurrency)}</p>
            </div>
          </div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="inline-flex rounded-xl bg-amber-50 p-2"><DoorOpen className="h-5 w-5 text-amber-700" /></span>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Entrees (filtre actuel)</p>
              <p className="mt-1 text-2xl font-bold text-amber-700">{total}</p>
            </div>
          </div>
        </article>
      </section>

      {/* Active entries highlight */}
      {activeTickets.length > 0 && (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-700">
            Visiteurs actuellement en piscine ({activeTickets.length})
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {activeTickets.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-xl border border-blue-200 bg-white p-3">
                <div>
                  <p className="font-semibold text-slate-800">{t.customerName || t.guestName || "Visiteur"}</p>
                  <p className="text-xs text-slate-500">
                    {POOL_TICKET_TYPE_LABELS[t.ticketType]} · {t.persons} pers. · Entree: {formatDt(t.entryAt)}
                  </p>
                </div>
                <button type="button" onClick={() => setExitTicket(t)}
                  className="ml-2 inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  <LogOut className="h-3 w-3" /> Sortie
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

      {/* List */}
      <div className="rounded-2xl border border-slate-200 bg-white">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as PoolTicketStatus | ""); setPage(1); }}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
            <option value="">Tous les statuts</option>
            {(["active", "completed", "cancelled"] as PoolTicketStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <input type="date" value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          <button type="button" onClick={() => setDateFilter("")}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Toutes les dates
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Chargement...</div>
        ) : tickets.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Aucune entree pour ce filtre.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Ticket</th>
                  <th className="px-4 py-3">Visiteur</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Pers.</th>
                  <th className="px-4 py-3">Entree</th>
                  <th className="px-4 py-3">Sortie</th>
                  <th className="px-4 py-3"><Clock className="h-3 w-3 inline" /> Duree</th>
                  <th className="px-4 py-3 text-right">Prix</th>
                  <th className="px-4 py-3">Paiement</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{ticket.ticketNumber}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {ticket.customerName || ticket.guestName || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{POOL_TICKET_TYPE_LABELS[ticket.ticketType]}</td>
                    <td className="px-4 py-3 text-center text-slate-700">{ticket.persons}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDt(ticket.entryAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{ticket.exitAt ? formatDt(ticket.exitAt) : "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDuration(ticket.durationMinutes)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {ticket.price > 0 ? formatMoney(ticket.price, ticket.currency) : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 capitalize">{ticket.paymentMethod?.replace("_", " ") || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[ticket.status]}`}>
                        {STATUS_LABELS[ticket.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {ticket.status === "active" && (
                          <button type="button" onClick={() => setExitTicket(ticket)}
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50">
                            <LogOut className="h-3 w-3" /> Sortie
                          </button>
                        )}
                        <button type="button" onClick={() => handlePrintTicket(ticket)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">
                          <Printer className="h-3 w-3" />
                        </button>
                        {ticket.status !== "cancelled" && (
                          <button type="button" onClick={() => setCancelTicket(ticket)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50">
                            <X className="h-3 w-3" />
                          </button>
                        )}
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

      {/* Modal: new entry */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div className="inline-flex items-center gap-2">
                <Waves className="h-5 w-5 text-[#0d63b8]" />
                <h2 className="text-lg font-bold text-slate-900">Enregistrer une entree</h2>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 p-5">
              <label className="space-y-1 text-sm block">
                <span className="font-semibold text-slate-700">Nom du visiteur</span>
                <input value={guestName} onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Jean Dupont"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Type de pass</span>
                  <select value={ticketType} onChange={(e) => setTicketType(e.target.value as PoolTicketType)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    {TICKET_TYPES.map((t) => (
                      <option key={t} value={t}>{POOL_TICKET_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Nombre de personnes</span>
                  <input type="number" min="1" max="20" value={persons} onChange={(e) => setPersons(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="space-y-1 text-sm sm:col-span-2">
                  <span className="font-semibold text-slate-700">Prix</span>
                  <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Devise</span>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    <option value="HTG">HTG</option>
                    <option value="USD">USD</option>
                  </select>
                </label>
              </div>

              <label className="space-y-1 text-sm block">
                <span className="font-semibold text-slate-700">
                  Mode de paiement <span className="text-red-500">*</span>
                </span>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2 text-sm ${!paymentMethod ? "border-red-400 bg-red-50" : "border-slate-300"}`}>
                  <option value="" disabled>-- Choisir --</option>
                  {PAYMENT_METHODS.map((pm) => (
                    <option key={pm.id} value={pm.id}>{pm.label}</option>
                  ))}
                </select>
                {!paymentMethod && (
                  <p className="text-xs text-red-500">Obligatoire pour l&apos;ecriture comptable.</p>
                )}
              </label>

              <label className="space-y-1 text-sm block">
                <span className="font-semibold text-slate-700">Note (optionnel)</span>
                <input value={note} onChange={(e) => setNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              </label>

              {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Annuler
                </button>
                <button type="submit" disabled={saving}
                  className="rounded-xl bg-[#0d63b8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a4d8f] disabled:opacity-60">
                  {saving ? "Enregistrement..." : "Enregistrer l'entree"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: confirm exit */}
      {exitTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Enregistrer la sortie</h3>
            <p className="mt-2 text-sm text-slate-600">
              Visiteur : <strong>{exitTicket.customerName || exitTicket.guestName || "Inconnu"}</strong><br />
              Entree : {formatDt(exitTicket.entryAt)}<br />
              Ticket : {exitTicket.ticketNumber}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setExitTicket(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Retour
              </button>
              <button type="button" onClick={handleExit} disabled={actioning}
                className="rounded-xl bg-[#0d63b8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a4d8f] disabled:opacity-60">
                {actioning ? "..." : "Confirmer la sortie"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: confirm cancel */}
      {cancelTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Annuler le ticket</h3>
            <p className="mt-2 text-sm text-slate-600">
              Ticket <strong>{cancelTicket.ticketNumber}</strong> — {cancelTicket.customerName || cancelTicket.guestName || "Visiteur"}<br />
              Cette action est irreversible.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setCancelTicket(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Retour
              </button>
              <button type="button" onClick={handleCancel} disabled={actioning}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {actioning ? "..." : "Annuler le ticket"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
