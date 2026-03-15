"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { getBusinessSettings, type BusinessSettings } from "@/lib/businessApi";
import { convertAmount, formatMoney } from "@/lib/currency";
import { getProducts, type CatalogProduct } from "@/lib/catalogApi";
import {
  addHotelReservationCharge,
  addHotelReservationPayment,
  cancelHotelReservation,
  checkInHotelReservation,
  checkOutHotelReservation,
  getHotelReservationFolio,
  getHotelReservations,
  noShowHotelReservation,
  type HotelReservation,
  type HotelReservationFolio,
} from "@/lib/hotelApi";
import {
  createHotelOrder,
  listHotelOrders,
  type HotelOrder,
  type HotelOrderStatus,
} from "@/lib/hotelOrdersApi";

type OrderLine = {
  key: string;
  productId: string;
  quantity: string;
  unitPrice: string;
};

function createOrderLine(): OrderLine {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productId: "",
    quantity: "1",
    unitPrice: "0",
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("fr-FR");
}

function getOrderStatusLabel(status: HotelOrderStatus): string {
  if (status === "completed") return "Confirmee";
  if (status === "on_hold") return "En pause";
  if (status === "cancelled") return "Annulee";
  return "En attente";
}

function getOrderStatusClasses(status: HotelOrderStatus): string {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "on_hold") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "cancelled") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function isCommandCharge(label: string | null | undefined): boolean {
  return (label ?? "").trim().toLowerCase().startsWith("commande hotel ");
}

function getReservationActionError(
  status: string | null | undefined,
  action: "checkIn" | "checkOut" | "cancel" | "noShow"
): string | null {
  const currentStatus = (status ?? "").trim();

  if (action === "checkIn") {
    return currentStatus === "confirmed"
      ? null
      : "Impossible de faire le check-in d une reservation qui n est pas confirmee.";
  }

  if (action === "checkOut") {
    return currentStatus === "checked_in"
      ? null
      : "Impossible de faire le check-out d une reservation qui n est pas en check-in.";
  }

  if (action === "cancel") {
    return ["pending", "confirmed"].includes(currentStatus)
      ? null
      : "Impossible d annuler une reservation apres le check-in.";
  }

  return ["pending", "confirmed"].includes(currentStatus) ? null : "No-show impossible pour ce statut.";
}

