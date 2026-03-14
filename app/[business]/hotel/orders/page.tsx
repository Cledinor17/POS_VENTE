"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  listHotelOrders,
  updateHotelOrderStatus,
  type HotelOrder,
  type HotelOrderStatus,
} from "@/lib/hotelOrdersApi";
import { formatMoney } from "@/lib/currency";

type ConfirmState = {
  order: HotelOrder;
  action: "completed" | "cancelled";
} | null;

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("fr-FR");
}

function getStatusLabel(status: HotelOrderStatus): string {
  if (status === "pending") return "En attente";
  if (status === "on_hold") return "En pause";
  if (status === "completed") return "Confirmee";
  return "Annulee";
}

function getStatusClasses(status: HotelOrderStatus): string {
  if (status === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (status === "on_hold") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if (status === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function getOrderItemsSummary(order: HotelOrder): string {
  if (order.items.length === 0) return "Aucun article";
  const names = order.items
    .slice(0, 2)
    .map((item) => item.product?.name || "Article")
    .filter(Boolean);

  if (order.items.length <= 2) {
    return names.join(", ");
  }

  return `${names.join(", ")} +${order.items.length - 2}`;
}

export default function HotelOrdersPage() {
  const params = useParams<{ business: string }>();
  const business = params?.business ?? "";

  const [orders, setOrders] = useState<HotelOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningOrderId, setRunningOrderId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<HotelOrderStatus | "">("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "mobile" | "bank" | "other">("cash");

  async function loadOrders() {
    if (!business) return;
    setLoading(true);
    setError("");
    try {
      const data = await listHotelOrders(business, {
        page,
        perPage: 20,
        q: query || undefined,
        status: statusFilter || undefined,
      });
      setOrders(data.items);
      setLastPage(data.lastPage);
      setTotal(data.total);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrders();
  }, [business, page, query, statusFilter]);

  useEffect(() => {
    if (!confirmState) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setConfirmState(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [confirmState]);

  const pendingCount = useMemo(
    () => orders.filter((order) => order.status === "pending").length,
    [orders]
  );

  async function handleConfirmAction() {
    if (!business || !confirmState) return;
    setRunningOrderId(confirmState.order.id);
    setError("");
    setSuccess("");
    try {
      const next = await updateHotelOrderStatus(business, confirmState.order.id, {
        status: confirmState.action,
        paymentMethod:
          confirmState.action === "completed" && !confirmState.order.reservationId
            ? paymentMethod
            : undefined,
      });
      setOrders((prev) => prev.map((item) => (item.id === next.id ? next : item)));
      setSuccess(
        confirmState.action === "completed"
          ? confirmState.order.reservationId
            ? "Commande confirmee et ajoutee au folio."
            : "Commande confirmee par le caissier."
          : "Commande annulee."
      );
      setConfirmState(null);
      if (statusFilter && statusFilter !== next.status) {
        setStatusFilter("");
        setPage(1);
      } else {
        await loadOrders();
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setRunningOrderId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Commandes hotel</h1>
            <p className="mt-1 text-sm text-slate-600">
              Les commandes liees aux clients en sejour arrivent par defaut en attente de confirmation du caissier.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={business ? `/${business}/pos` : "/"}
              className="rounded-xl border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              Aller au POS
            </Link>
            <Link
              href={business ? `/${business}/hotel/reservations` : "/"}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Voir reservations
            </Link>
          </div>
        </div>
      </div>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </section>
      ) : null}

      {success ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Commandes trouvees</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{total}</div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">En attente de confirmation</div>
          <div className="mt-2 text-2xl font-bold text-amber-700">{pendingCount}</div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Page courante</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {page}/{Math.max(1, lastPage)}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Journal des commandes hotel</h2>
            <p className="mt-1 text-sm text-slate-500">
              Le caissier confirme ou annule les commandes apres verification avec le client.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Chambre, client, commande, note..."
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as HotelOrderStatus | "");
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="on_hold">En pause</option>
              <option value="completed">Confirmees</option>
              <option value="cancelled">Annulees</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setQuery(queryInput.trim());
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Filtrer
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-500">Chargement des commandes...</div>
        ) : orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
            Aucune commande hotel trouvee.
          </div>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {orders.map((order) => (
                <div key={order.id} className="rounded-2xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-slate-900">{order.invoiceNumber}</div>
                      <div className="text-xs text-slate-500">{formatDateTime(order.createdAt)}</div>
                    </div>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClasses(order.status)}`}
                    >
                      {getStatusLabel(order.status)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-slate-500">Client</div>
                      <div className="font-semibold text-slate-800">
                        {order.customer?.name || "Client de chambre"}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Chambre</div>
                      <div className="font-semibold text-slate-800">
                        {order.room?.name || "-"} #{order.room?.roomNumber || "-"}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-slate-500">Articles</div>
                      <div className="font-semibold text-slate-800">{getOrderItemsSummary(order)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Montant</div>
                      <div className="font-semibold text-slate-900">{formatMoney(order.totalAmount, order.currency)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Caissier</div>
                      <div className="font-semibold text-slate-800">{order.cashier?.name || "-"}</div>
                    </div>
                  </div>
                  {order.note ? <div className="text-xs text-slate-500">Note: {order.note}</div> : null}
                  <div className="flex flex-wrap gap-2">
                    {order.canConfirm ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentMethod("cash");
                          setConfirmState({ order, action: "completed" });
                        }}
                        disabled={runningOrderId === order.id}
                        className="rounded-xl border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                      >
                        Confirmer
                      </button>
                    ) : null}
                    {order.canCancel ? (
                      <button
                        type="button"
                        onClick={() => setConfirmState({ order, action: "cancelled" })}
                        disabled={runningOrderId === order.id}
                        className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                      >
                        Annuler
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1180px] text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-3 pr-3 font-semibold">Commande</th>
                    <th className="py-3 pr-3 font-semibold">Client</th>
                    <th className="py-3 pr-3 font-semibold">Chambre</th>
                    <th className="py-3 pr-3 font-semibold">Articles</th>
                    <th className="py-3 pr-3 font-semibold">Montant</th>
                    <th className="py-3 pr-3 font-semibold">Statut</th>
                    <th className="py-3 pr-3 font-semibold">Caissier</th>
                    <th className="py-3 pr-3 font-semibold">Date</th>
                    <th className="py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, index) => (
                    <tr
                      key={order.id}
                      className={index % 2 === 0 ? "border-b bg-white" : "border-b bg-slate-50/60"}
                    >
                      <td className="py-3 pr-3">
                        <div className="font-semibold text-slate-900">{order.invoiceNumber}</div>
                        {order.note ? <div className="text-xs text-slate-500">{order.note}</div> : null}
                      </td>
                      <td className="py-3 pr-3 text-slate-700">
                        <div className="font-semibold text-slate-800">{order.customer?.name || "Client de chambre"}</div>
                        <div className="text-xs text-slate-500">
                          {order.customer?.phone || order.customer?.email || "-"}
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-slate-700">
                        {order.room?.name || "-"} #{order.room?.roomNumber || "-"}
                      </td>
                      <td className="py-3 pr-3 text-slate-700">
                        <div className="font-semibold text-slate-800">{order.itemsCount} article(s)</div>
                        <div className="text-xs text-slate-500">{getOrderItemsSummary(order)}</div>
                      </td>
                      <td className="py-3 pr-3 font-semibold text-slate-900">{formatMoney(order.totalAmount, order.currency)}</td>
                      <td className="py-3 pr-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClasses(order.status)}`}
                        >
                          {getStatusLabel(order.status)}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-slate-700">{order.cashier?.name || "-"}</td>
                      <td className="py-3 pr-3 text-slate-600">{formatDateTime(order.createdAt)}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          {order.canConfirm ? (
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentMethod("cash");
                                setConfirmState({ order, action: "completed" });
                              }}
                              disabled={runningOrderId === order.id}
                              className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                            >
                              Confirmer
                            </button>
                          ) : null}
                          {order.canCancel ? (
                            <button
                              type="button"
                              onClick={() => setConfirmState({ order, action: "cancelled" })}
                              disabled={runningOrderId === order.id}
                              className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                            >
                              Annuler
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Page {page}/{Math.max(1, lastPage)}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || loading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Precedent
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(lastPage, prev + 1))}
              disabled={page >= lastPage || loading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Suivant
            </button>
          </div>
        </div>
      </section>

      {confirmState ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6"
          onClick={() => setConfirmState(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-100 bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-900">
                    {confirmState.action === "completed" ? "Confirmer la commande" : "Annuler la commande"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {confirmState.action === "completed"
                      ? confirmState.order.reservationId
                        ? "Valide avec le client. La commande sera ajoutee comme charge dans le folio de la reservation."
                        : "Valide avec le client avant de terminer la commande."
                      : "Cette commande ne sera plus payable apres annulation."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmState(null)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Fermer
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <div className="font-semibold text-slate-900">{confirmState.order.invoiceNumber}</div>
                <div className="mt-1">
                  Client: {confirmState.order.customer?.name || "Client de chambre"}
                </div>
                <div>
                  Chambre: {confirmState.order.room?.name || "-"} #{confirmState.order.room?.roomNumber || "-"}
                </div>
                <div>Montant: {formatMoney(confirmState.order.totalAmount, confirmState.order.currency)}</div>
              </div>

              {confirmState.action === "completed" && !confirmState.order.reservationId ? (
                <label className="space-y-1 text-sm block">
                  <span className="font-semibold text-slate-700">Mode de paiement</span>
                  <select
                    value={paymentMethod}
                    onChange={(event) =>
                      setPaymentMethod(
                        event.target.value as "cash" | "card" | "mobile" | "bank" | "other"
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Carte</option>
                    <option value="mobile">Mobile money</option>
                    <option value="bank">Banque</option>
                    <option value="other">Autre</option>
                  </select>
                </label>
              ) : null}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmState(null)}
                  disabled={runningOrderId === confirmState.order.id}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Non
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmAction()}
                  disabled={runningOrderId === confirmState.order.id}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${
                    confirmState.action === "completed"
                      ? "brand-primary-btn"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {runningOrderId === confirmState.order.id
                    ? "Validation..."
                    : confirmState.action === "completed"
                      ? "Oui confirmer"
                      : "Oui annuler"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