export default function HotelFoliosPage() {
  const params = useParams<{ business: string }>();
  const business = params?.business ?? "";

  const [reservations, setReservations] = useState<HotelReservation[]>([]);
  const [selectedReservationId, setSelectedReservationId] = useState("");
  const [folio, setFolio] = useState<HotelReservationFolio | null>(null);

  const [loadingReservations, setLoadingReservations] = useState(true);
  const [loadingFolio, setLoadingFolio] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [savingCharge, setSavingCharge] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [runningAction, setRunningAction] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [reservationOrders, setReservationOrders] = useState<HotelOrder[]>([]);

  const [chargeLabel, setChargeLabel] = useState("");
  const [chargeDescription, setChargeDescription] = useState("");
  const [chargeQuantity, setChargeQuantity] = useState("1");
  const [chargeUnitPrice, setChargeUnitPrice] = useState("0");

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentCurrency, setPaymentCurrency] = useState<"USD" | "HTG">("USD");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "bank" | "mobile" | "other">("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [orderLines, setOrderLines] = useState<OrderLine[]>([createOrderLine()]);

  async function loadReservations() {
    if (!business) return;
    setLoadingReservations(true);
    setError("");
    try {
      const data = await getHotelReservations(business);
      setReservations(data);
      if (data.length > 0) {
        setSelectedReservationId((prev) => prev || String(data[0].id));
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingReservations(false);
    }
  }

  async function loadProducts() {
    if (!business) return;
    setLoadingProducts(true);
    try {
      const data = await getProducts(business, { all: true });
      setProducts(data.filter((item) => item.active && item.status === "active"));
    } catch (err) {
      setError(getErrorMessage(err));
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }

  async function loadBusinessConfig() {
    if (!business) return;
    try {
      const data = await getBusinessSettings(business);
      setBusinessSettings(data);
      setPaymentCurrency((data.currency || "USD").toUpperCase() === "HTG" ? "HTG" : "USD");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function loadFolio(reservationId: string) {
    if (!business || !reservationId) {
      setFolio(null);
      return;
    }
    setLoadingFolio(true);
    setError("");
    try {
      const data = await getHotelReservationFolio(business, Number(reservationId));
      setFolio(data);
    } catch (err) {
      setError(getErrorMessage(err));
      setFolio(null);
    } finally {
      setLoadingFolio(false);
    }
  }

  async function loadReservationOrders(nextFolio: HotelReservationFolio | null) {
    if (!business || !nextFolio?.reservation?.room_id) {
      setReservationOrders([]);
      return;
    }
    setLoadingOrders(true);
    try {
      const data = await listHotelOrders(business, {
        page: 1,
        perPage: 100,
        reservationId: nextFolio.reservation.id,
        roomId: nextFolio.reservation.room_id,
        customerId: nextFolio.reservation.customer_id ?? undefined,
      });
      setReservationOrders(
        data.items.filter((item) => {
          if (item.reservationId === nextFolio.reservation.id) return true;
          if (nextFolio.reservation.customer_id) {
            return item.customer?.id === nextFolio.reservation.customer_id;
          }
          return item.room?.id === nextFolio.reservation.room_id;
        })
      );
    } catch (err) {
      setError(getErrorMessage(err));
      setReservationOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }

  useEffect(() => {
    void loadReservations();
  }, [business]);

  useEffect(() => {
    void loadProducts();
  }, [business]);

  useEffect(() => {
    void loadBusinessConfig();
  }, [business]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const reservationFromQuery = new URLSearchParams(window.location.search).get("reservation");
    if (!reservationFromQuery) return;
    if (selectedReservationId === reservationFromQuery) return;
    setSelectedReservationId(reservationFromQuery);
  }, [selectedReservationId]);

  useEffect(() => {
    void loadFolio(selectedReservationId);
  }, [selectedReservationId]);

  useEffect(() => {
    setOrderNote("");
    setOrderLines([createOrderLine()]);
  }, [selectedReservationId]);

  useEffect(() => {
    void loadReservationOrders(folio);
  }, [business, folio?.reservation?.room_id, folio?.reservation?.customer_id]);

  useEffect(() => {
    if (!folio?.currency) return;
    setPaymentCurrency(folio.currency.toUpperCase() === "HTG" ? "HTG" : "USD");
  }, [folio?.reservation?.id, folio?.currency]);

  const orderTotal = useMemo(() => {
    return orderLines.reduce((sum, line) => {
      const quantity = Number(line.quantity || "0");
      const unitPrice = Number(line.unitPrice || "0");
      if (!(quantity > 0) || !(unitPrice >= 0)) return sum;
      return sum + quantity * unitPrice;
    }, 0);
  }, [orderLines]);

  const orderCurrencyState = useMemo(() => {
    let currency: "USD" | "HTG" | null = null;
    let mixed = false;

    for (const line of orderLines) {
      const product = products.find((item) => String(item.id) === line.productId);
      if (!product) continue;

      const productCurrency = product.priceCurrency.toUpperCase() === "USD" ? "USD" : "HTG";
      if (!currency) {
        currency = productCurrency;
        continue;
      }

      if (currency !== productCurrency) {
        mixed = true;
        break;
      }
    }

    return {
      currency: currency ?? "HTG",
      mixed,
    };
  }, [orderLines, products]);

  const paymentEquivalent = useMemo(() => {
    if (!folio) return 0;
    return convertAmount(Number(paymentAmount || "0"), paymentCurrency, folio.currency, {
      exchangeRateDirection: businessSettings?.exchange_rate_direction,
      exchangeRateValue: businessSettings?.exchange_rate_value,
    });
  }, [businessSettings, folio, paymentAmount, paymentCurrency]);

  const balanceInPaymentCurrency = useMemo(() => {
    if (!folio) return 0;
    return convertAmount(folio.balance_due, folio.currency, paymentCurrency, {
      exchangeRateDirection: businessSettings?.exchange_rate_direction,
      exchangeRateValue: businessSettings?.exchange_rate_value,
    });
  }, [businessSettings, folio, paymentCurrency]);

  const selectedReservation = useMemo(
    () => reservations.find((item) => String(item.id) === selectedReservationId) ?? null,
    [reservations, selectedReservationId]
  );
  const checkInActionError = getReservationActionError(folio?.reservation?.status, "checkIn");
  const checkOutActionError = getReservationActionError(folio?.reservation?.status, "checkOut");
  const cancelActionError = getReservationActionError(folio?.reservation?.status, "cancel");
  const noShowActionError = getReservationActionError(folio?.reservation?.status, "noShow");

  async function handleAddCharge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!business || !selectedReservationId) return;
    if (chargeLabel.trim().length < 2) {
      setError("Libelle de charge obligatoire.");
      return;
    }

    setSavingCharge(true);
    setError("");
    setSuccess("");
    try {
      const next = await addHotelReservationCharge(business, Number(selectedReservationId), {
        label: chargeLabel.trim(),
        description: chargeDescription.trim(),
        quantity: Number(chargeQuantity || "1"),
        unitPrice: Number(chargeUnitPrice || "0"),
      });
      setFolio(next);
      setChargeLabel("");
      setChargeDescription("");
      setChargeQuantity("1");
      setChargeUnitPrice("0");
      setSuccess("Charge ajoutee au folio.");
      await loadReservations();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingCharge(false);
    }
  }

  async function handleAddPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!business || !selectedReservationId) return;
    const amount = Number(paymentAmount || "0");
    if (!(amount > 0)) {
      setError("Montant de paiement invalide.");
      return;
    }

    setSavingPayment(true);
    setError("");
    setSuccess("");
    try {
      const previousStatus = folio?.reservation?.status ?? "";
      const next = await addHotelReservationPayment(business, Number(selectedReservationId), {
        amount,
        paymentCurrency,
        paymentMethod,
        reference: paymentReference.trim(),
        notes: paymentNotes.trim(),
      });
      setFolio(next);
      setPaymentAmount("");
      setPaymentCurrency((next.currency || "USD").toUpperCase() === "HTG" ? "HTG" : "USD");
      setPaymentMethod("cash");
      setPaymentReference("");
      setPaymentNotes("");
      setSuccess(
        previousStatus === "pending" && next.reservation.status === "confirmed"
          ? "Paiement ajoute. Reservation confirmee."
          : "Paiement ajoute au folio."
      );
      await loadReservations();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingPayment(false);
    }
  }

  function updateOrderLine(key: string, patch: Partial<OrderLine>) {
    setOrderLines((prev) =>
      prev.map((line) => {
        if (line.key !== key) return line;
        const next = { ...line, ...patch };
        if (patch.productId !== undefined) {
          const product = products.find((item) => String(item.id) === patch.productId);
          if (product) {
            next.unitPrice = String(product.price);
          }
        }
        return next;
      })
    );
  }

  function addOrderLine() {
    setOrderLines((prev) => [...prev, createOrderLine()]);
  }

  function removeOrderLine(key: string) {
    setOrderLines((prev) => (prev.length > 1 ? prev.filter((line) => line.key !== key) : prev));
  }

  async function handleCreateOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!business || !folio?.reservation?.room_id) return;

    const items = orderLines
      .map((line) => {
        const product = products.find((item) => String(item.id) === line.productId);
        const quantity = Number(line.quantity || "0");
        const unitPrice = Number(line.unitPrice || "0");
        if (!product || !(quantity > 0)) return null;
        return {
          productId: Number(product.id),
          quantity,
          unitPrice: unitPrice >= 0 ? unitPrice : product.price,
        };
      })
      .filter((item): item is { productId: number; quantity: number; unitPrice: number } => item !== null);

    if (items.length === 0) {
      setError("Ajoute au moins un article valide a la commande.");
      return;
    }
    if (orderCurrencyState.mixed) {
      setError("Tous les articles d'une commande doivent utiliser la meme devise.");
      return;
    }

    setSavingOrder(true);
    setError("");
    setSuccess("");
    try {
      await createHotelOrder(business, {
        roomId: folio.reservation.room_id,
        reservationId: folio.reservation.id,
        customerId: folio.reservation.customer_id ?? undefined,
        note: `Commande depuis folio reservation #${folio.reservation.id}${orderNote.trim() ? ` - ${orderNote.trim()}` : ""}`,
        totalAmount: orderTotal,
        items,
      });
      setOrderLines([createOrderLine()]);
      setOrderNote("");
      setSuccess("Commande envoyee au bar en attente de confirmation.");
      await loadReservationOrders(folio);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingOrder(false);
    }
  }

  async function runReservationAction(action: "checkIn" | "checkOut" | "cancel" | "noShow") {
    if (!business || !selectedReservationId) return;
    const actionError = getReservationActionError(folio?.reservation?.status, action);
    if (actionError) {
      setError(actionError);
      setSuccess("");
      return;
    }
    setRunningAction(true);
    setError("");
    setSuccess("");
    try {
      let next: HotelReservationFolio;
      if (action === "checkIn") {
        next = await checkInHotelReservation(business, Number(selectedReservationId));
      } else if (action === "checkOut") {
        next = await checkOutHotelReservation(business, Number(selectedReservationId));
      } else if (action === "cancel") {
        next = await cancelHotelReservation(business, Number(selectedReservationId));
      } else {
        next = await noShowHotelReservation(business, Number(selectedReservationId));
      }
      setFolio(next);
      setSuccess("Action appliquee.");
      await loadReservations();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setRunningAction(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Hotel - Folios</h1>
            <p className="mt-1 text-sm text-slate-600">Facturation reservation: charges, paiements, solde.</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={business ? `/${business}/hotel/reservations` : "/"}
              className="rounded-xl border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              Voir reservations
            </Link>
            <Link
              href={business ? `/${business}/hotel` : "/"}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Retour module hotel
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <label className="space-y-1 text-sm block max-w-xl">
          <span className="font-semibold text-slate-700">Reservation</span>
          <select
            value={selectedReservationId}
            onChange={(event) => setSelectedReservationId(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
            disabled={loadingReservations}
          >
            <option value="">Selectionner une reservation</option>
            {reservations.map((reservation) => (
              <option key={reservation.id} value={String(reservation.id)}>
                #{reservation.id} - {reservation.guest_name} ({reservation.room?.name || "-"} #{reservation.room?.room_number || "-"})
              </option>
            ))}
          </select>
        </label>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}
        {success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        {loadingFolio ? (
          <div className="text-sm text-slate-600">Chargement folio...</div>
        ) : !folio ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
            {loadingReservations ? "Chargement reservations..." : "Selectionne une reservation pour voir le folio."}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Statut</div>
                <div className="mt-1 text-base font-extrabold text-slate-900">{folio.reservation.status || "-"}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Montant chambre</div>
                <div className="mt-1 text-base font-extrabold text-slate-900">{formatMoney(folio.room_amount, folio.currency)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Extras</div>
                <div className="mt-1 text-base font-extrabold text-slate-900">{formatMoney(folio.extras_amount, folio.currency)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paiements</div>
                <div className="mt-1 text-base font-extrabold text-slate-900">{formatMoney(folio.payments_total, folio.currency)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Solde</div>
                <div className="mt-1 text-base font-extrabold text-slate-900">{formatMoney(folio.balance_due, folio.currency)}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void runReservationAction("checkIn")}
                disabled={runningAction || checkInActionError !== null}
                title={checkInActionError ?? "Check-in"}
                className="rounded-xl border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
              >
                Check-in
              </button>
              <button
                type="button"
                onClick={() => void runReservationAction("checkOut")}
                disabled={runningAction || checkOutActionError !== null}
                title={checkOutActionError ?? "Check-out"}
                className="rounded-xl border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
              >
                Check-out
              </button>
              <button
                type="button"
                onClick={() => void runReservationAction("cancel")}
                disabled={runningAction || cancelActionError !== null}
                title={cancelActionError ?? "Annuler"}
                className="rounded-xl border border-orange-200 px-3 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-50 disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void runReservationAction("noShow")}
                disabled={runningAction || noShowActionError !== null}
                title={noShowActionError ?? "No-show"}
                className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                No-show
              </button>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <form onSubmit={handleAddCharge} className="rounded-xl border border-slate-200 p-4 space-y-3">
                <h2 className="text-base font-bold text-slate-900">Ajouter une charge</h2>
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-semibold text-slate-700">Libelle</span>
                    <input
                      value={chargeLabel}
                      onChange={(event) => setChargeLabel(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-semibold text-slate-700">Description</span>
                    <input
                      value={chargeDescription}
                      onChange={(event) => setChargeDescription(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                    />
                  </label>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-semibold text-slate-700">Quantite</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={chargeQuantity}
                      onChange={(event) => setChargeQuantity(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-semibold text-slate-700">Prix unitaire ({folio.currency})</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={chargeUnitPrice}
                      onChange={(event) => setChargeUnitPrice(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={savingCharge}
                  className="rounded-xl bg-[#0d63b8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a4d8f] disabled:opacity-60"
                >
                  {savingCharge ? "Ajout..." : "Ajouter charge"}
                </button>
              </form>

              <form onSubmit={handleAddPayment} className="rounded-xl border border-slate-200 p-4 space-y-3">
                <h2 className="text-base font-bold text-slate-900">Ajouter un paiement</h2>
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-semibold text-slate-700">Montant saisi ({paymentCurrency})</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={paymentAmount}
                      onChange={(event) => setPaymentAmount(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-semibold text-slate-700">Devise</span>
                    <select
                      value={paymentCurrency}
                      onChange={(event) => setPaymentCurrency(event.target.value === "USD" ? "USD" : "HTG")}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="HTG">HTG</option>
                    </select>
                  </label>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-semibold text-slate-700">Mode</span>
                    <select
                      value={paymentMethod}
                      onChange={(event) =>
                        setPaymentMethod(event.target.value as "cash" | "card" | "bank" | "mobile" | "other")
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="bank">Bank</option>
                      <option value="mobile">Mobile</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    <div className="font-semibold text-slate-700">Devise du folio</div>
                    <div className="mt-1">{folio.currency}</div>
                  </div>
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-3 text-sm text-blue-900">
                  <div className="font-semibold text-blue-800">Aide conversion</div>
                  <div className="mt-1">Solde folio: {formatMoney(folio.balance_due, folio.currency)}</div>
                  <div className="mt-1">Equivaut a payer: {formatMoney(balanceInPaymentCurrency, paymentCurrency)}</div>
                  {paymentAmount.trim() !== "" ? (
                    <div className="mt-1">Montant applique au folio: {formatMoney(paymentEquivalent, folio.currency)}</div>
                  ) : null}
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-semibold text-slate-700">Reference</span>
                    <input
                      value={paymentReference}
                      onChange={(event) => setPaymentReference(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-semibold text-slate-700">Notes</span>
                    <input
                      value={paymentNotes}
                      onChange={(event) => setPaymentNotes(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={savingPayment}
                  className="rounded-xl bg-[#0d63b8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a4d8f] disabled:opacity-60"
                >
                  {savingPayment ? "Ajout..." : "Ajouter paiement"}
                </button>
              </form>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.25fr,0.95fr]">
              <form onSubmit={handleCreateOrder} className="rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Passer une commande client</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      La commande part en attente et remonte ensuite dans `Commandes hotel` pour traitement au bar.
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right text-sm">
                    <div className="text-slate-500">Total commande</div>
                    <div className="font-extrabold text-slate-900">{formatMoney(orderTotal, orderCurrencyState.currency)}</div>
                    {orderCurrencyState.mixed ? (
                      <div className="mt-1 text-[11px] font-semibold text-red-600">Devises melangees non autorisees</div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl border border-dashed border-slate-300 p-3 space-y-3">
                  {orderLines.map((line, index) => (
                    <div key={line.key} className="grid gap-2 md:grid-cols-[minmax(0,1.7fr),120px,140px,90px]">
                      <label className="space-y-1 text-sm">
                        <span className="font-semibold text-slate-700">Article {index + 1}</span>
                        <select
                          value={line.productId}
                          onChange={(event) => updateOrderLine(line.key, { productId: event.target.value })}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                          disabled={loadingProducts || savingOrder}
                        >
                          <option value="">Selectionner un produit</option>
                          {products.map((product) => (
                            <option key={product.id} value={String(product.id)}>
                              {product.name} - {formatMoney(product.price, product.priceCurrency)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="font-semibold text-slate-700">Quantite</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={line.quantity}
                          onChange={(event) => updateOrderLine(line.key, { quantity: event.target.value })}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                          disabled={savingOrder}
                        />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="font-semibold text-slate-700">Prix unitaire</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unitPrice}
                          onChange={(event) => updateOrderLine(line.key, { unitPrice: event.target.value })}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                          disabled={savingOrder}
                        />
                      </label>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => removeOrderLine(line.key)}
                          disabled={orderLines.length <= 1 || savingOrder}
                          className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          Retirer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={addOrderLine}
                    disabled={savingOrder}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Ajouter un article
                  </button>
                  {loadingProducts ? <div className="self-center text-sm text-slate-500">Chargement produits...</div> : null}
                </div>
                {orderCurrencyState.mixed ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    Tous les articles d'une meme commande doivent utiliser la meme devise.
                  </div>
                ) : null}

                <label className="space-y-1 text-sm block">
                  <span className="font-semibold text-slate-700">Note pour le bar</span>
                  <textarea
                    value={orderNote}
                    onChange={(event) => setOrderNote(event.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                    placeholder="Ex: a livrer en chambre, sans glace, etc."
                    disabled={savingOrder}
                  />
                </label>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-slate-500">
                    {selectedReservation ? (
                      <>
                        Client: <span className="font-semibold text-slate-700">{selectedReservation.customer?.name || selectedReservation.guest_name || "Client chambre"}</span>
                        {" | "}Chambre: <span className="font-semibold text-slate-700">{selectedReservation.room?.name || "-"} #{selectedReservation.room?.room_number || "-"}</span>
                      </>
                    ) : (
                      "Selectionne une reservation pour preparer la commande."
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={savingOrder || loadingProducts || !folio || orderCurrencyState.mixed}
                    className="rounded-xl bg-[#0d63b8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a4d8f] disabled:opacity-60"
                  >
                    {savingOrder ? "Envoi..." : "Envoyer au bar"}
                  </button>
                </div>
              </form>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Commandes de cette reservation</h2>
                    <p className="mt-1 text-sm text-slate-500">Suivi reception avant traitement/confirmation.</p>
                  </div>
                  <Link
                    href={business ? `/${business}/hotel/orders` : "/"}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Voir commandes
                  </Link>
                </div>

                {loadingOrders ? (
                  <div className="mt-4 text-sm text-slate-600">Chargement des commandes...</div>
                ) : reservationOrders.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                    Aucune commande enregistree pour cette reservation.
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {reservationOrders.slice(0, 8).map((order) => (
                      <div key={order.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-900">{order.invoiceNumber}</div>
                            <div className="text-xs text-slate-500">{formatDateTime(order.createdAt)}</div>
                          </div>
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getOrderStatusClasses(order.status)}`}
                          >
                            {getOrderStatusLabel(order.status)}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-slate-700">
                          {order.itemsCount} article(s) - {formatMoney(order.totalAmount, order.currency)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {order.items.map((item) => `${item.product?.name || "Article"} x${item.quantity}`).join(", ") || "Aucun article"}
                        </div>
                        {order.note ? <div className="mt-2 text-xs text-slate-500">Note: {order.note}</div> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <h2 className="text-base font-bold text-slate-900">Charges</h2>
                {folio.charges.length === 0 ? (
                  <div className="mt-3 text-sm text-slate-600">Aucune charge.</div>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500">
                          <th className="py-2 pr-2">Label</th>
                          <th className="py-2 pr-2">Qt</th>
                          <th className="py-2 pr-2">PU</th>
                          <th className="py-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {folio.charges.map((charge) => (
                          <tr key={charge.id} className="border-t border-slate-100">
                            <td className="py-2 pr-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="font-semibold text-slate-800">{charge.label}</div>
                                {isCommandCharge(charge.label) ? (
                                  <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                                    Commande
                                  </span>
                                ) : (
                                  <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                    Manuelle
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500">{charge.description || "-"}</div>
                            </td>
                            <td className="py-2 pr-2 text-slate-700">{charge.quantity}</td>
                            <td className="py-2 pr-2 text-slate-700">{formatMoney(charge.unit_price, charge.currency || folio.currency)}</td>
                            <td className="py-2 text-slate-700">{formatMoney(charge.total_amount, charge.currency || folio.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <h2 className="text-base font-bold text-slate-900">Paiements</h2>
                {folio.payments.length === 0 ? (
                  <div className="mt-3 text-sm text-slate-600">Aucun paiement.</div>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500">
                          <th className="py-2 pr-2">Mode</th>
                          <th className="py-2 pr-2">Reference</th>
                          <th className="py-2">Montant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {folio.payments.map((payment) => (
                          <tr key={payment.id} className="border-t border-slate-100">
                            <td className="py-2 pr-2 text-slate-700">{payment.payment_method || "-"}</td>
                            <td className="py-2 pr-2 text-slate-700">{payment.reference || "-"}</td>
                            <td className="py-2 text-slate-700">
                              <div>{formatMoney(payment.payment_amount, payment.payment_currency)}</div>
                              {payment.payment_currency !== folio.currency ? (
                                <div className="text-[11px] text-slate-500">
                                  Applique: {formatMoney(payment.amount, folio.currency)}
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
