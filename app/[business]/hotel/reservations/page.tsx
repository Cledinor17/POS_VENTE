"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import IdentityDocumentField from "@/components/IdentityDocumentField";
import { ApiError } from "@/lib/api";
import { hasPermission } from "@/lib/businessAccess";
import { createCustomer, listCustomers, type CustomerAddress, type CustomerItem } from "@/lib/customersApi";
import { formatMoney } from "@/lib/currency";
import {
  cancelHotelReservation,
  checkInHotelReservation,
  checkOutHotelReservation,
  createHotelReservation,
  getHotelReservations,
  getHotelRooms,
  noShowHotelReservation,
  updateHotelReservation,
  type HotelReservation,
  type HotelRoom,
} from "@/lib/hotelApi";
import { useBusinessPermissions } from "@/lib/useBusinessPermissions";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

function parseDateOnly(value: string): Date | null {
  if (!value) return null;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (year <= 0 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function formatReservationDate(value: string): string {
  const raw = value.trim();
  if (!raw) return "-";

  const parts = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (parts) {
    return `${parts[3]}/${parts[2]}/${parts[1]}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

function formatReservationTime(value: string): string {
  const raw = value.trim();
  if (!raw) return "--:--";

  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(parsed);
  }

  const parts = raw.match(/\b(\d{2}):(\d{2})/);
  if (parts) {
    return `${parts[1]}:${parts[2]}`;
  }

  return "--:--";
}

function formatReservationDateTime(value: string): string {
  const raw = value.trim();
  if (!raw) return "-";
  return `${formatReservationDate(raw)} a ${formatReservationTime(raw)}`;
}

function formatReservationMoment(dateValue: string, dateTimeValue: string): string {
  return `${formatReservationDate(dateValue)} a ${formatReservationTime(dateTimeValue || dateValue)}`;
}

function getNights(checkIn: string, checkOut: string): number {
  const start = parseDateOnly(checkIn);
  const end = parseDateOnly(checkOut);
  if (!start || !end) return 0;
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && endA > startB;
}

function resolveImageUrl(path: string, url: string): string {
  const absolute = (url || "").trim();
  if (absolute) return absolute;
  const rawPath = (path || "").trim();
  if (!rawPath) return "";
  const normalized = rawPath.replace(/^\/+/, "");
  const relative = normalized.startsWith("storage/") ? normalized : `storage/${normalized}`;
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
  return base ? `${base}/${relative}` : `/${relative}`;
}

function formatCustomerOption(customer: CustomerItem): string {
  const parts = [customer.name];
  if (customer.phone) parts.push(customer.phone);
  if (customer.email) parts.push(customer.email);
  return parts.join(" - ");
}

const CUSTOMER_MODAL_STEPS = [
  {
    id: "identity",
    title: "Identite",
    description: "Coordonnees et informations principales du client.",
  },
  {
    id: "addresses",
    title: "Adresses",
    description: "Facturation et livraison.",
  },
  {
    id: "documents",
    title: "Gestion",
    description: "Conditions, notes et piece d'identite.",
  },
] as const;

const MANUAL_RESERVATION_STATUSES = [
  { value: "pending", label: "En attente" },
  { value: "confirmed", label: "Confirmed" },
  { value: "checked_in", label: "Check-in" },
  { value: "checked_out", label: "Check-out" },
  { value: "cancelled", label: "Annuler" },
] as const;

type CustomerAddressDraft = Record<keyof CustomerAddress, string>;

type NewCustomerFormState = {
  code: string;
  name: string;
  companyName: string;
  email: string;
  phone: string;
  taxNumber: string;
  currency: string;
  paymentTermsDays: string;
  creditLimit: string;
  notes: string;
  billingAddress: CustomerAddressDraft;
  shippingAddress: CustomerAddressDraft;
  identityDocumentFile: File | null;
};

type ReservationConfirmationState =
  | {
      kind: "status";
      reservationId: number;
      previousStatus: string;
      nextStatus: string;
      title: string;
      message: string;
      confirmLabel: string;
      tone: "blue" | "emerald" | "orange" | "red";
    }
  | {
      kind: "operation";
      reservationId: number;
      operation: "checkIn" | "checkOut" | "cancel" | "noShow";
      title: string;
      message: string;
      confirmLabel: string;
      tone: "blue" | "emerald" | "orange" | "red";
    };

function createEmptyAddressDraft(): CustomerAddressDraft {
  return {
    line1: "",
    line2: "",
    city: "",
    state: "",
    zip: "",
    country: "",
  };
}

function createEmptyNewCustomerForm(): NewCustomerFormState {
  return {
    code: "",
    name: "",
    companyName: "",
    email: "",
    phone: "",
    taxNumber: "",
    currency: "",
    paymentTermsDays: "",
    creditLimit: "",
    notes: "",
    billingAddress: createEmptyAddressDraft(),
    shippingAddress: createEmptyAddressDraft(),
    identityDocumentFile: null,
  };
}

function getStatusLabel(status: string): string {
  if (status === "pending") return "En attente";
  if (status === "confirmed") return "Confirmed";
  if (status === "checked_in") return "Check-in";
  if (status === "checked_out") return "Check-out";
  if (status === "cancelled") return "Annulee";
  return status;
}

function getStatusBadgeClasses(status: string): string {
  if (status === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (status === "confirmed") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if (status === "checked_in") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "checked_out") {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }
  if (status === "cancelled") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function getOperationConfirmation(operation: "checkIn" | "checkOut" | "cancel" | "noShow") {
  if (operation === "checkIn") {
    return {
      title: "Confirmer le check-in",
      message: "Veux-tu vraiment enregistrer le check-in de cette reservation ?",
      confirmLabel: "Oui, faire le check-in",
      tone: "emerald" as const,
    };
  }

  if (operation === "checkOut") {
    return {
      title: "Confirmer le check-out",
      message: "Veux-tu vraiment enregistrer le check-out de cette reservation ?",
      confirmLabel: "Oui, faire le check-out",
      tone: "blue" as const,
    };
  }

  if (operation === "cancel") {
    return {
      title: "Confirmer l'annulation",
      message: "Veux-tu vraiment annuler cette reservation ?",
      confirmLabel: "Oui, annuler",
      tone: "orange" as const,
    };
  }

  return {
    title: "Confirmer le no-show",
    message: "Veux-tu vraiment marquer cette reservation en no-show ?",
    confirmLabel: "Oui, marquer no-show",
    tone: "red" as const,
  };
}

export default function HotelReservationsPage() {
  const params = useParams<{ business: string }>();
  const business = params?.business ?? "";
  const { loading: permissionsLoading, permissions: currentPermissions } = useBusinessPermissions(business);

  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [reservations, setReservations] = useState<HotelReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingReservationId, setUpdatingReservationId] = useState<number | null>(null);
  const [operationReservationId, setOperationReservationId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [statusDrafts, setStatusDrafts] = useState<Record<number, string>>({});

  const [roomId, setRoomId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("1");
  const [status, setStatus] = useState("pending");
  const [notes, setNotes] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [customerError, setCustomerError] = useState("");
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerModalStep, setCustomerModalStep] = useState(0);
  const [newCustomerForm, setNewCustomerForm] = useState<NewCustomerFormState>(() => createEmptyNewCustomerForm());
  const [detailRoom, setDetailRoom] = useState<HotelRoom | null>(null);
  const [detailSlideIndex, setDetailSlideIndex] = useState(0);
  const [confirmationDialog, setConfirmationDialog] = useState<ReservationConfirmationState | null>(null);
  const [reservationSearch, setReservationSearch] = useState("");
  const [reservationStatusFilter, setReservationStatusFilter] = useState("");
  const [reservationRoomFilter, setReservationRoomFilter] = useState("");
  const canReadReservations = hasPermission(currentPermissions, ["reservations.read", "reservations.manage"]);
  const canCreateReservations = hasPermission(currentPermissions, ["reservations.create", "reservations.manage"]);
  const canEditReservations = hasPermission(currentPermissions, ["reservations.edit", "reservations.manage"]);
  const canManageReservations = hasPermission(currentPermissions, "reservations.manage");
  const canReadCustomers = hasPermission(currentPermissions, ["customers.read", "customers.manage"]);
  const canCreateCustomers = hasPermission(currentPermissions, ["customers.create", "customers.manage"]);
  const hasReservationAccess =
    canReadReservations || canCreateReservations || canEditReservations || canManageReservations;
  const isReservationsReadOnly =
    canReadReservations && !canCreateReservations && !canEditReservations && !canManageReservations;

  const nights = useMemo(() => getNights(checkIn, checkOut), [checkIn, checkOut]);
  const periodReady = checkIn !== "" && checkOut !== "";
  const periodValid = periodReady && nights > 0;

  const availableRooms = useMemo(() => {
    if (!periodValid) return [];
    const start = parseDateOnly(checkIn);
    const end = parseDateOnly(checkOut);
    if (!start || !end) return [];

    return rooms.filter((room) => {
      if (!room.is_active) return false;
      if (room.status === "maintenance") return false;

      const hasOverlap = reservations.some((reservation) => {
        if (reservation.room_id !== room.id) return false;
        if (!["pending", "confirmed", "checked_in"].includes(reservation.status)) return false;
        const reservationStart = parseDateOnly(reservation.check_in);
        const reservationEnd = parseDateOnly(reservation.check_out);
        if (!reservationStart || !reservationEnd) return false;
        return rangesOverlap(start, end, reservationStart, reservationEnd);
      });

      return !hasOverlap;
    });
  }, [checkIn, checkOut, periodValid, reservations, rooms]);

  const customerOptions = useMemo(() => {
    if (!selectedCustomer) return customers;
    return [selectedCustomer, ...customers.filter((customer) => customer.id !== selectedCustomer.id)];
  }, [customers, selectedCustomer]);

  const filteredReservations = useMemo(() => {
    const search = reservationSearch.trim().toLowerCase();

    return reservations.filter((reservation) => {
      if (reservationStatusFilter && reservation.status !== reservationStatusFilter) {
        return false;
      }

      if (reservationRoomFilter && String(reservation.room_id) !== reservationRoomFilter) {
        return false;
      }

      if (!search) return true;

      const roomLabel = `${reservation.room?.name || ""} ${reservation.room?.room_number || ""}`.toLowerCase();
      const haystack = [
        reservation.guest_name,
        reservation.guest_phone,
        reservation.guest_email,
        reservation.customer?.name ?? "",
        reservation.customer?.phone ?? "",
        reservation.customer?.email ?? "",
        roomLabel,
        reservation.check_in,
        reservation.check_out,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [reservationRoomFilter, reservationSearch, reservationStatusFilter, reservations]);

  async function loadData() {
    if (!business || permissionsLoading) return;
    if (!canReadReservations) {
      setRooms([]);
      setReservations([]);
      setStatusDrafts({});
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [roomsData, reservationsData] = await Promise.all([
        getHotelRooms(business),
        getHotelReservations(business),
      ]);
      setRooms(roomsData);
      setReservations(reservationsData);
      setStatusDrafts(() => {
        const next: Record<number, string> = {};
        reservationsData.forEach((reservation) => {
          next[reservation.id] = reservation.status;
        });
        return next;
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [business, canReadReservations, permissionsLoading]);

  useEffect(() => {
    if (!confirmationDialog) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeConfirmationDialog();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [confirmationDialog]);

  useEffect(() => {
    if (!isCreateModalOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (isCustomerModalOpen) {
        setIsCustomerModalOpen(false);
        setCustomerError("");
        return;
      }
      setIsCreateModalOpen(false);
      setIsCustomerModalOpen(false);
      setCustomerError("");
      setDetailRoom(null);
      setDetailSlideIndex(0);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCreateModalOpen, isCustomerModalOpen]);

  useEffect(() => {
    if (!business || !isCreateModalOpen || !canReadCustomers) return undefined;

    let active = true;
    const timeoutId = window.setTimeout(async () => {
      setLoadingCustomers(true);
      setCustomerError("");
      try {
        const result = await listCustomers(business, {
          page: 1,
          perPage: 50,
          q: customerSearch.trim() || undefined,
          isActive: true,
        });
        if (!active) return;
        setCustomers(result.items);
        const match = result.items.find((customer) => customer.id === selectedCustomerId);
        if (match) {
          setSelectedCustomer(match);
        }
      } catch (err) {
        if (active) {
          setCustomerError(getErrorMessage(err));
        }
      } finally {
        if (active) {
          setLoadingCustomers(false);
        }
      }
    }, customerSearch ? 250 : 0);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [business, canReadCustomers, customerSearch, isCreateModalOpen, selectedCustomerId]);

  useEffect(() => {
    if (!roomId) return;
    if (!periodValid) return;
    const selectedStillAvailable = availableRooms.some((room) => String(room.id) === roomId);
    if (!selectedStillAvailable) {
      setRoomId("");
    }
  }, [availableRooms, periodValid, roomId]);

  function resetReservationForm() {
    setRoomId("");
    setGuestName("");
    setGuestPhone("");
    setGuestEmail("");
    setCheckIn("");
    setCheckOut("");
    setGuests("1");
    setStatus("pending");
    setNotes("");
    setSelectedCustomerId("");
    setSelectedCustomer(null);
    setCustomerSearch("");
    setIsCustomerModalOpen(false);
    setNewCustomerForm(createEmptyNewCustomerForm());
    setCustomerError("");
  }

  function applyCustomerToReservation(customer: CustomerItem) {
    setGuestName(customer.name);
    setGuestPhone(customer.phone ?? "");
    setGuestEmail(customer.email ?? "");
  }

  function handleExistingCustomerSelect(customerId: string) {
    setSelectedCustomerId(customerId);
    setCustomerError("");

    if (!customerId) {
      setSelectedCustomer(null);
      return;
    }

    const nextCustomer = customerOptions.find((customer) => customer.id === customerId) ?? null;
    setSelectedCustomer(nextCustomer);
    if (nextCustomer) {
      applyCustomerToReservation(nextCustomer);
      setIsCustomerModalOpen(false);
    }
  }

  function updateNewCustomerField<K extends keyof NewCustomerFormState>(field: K, value: NewCustomerFormState[K]) {
    setNewCustomerForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateNewCustomerAddress(section: "billingAddress" | "shippingAddress", field: keyof CustomerAddressDraft, value: string) {
    setNewCustomerForm((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  }

  function openCustomerModal() {
    if (!canCreateCustomers) return;
    setCustomerError("");
    setCustomerModalStep(0);
    setNewCustomerForm((prev) => ({
      ...createEmptyNewCustomerForm(),
      code: prev.code,
      companyName: prev.companyName,
      taxNumber: prev.taxNumber,
      currency: prev.currency,
      paymentTermsDays: prev.paymentTermsDays,
      creditLimit: prev.creditLimit,
      notes: prev.notes,
      billingAddress: prev.billingAddress,
      shippingAddress: prev.shippingAddress,
      name: guestName,
      phone: guestPhone,
      email: guestEmail,
    }));
    setIsCustomerModalOpen(true);
  }

  function closeCustomerModal() {
    setIsCustomerModalOpen(false);
    setCustomerModalStep(0);
    setCustomerError("");
  }

  function validateCustomerModalStep(step: number): boolean {
    return true;
  }

  function goToCustomerStep(step: number) {
    if (step < customerModalStep) {
      setCustomerModalStep(step);
      return;
    }

    for (let current = customerModalStep; current < step; current += 1) {
      if (!validateCustomerModalStep(current)) {
        return;
      }
    }

    setCustomerError("");
    setCustomerModalStep(step);
  }

  function goToNextCustomerStep() {
    if (!validateCustomerModalStep(customerModalStep)) return;
    setCustomerError("");
    setCustomerModalStep((prev) => Math.min(prev + 1, CUSTOMER_MODAL_STEPS.length - 1));
  }

  function goToPreviousCustomerStep() {
    setCustomerError("");
    setCustomerModalStep((prev) => Math.max(prev - 1, 0));
  }

  async function handleCreateCustomer() {
    if (!business || !canCreateCustomers) {
      setCustomerError("Tu n'as pas l'autorisation d'ajouter un client.");
      return;
    }

    setCreatingCustomer(true);
    setCustomerError("");
    setSuccess("");
    try {
      const created = await createCustomer(business, {
        code: newCustomerForm.code.trim() || undefined,
        name: newCustomerForm.name.trim(),
        companyName: newCustomerForm.companyName.trim() || undefined,
        phone: newCustomerForm.phone.trim() || undefined,
        email: newCustomerForm.email.trim() || undefined,
        taxNumber: newCustomerForm.taxNumber.trim() || undefined,
        currency: newCustomerForm.currency.trim() || undefined,
        paymentTermsDays: newCustomerForm.paymentTermsDays.trim()
          ? Number(newCustomerForm.paymentTermsDays)
          : undefined,
        creditLimit: newCustomerForm.creditLimit.trim() ? Number(newCustomerForm.creditLimit) : undefined,
        notes: newCustomerForm.notes.trim() || undefined,
        billingAddress: newCustomerForm.billingAddress,
        shippingAddress: newCustomerForm.shippingAddress,
        identityDocumentFile: newCustomerForm.identityDocumentFile,
      });
      setCustomers((prev) => [created, ...prev.filter((customer) => customer.id !== created.id)]);
      setSelectedCustomer(created);
      setSelectedCustomerId(created.id);
      applyCustomerToReservation(created);
      setIsCustomerModalOpen(false);
      setNewCustomerForm(createEmptyNewCustomerForm());
      setCustomerSearch("");
      setSuccess("Client ajoute. Tu peux continuer la reservation.");
    } catch (err) {
      setCustomerError(getErrorMessage(err));
    } finally {
      setCreatingCustomer(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!business) return;
    if (!canCreateReservations) {
      setError("Tu n'as pas l'autorisation d'ajouter une reservation.");
      return;
    }
    if (guestName.trim().length < 2) {
      setError("Nom client obligatoire.");
      return;
    }
    if (!checkIn || !checkOut) {
      setError("Check-in et check-out obligatoires.");
      return;
    }
    if (nights <= 0) {
      setError("La periode est invalide. Le check-out doit etre apres le check-in.");
      return;
    }
    if (!roomId) {
      setError("Selectionne une chambre disponible.");
      return;
    }
    if (!availableRooms.some((room) => String(room.id) === roomId)) {
      setError("Cette chambre n'est plus disponible sur la periode choisie.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await createHotelReservation(business, {
        roomId: Number(roomId),
        customerId: selectedCustomerId ? Number(selectedCustomerId) : undefined,
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
        guestEmail: guestEmail.trim(),
        checkIn,
        checkOut,
        guests: Number(guests || 1),
        status,
        notes: notes.trim(),
      });
      resetReservationForm();
      setSuccess("Reservation ajoutee.");
      await loadData();
      closeCreateModal();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function closeConfirmationDialog(resetStatus = true) {
    setConfirmationDialog((current) => {
      if (resetStatus && current?.kind === "status") {
        setStatusDrafts((prev) => ({
          ...prev,
          [current.reservationId]: current.previousStatus,
        }));
      }
      return null;
    });
  }

  function requestStatusConfirmation(reservation: HotelReservation, nextStatus: string) {
    if (!canEditReservations) return;
    const previousStatus = statusDrafts[reservation.id] ?? reservation.status;
    if (nextStatus === previousStatus) return;

    setStatusDrafts((prev) => ({ ...prev, [reservation.id]: nextStatus }));
    setConfirmationDialog({
      kind: "status",
      reservationId: reservation.id,
      previousStatus,
      nextStatus,
      title: "Confirmer le changement de statut",
      message: `Veux-tu vraiment changer le statut de ${getStatusLabel(previousStatus)} vers ${getStatusLabel(nextStatus)} ?`,
      confirmLabel: "Oui, changer le statut",
      tone: "blue",
    });
  }

  async function updateReservationStatus(reservationId: number, nextStatus: string, previousStatus: string) {
    if (!business || !canEditReservations) return;

    if (nextStatus === "cancelled") {
      setOperationReservationId(reservationId);
      setError("");
      setSuccess("");
      try {
        await cancelHotelReservation(business, reservationId);
        setSuccess("Reservation annulee.");
        setConfirmationDialog(null);
        await loadData();
      } catch (err) {
        setStatusDrafts((prev) => ({ ...prev, [reservationId]: previousStatus }));
        setError(getErrorMessage(err));
      } finally {
        setOperationReservationId(null);
      }
      return;
    }

    setUpdatingReservationId(reservationId);
    setError("");
    setSuccess("");
    try {
      await updateHotelReservation(business, reservationId, { status: nextStatus });
      setSuccess("Statut reservation mis a jour.");
      setConfirmationDialog(null);
      await loadData();
    } catch (err) {
      setStatusDrafts((prev) => ({ ...prev, [reservationId]: previousStatus }));
      setError(getErrorMessage(err));
    } finally {
      setUpdatingReservationId(null);
    }
  }

  async function handleOperation(
    reservationId: number,
    operation: "checkIn" | "checkOut" | "cancel" | "noShow"
  ) {
    if (!business || !canManageReservations) return;
    setOperationReservationId(reservationId);
    setError("");
    setSuccess("");
    try {
      if (operation === "checkIn") {
        await checkInHotelReservation(business, reservationId);
      } else if (operation === "checkOut") {
        await checkOutHotelReservation(business, reservationId);
      } else if (operation === "cancel") {
        await cancelHotelReservation(business, reservationId);
      } else {
        await noShowHotelReservation(business, reservationId);
      }
      setSuccess("Operation appliquee.");
      setConfirmationDialog(null);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setOperationReservationId(null);
    }
  }

  function requestOperationConfirmation(
    reservationId: number,
    operation: "checkIn" | "checkOut" | "cancel" | "noShow"
  ) {
    if (!canManageReservations) return;
    const details = getOperationConfirmation(operation);
    setConfirmationDialog({
      kind: "operation",
      reservationId,
      operation,
      title: details.title,
      message: details.message,
      confirmLabel: details.confirmLabel,
      tone: details.tone,
    });
  }

  async function confirmPendingAction() {
    if (!confirmationDialog) return;

    if (confirmationDialog.kind === "status") {
      await updateReservationStatus(
        confirmationDialog.reservationId,
        confirmationDialog.nextStatus,
        confirmationDialog.previousStatus
      );
      return;
    }

    await handleOperation(confirmationDialog.reservationId, confirmationDialog.operation);
  }

  function openRoomDetails(room: HotelRoom) {
    setDetailRoom(room);
    setDetailSlideIndex(0);
  }

  function openCreateModal() {
    if (!canCreateReservations) return;
    setError("");
    setSuccess("");
    setCustomerError("");
    setIsCustomerModalOpen(false);
    setIsCreateModalOpen(true);
  }

  function closeCreateModal() {
    setIsCreateModalOpen(false);
    setIsCustomerModalOpen(false);
    setCustomerError("");
    closeRoomDetails();
  }

  function closeRoomDetails() {
    setDetailRoom(null);
    setDetailSlideIndex(0);
  }

  function changeDetailSlide(direction: -1 | 1) {
    setDetailSlideIndex((prev) => {
      const total = detailRoom?.images.length ?? 0;
      if (total <= 0) return 0;
      return (prev + direction + total) % total;
    });
  }

  function renderReservationStatusControl(reservation: HotelReservation) {
    const currentStatus = statusDrafts[reservation.id] ?? reservation.status;
    const isManualStatus = MANUAL_RESERVATION_STATUSES.some((option) => option.value === currentStatus);
    const isCancelledStatus = currentStatus === "cancelled";

    if (!canEditReservations) {
      return (
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusBadgeClasses(
            currentStatus
          )}`}
        >
          {getStatusLabel(currentStatus)}
        </span>
      );
    }

    return (
      <div className="space-y-1.5">
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusBadgeClasses(
            currentStatus
          )}`}
        >
          {getStatusLabel(currentStatus)}
        </span>
        <select
          value={isManualStatus ? currentStatus : ""}
          onChange={(event) => requestStatusConfirmation(reservation, event.target.value)}
          disabled={updatingReservationId === reservation.id || isCancelledStatus}
          className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none disabled:opacity-60"
        >
          {!isManualStatus ? (
            <option value="" disabled>
              {getStatusLabel(currentStatus)}
            </option>
          ) : null}
          {MANUAL_RESERVATION_STATUSES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  function renderReservationActions(reservation: HotelReservation) {
    if (!canManageReservations) {
      return <span className="text-xs text-slate-400">Aucune action</span>;
    }

    return (
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => requestOperationConfirmation(reservation.id, "checkIn")}
          disabled={operationReservationId === reservation.id}
          title="Check-in"
          aria-label="Check-in"
          className="rounded-lg border border-emerald-200 px-2.5 py-2 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
        >
          <i className="fa-solid fa-right-to-bracket" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => requestOperationConfirmation(reservation.id, "checkOut")}
          disabled={operationReservationId === reservation.id}
          title="Check-out"
          aria-label="Check-out"
          className="rounded-lg border border-blue-200 px-2.5 py-2 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
        >
          <i className="fa-solid fa-right-from-bracket" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => requestOperationConfirmation(reservation.id, "cancel")}
          disabled={operationReservationId === reservation.id}
          title="Annuler"
          aria-label="Annuler"
          className="rounded-lg border border-orange-200 px-2.5 py-2 text-orange-700 hover:bg-orange-50 disabled:opacity-50"
        >
          <i className="fa-solid fa-ban" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => requestOperationConfirmation(reservation.id, "noShow")}
          disabled={operationReservationId === reservation.id}
          title="No-show"
          aria-label="No-show"
          className="rounded-lg border border-red-200 px-2.5 py-2 text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          <i className="fa-solid fa-user-xmark" aria-hidden="true" />
        </button>
        <Link
          href={business ? `/${business}/hotel/folios?reservation=${reservation.id}` : "/"}
          title="Ajouter paiement"
          aria-label="Ajouter paiement"
          className="rounded-lg border border-slate-300 px-2.5 py-2 text-slate-700 hover:bg-slate-50"
        >
          <i className="fa-solid fa-money-bill-wave" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  const detailHasImages = (detailRoom?.images.length ?? 0) > 0;
  const detailActiveIndex = detailHasImages ? Math.min(detailSlideIndex, (detailRoom?.images.length ?? 1) - 1) : 0;
  const detailActiveImage = detailHasImages && detailRoom ? detailRoom.images[detailActiveIndex] : null;
  const detailActiveImageUrl = detailActiveImage
    ? resolveImageUrl(detailActiveImage.image_path, detailActiveImage.image_url)
    : "";
  const isLastCustomerStep = customerModalStep === CUSTOMER_MODAL_STEPS.length - 1;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Hotel - Reservations</h1>
            <p className="mt-1 text-sm text-slate-600">Gestion des reservations de chambres.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canCreateReservations ? (
              <button
                type="button"
                onClick={openCreateModal}
                className="rounded-xl bg-[#0d63b8] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0a4d8f]"
              >
                Nouvelle reservation
              </button>
            ) : null}
            {canManageReservations ? (
              <Link
                href={business ? `/${business}/hotel/folios` : "/"}
                className="rounded-xl border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
              >
                Ouvrir folios
              </Link>
            ) : null}
            <Link
              href={business ? `/${business}/hotel` : "/"}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Retour module hotel
            </Link>
          </div>
        </div>
      </div>
      {!permissionsLoading && !hasReservationAccess ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Ce profil n&apos;a pas encore d&apos;acces au module reservations.
        </div>
      ) : null}
      {!permissionsLoading && !canReadReservations && canCreateReservations ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Ce profil peut lancer une reservation, mais il ne voit pas la liste complete des reservations.
        </div>
      ) : null}
      {!permissionsLoading && isReservationsReadOnly ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Acces en lecture seule: le suivi reste visible, mais les changements et operations sont masques.
        </div>
      ) : null}

      {isCreateModalOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reservation-modal-title"
          onClick={closeCreateModal}
        >
          <div
            className="w-full max-w-6xl max-h-[90vh] overflow-y-auto space-y-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-end">
              <button
                type="button"
                onClick={closeCreateModal}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Fermer
              </button>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : null}
            {success ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {success}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <h2 id="reservation-modal-title" className="text-lg font-bold text-slate-900">
                Nouvelle reservation
              </h2>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                  <label className="space-y-1 text-sm md:flex-1">
                    <span className="font-semibold text-slate-700">Rechercher un client</span>
                    <input
                      value={customerSearch}
                      onChange={(event) => setCustomerSearch(event.target.value)}
                      placeholder="Nom, telephone ou email"
                      disabled={!canReadCustomers}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1 text-sm md:flex-[1.2]">
                    <span className="font-semibold text-slate-700">Client enregistre</span>
                    <select
                      value={selectedCustomerId}
                      onChange={(event) => handleExistingCustomerSelect(event.target.value)}
                      disabled={loadingCustomers || !canReadCustomers}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none disabled:bg-slate-100"
                    >
                      <option value="">Saisie libre / client non enregistre</option>
                      {customerOptions.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {formatCustomerOption(customer)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {canCreateCustomers ? (
                    <button
                      type="button"
                      onClick={openCustomerModal}
                      className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Nouveau client
                    </button>
                  ) : null}
                </div>
                {!canReadCustomers ? (
                  <div className="text-xs text-slate-500">
                    Ce profil peut saisir le client manuellement, mais ne peut pas consulter les fiches clients enregistrees.
                  </div>
                ) : null}
                {loadingCustomers ? (
                  <div className="text-xs text-slate-500">Chargement des clients...</div>
                ) : null}
                {!loadingCustomers && canReadCustomers && customerOptions.length === 0 ? (
                  <div className="text-xs text-slate-500">Aucun client actif trouve. Utilise le bouton Nouveau client.</div>
                ) : null}
                {customerError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {customerError}
                  </div>
                ) : null}
                {selectedCustomer ? (
                  <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                    Client selectionne: <span className="font-semibold">{selectedCustomer.name}</span>
                  </div>
                ) : null}
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Check-in</span>
                  <input
                    type="date"
                    value={checkIn}
                    onChange={(event) => setCheckIn(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Check-out</span>
                  <input
                    type="date"
                    value={checkOut}
                    onChange={(event) => setCheckOut(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Duree (nuits)</span>
                  <input
                    value={String(nights)}
                    readOnly
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Chambre disponible</span>
                  <select
                    value={roomId}
                    onChange={(event) => setRoomId(event.target.value)}
                    disabled={!periodValid}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none disabled:bg-slate-100"
                  >
                    <option value="">
                      {!periodReady
                        ? "Choisir d'abord check-in/check-out"
                        : !periodValid
                          ? "Periode invalide"
                          : availableRooms.length === 0
                            ? "Aucune chambre disponible"
                            : "Selectionner"}
                    </option>
                    {availableRooms.map((room) => (
                      <option key={room.id} value={String(room.id)}>
                        {room.name} #{room.room_number} - {formatMoney(room.price_per_night, room.price_per_night_currency)}/nuit
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Nom sur reservation</span>
                  <input
                    value={guestName}
                    onChange={(event) => setGuestName(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                    placeholder="Nom client"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Telephone</span>
                  <input
                    value={guestPhone}
                    onChange={(event) => setGuestPhone(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Email</span>
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(event) => setGuestEmail(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Nb clients</span>
                  <input
                    type="number"
                    min="1"
                    value={guests}
                    onChange={(event) => setGuests(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                  />
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Statut</span>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                  >
                    {MANUAL_RESERVATION_STATUSES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Notes</span>
                  <input
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#0d63b8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a4d8f] disabled:opacity-60"
              >
                {saving ? "Enregistrement..." : "Ajouter reservation"}
              </button>
            </form>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-bold text-slate-900">Chambres disponibles sur la periode</h2>
              {!periodReady ? (
                <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                  Selectionne d'abord check-in et check-out.
                </div>
              ) : !periodValid ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                  Periode invalide: le check-out doit etre apres le check-in.
                </div>
              ) : availableRooms.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                  Aucune chambre disponible pour cette periode.
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="py-2 pr-3">Chambre</th>
                        <th className="py-2 pr-3">Categorie</th>
                        <th className="py-2 pr-3">Capacite</th>
                        <th className="py-2 pr-3">Prix/nuit</th>
                        <th className="py-2 pr-3">Statut</th>
                        <th className="py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableRooms.map((room) => (
                        <tr key={room.id} className="border-t border-slate-100">
                          <td className="py-2 pr-3 text-slate-700">
                            {room.name} #{room.room_number}
                          </td>
                          <td className="py-2 pr-3 text-slate-700">{room.category?.name || "-"}</td>
                          <td className="py-2 pr-3 text-slate-700">{room.capacity}</td>
                          <td className="py-2 pr-3 text-slate-700">{formatMoney(room.price_per_night, room.price_per_night_currency)}</td>
                          <td className="py-2 pr-3 text-slate-700">{room.status}</td>
                          <td className="py-2">
                            <button
                              type="button"
                              onClick={() => setRoomId(String(room.id))}
                              className="mr-2 rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                            >
                              Choisir
                            </button>
                            <button
                              type="button"
                              onClick={() => openRoomDetails(room)}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {isCustomerModalOpen ? (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="customer-modal-title"
                onClick={closeCustomerModal}
              >
                <div
                  className="flex h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:max-h-[90vh] sm:h-auto sm:p-5"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex shrink-0 items-start justify-between gap-3">
                    <div>
                      <h3 id="customer-modal-title" className="text-lg font-extrabold text-slate-900">
                        Nouveau client
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        Ajoute le client puis on le recharge automatiquement dans la reservation.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeCustomerModal}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Fermer
                    </button>
                  </div>

                  {customerError ? (
                    <div className="mt-3 shrink-0 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:mt-4 sm:px-4 sm:py-3">
                      {customerError}
                    </div>
                  ) : null}

                  <div className="mt-3 flex min-h-0 flex-1 flex-col space-y-3 sm:mt-4 sm:space-y-4">
                    <div className="grid shrink-0 grid-cols-3 gap-2">
                      {CUSTOMER_MODAL_STEPS.map((step, index) => {
                        const isActive = index === customerModalStep;
                        const isCompleted = index < customerModalStep;

                        return (
                          <button
                            key={step.id}
                            type="button"
                            onClick={() => goToCustomerStep(index)}
                            className={`rounded-xl border px-2 py-2 text-left transition sm:px-4 sm:py-3 ${
                              isActive
                                ? "border-blue-300 bg-blue-50"
                                : isCompleted
                                  ? "border-emerald-200 bg-emerald-50"
                                  : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                            }`}
                          >
                            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 sm:text-xs sm:tracking-[0.2em]">
                              Etape {index + 1}
                            </div>
                            <div className="mt-1 text-xs font-bold text-slate-900 sm:text-sm">{step.title}</div>
                            <div className="mt-1 hidden text-xs text-slate-600 sm:block">{step.description}</div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="hidden shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:block">
                      <div className="text-sm font-semibold text-slate-900">
                        {CUSTOMER_MODAL_STEPS[customerModalStep]?.title}
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        {CUSTOMER_MODAL_STEPS[customerModalStep]?.description}
                      </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-hidden">
                      <div
                        className="flex h-full transition-transform duration-300 ease-out"
                        style={{
                          width: `${CUSTOMER_MODAL_STEPS.length * 100}%`,
                          transform: `translateX(-${customerModalStep * (100 / CUSTOMER_MODAL_STEPS.length)}%)`,
                        }}
                      >
                        <div className="min-h-0 overflow-y-auto pr-1" style={{ width: `${100 / CUSTOMER_MODAL_STEPS.length}%` }}>
                          <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
                            <label className="space-y-1 text-sm">
                              <span className="font-semibold text-slate-700">Code client</span>
                              <input
                                value={newCustomerForm.code}
                                onChange={(event) => updateNewCustomerField("code", event.target.value)}
                                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-blue-400 focus:outline-none"
                                placeholder="Optionnel"
                              />
                            </label>
                            <label className="space-y-1 text-sm sm:col-span-2 xl:col-span-2">
                              <span className="font-semibold text-slate-700">Nom (optionnel)</span>
                              <input
                                value={newCustomerForm.name}
                                onChange={(event) => updateNewCustomerField("name", event.target.value)}
                                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-blue-400 focus:outline-none"
                                placeholder="Nom du client"
                              />
                            </label>
                            <label className="space-y-1 text-sm">
                              <span className="font-semibold text-slate-700">Entreprise</span>
                              <input
                                value={newCustomerForm.companyName}
                                onChange={(event) => updateNewCustomerField("companyName", event.target.value)}
                                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-blue-400 focus:outline-none"
                                placeholder="Optionnel"
                              />
                            </label>
                            <label className="space-y-1 text-sm">
                              <span className="font-semibold text-slate-700">Telephone</span>
                              <input
                                value={newCustomerForm.phone}
                                onChange={(event) => updateNewCustomerField("phone", event.target.value)}
                                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-blue-400 focus:outline-none"
                              />
                            </label>
                            <label className="space-y-1 text-sm sm:col-span-2 xl:col-span-2">
                              <span className="font-semibold text-slate-700">Email</span>
                              <input
                                type="email"
                                value={newCustomerForm.email}
                                onChange={(event) => updateNewCustomerField("email", event.target.value)}
                                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-blue-400 focus:outline-none"
                              />
                            </label>
                            <label className="space-y-1 text-sm">
                              <span className="font-semibold text-slate-700">NIF / NINU / ID</span>
                              <input
                                value={newCustomerForm.taxNumber}
                                onChange={(event) => updateNewCustomerField("taxNumber", event.target.value)}
                                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-blue-400 focus:outline-none"
                              />
                            </label>
                          </div>
                        </div>

                        <div className="min-h-0 overflow-y-auto px-1" style={{ width: `${100 / CUSTOMER_MODAL_STEPS.length}%` }}>
                          <div className="grid gap-3 md:grid-cols-2 sm:gap-4">
                            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2.5 sm:p-4 sm:space-y-3">
                              <h4 className="text-sm font-bold text-slate-900">Adresse de facturation</h4>
                              <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
                                <label className="space-y-1 text-sm sm:col-span-2">
                                  <span className="font-semibold text-slate-700">Ligne 1</span>
                                  <input
                                    value={newCustomerForm.billingAddress.line1}
                                    onChange={(event) => updateNewCustomerAddress("billingAddress", "line1", event.target.value)}
                                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-blue-400 focus:outline-none"
                                  />
                                </label>
                                <label className="space-y-1 text-sm sm:col-span-2">
                                  <span className="font-semibold text-slate-700">Ligne 2</span>
                                  <input
                                    value={newCustomerForm.billingAddress.line2}
                                    onChange={(event) => updateNewCustomerAddress("billingAddress", "line2", event.target.value)}
                                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-blue-400 focus:outline-none"
                                  />
                                </label>
                                <label className="space-y-1 text-sm">
                                  <span className="font-semibold text-slate-700">Ville</span>
                                  <input
                                    value={newCustomerForm.billingAddress.city}
                                    onChange={(event) => updateNewCustomerAddress("billingAddress", "city", event.target.value)}
                                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-blue-400 focus:outline-none"
                                  />
                                </label>
                                <label className="space-y-1 text-sm">
                                  <span className="font-semibold text-slate-700">Etat / Departement</span>
                                  <input
                                    value={newCustomerForm.billingAddress.state}
                                    onChange={(event) => updateNewCustomerAddress("billingAddress", "state", event.target.value)}
                                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-blue-400 focus:outline-none"
                                  />
                                </label>
                                <label className="space-y-1 text-sm">
                                  <span className="font-semibold text-slate-700">Code postal</span>
                                  <input
                                    value={newCustomerForm.billingAddress.zip}
                                    onChange={(event) => updateNewCustomerAddress("billingAddress", "zip", event.target.value)}
                                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-blue-400 focus:outline-none"
                                  />
                                </label>
                                <label className="space-y-1 text-sm">
                                  <span className="font-semibold text-slate-700">Pays</span>
                                  <input
                                    value={newCustomerForm.billingAddress.country}
                                    onChange={(event) => updateNewCustomerAddress("billingAddress", "country", event.target.value)}
                                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-blue-400 focus:outline-none"
                                  />
                                </label>
                              </div>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2.5 sm:p-4 sm:space-y-3">
                              <h4 className="text-sm font-bold text-slate-900">Adresse de livraison</h4>
                              <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
                                <label className="space-y-1 text-sm sm:col-span-2">
                                  <span className="font-semibold text-slate-700">Ligne 1</span>
                                  <input
                                    value={newCustomerForm.shippingAddress.line1}
                                    onChange={(event) => updateNewCustomerAddress("shippingAddress", "line1", event.target.value)}
                                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-blue-400 focus:outline-none"
                                  />
                                </label>
                                <label className="space-y-1 text-sm sm:col-span-2">
                                  <span className="font-semibold text-slate-700">Ligne 2</span>
                                  <input
                                    value={newCustomerForm.shippingAddress.line2}
                                    onChange={(event) => updateNewCustomerAddress("shippingAddress", "line2", event.target.value)}
                                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-blue-400 focus:outline-none"
                                  />
                                </label>
                                <label className="space-y-1 text-sm">
                                  <span className="font-semibold text-slate-700">Ville</span>
                                  <input
                                    value={newCustomerForm.shippingAddress.city}
                                    onChange={(event) => updateNewCustomerAddress("shippingAddress", "city", event.target.value)}
                                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-blue-400 focus:outline-none"
                                  />
                                </label>
                                <label className="space-y-1 text-sm">
                                  <span className="font-semibold text-slate-700">Etat / Departement</span>
                                  <input
                                    value={newCustomerForm.shippingAddress.state}
                                    onChange={(event) => updateNewCustomerAddress("shippingAddress", "state", event.target.value)}
                                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-blue-400 focus:outline-none"
                                  />
                                </label>
                                <label className="space-y-1 text-sm">
                                  <span className="font-semibold text-slate-700">Code postal</span>
                                  <input
                                    value={newCustomerForm.shippingAddress.zip}
                                    onChange={(event) => updateNewCustomerAddress("shippingAddress", "zip", event.target.value)}
                                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-blue-400 focus:outline-none"
                                  />
                                </label>
                                <label className="space-y-1 text-sm">
                                  <span className="font-semibold text-slate-700">Pays</span>
                                  <input
                                    value={newCustomerForm.shippingAddress.country}
                                    onChange={(event) => updateNewCustomerAddress("shippingAddress", "country", event.target.value)}
                                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-blue-400 focus:outline-none"
                                  />
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="min-h-0 overflow-y-auto pl-1" style={{ width: `${100 / CUSTOMER_MODAL_STEPS.length}%` }}>
                          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start xl:grid-cols-[minmax(0,1fr)_300px] sm:gap-4">
                            <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
                              <label className="space-y-1 text-sm">
                                <span className="font-semibold text-slate-700">Devise</span>
                                <input
                                  value={newCustomerForm.currency}
                                  onChange={(event) => updateNewCustomerField("currency", event.target.value)}
                                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-blue-400 focus:outline-none"
                                  placeholder="HTG, USD..."
                                />
                              </label>
                              <label className="space-y-1 text-sm">
                                <span className="font-semibold text-slate-700">Delai paiement (jours)</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={newCustomerForm.paymentTermsDays}
                                  onChange={(event) => updateNewCustomerField("paymentTermsDays", event.target.value)}
                                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-blue-400 focus:outline-none"
                                />
                              </label>
                              <label className="space-y-1 text-sm">
                                <span className="font-semibold text-slate-700">Limite credit</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={newCustomerForm.creditLimit}
                                  onChange={(event) => updateNewCustomerField("creditLimit", event.target.value)}
                                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-blue-400 focus:outline-none"
                                />
                              </label>
                              <label className="space-y-1 text-sm sm:col-span-2 xl:col-span-3">
                                <span className="font-semibold text-slate-700">Notes</span>
                                <textarea
                                  value={newCustomerForm.notes}
                                  onChange={(event) => updateNewCustomerField("notes", event.target.value)}
                                  rows={4}
                                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-blue-400 focus:outline-none"
                                />
                              </label>
                            </div>

                            <IdentityDocumentField
                              file={newCustomerForm.identityDocumentFile}
                              onFileChange={(file) => updateNewCustomerField("identityDocumentFile", file)}
                              className="h-fit"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 pt-3 sm:mt-5 sm:pt-4">
                    <button
                      type="button"
                      onClick={closeCustomerModal}
                      className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Annuler
                    </button>
                    <div className="flex flex-wrap justify-end gap-2">
                      {customerModalStep > 0 ? (
                        <button
                          type="button"
                          onClick={goToPreviousCustomerStep}
                          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Precedent
                        </button>
                      ) : null}
                      {!isLastCustomerStep ? (
                        <button
                          type="button"
                          onClick={goToNextCustomerStep}
                          className="rounded-xl bg-[#0d63b8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a4d8f]"
                        >
                          Suivant
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleCreateCustomer()}
                          disabled={creatingCustomer}
                          className="rounded-xl bg-[#0d63b8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a4d8f] disabled:opacity-60"
                        >
                          {creatingCustomer ? "Enregistrement..." : "Enregistrer le client"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold text-slate-900">Liste reservations</h2>
        {!canReadReservations ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
            La liste des reservations n&apos;est pas visible avec ce profil.
          </div>
        ) : loading ? (
          <div className="mt-4 text-sm text-slate-600">Chargement...</div>
        ) : reservations.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
            Aucune reservation.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_220px_220px_auto]">
              <input
                value={reservationSearch}
                onChange={(event) => setReservationSearch(event.target.value)}
                placeholder="Rechercher client, contact, chambre, date..."
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none"
              />
              <select
                value={reservationStatusFilter}
                onChange={(event) => setReservationStatusFilter(event.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none"
              >
                <option value="">Tous les statuts</option>
                {MANUAL_RESERVATION_STATUSES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={reservationRoomFilter}
                onChange={(event) => setReservationRoomFilter(event.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none"
              >
                <option value="">Toutes les chambres</option>
                {rooms.map((room) => (
                  <option key={room.id} value={String(room.id)}>
                    {room.name} #{room.room_number}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setReservationSearch("");
                  setReservationStatusFilter("");
                  setReservationRoomFilter("");
                }}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reinitialiser
              </button>
            </div>

            {filteredReservations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                Aucune reservation ne correspond aux filtres.
              </div>
            ) : null}

            <div className="space-y-3 md:hidden">
              {filteredReservations.map((reservation, index) => (
                <div
                  key={reservation.id}
                  className={`rounded-xl border p-4 shadow-sm ${
                    index % 2 === 0 ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{reservation.guest_name}</div>
                      <div className="text-xs text-slate-500">{reservation.guest_phone || "-"}</div>
                    </div>
                    <div className="text-right text-sm font-semibold text-slate-700">
                      {formatMoney(reservation.total_amount, reservation.total_currency)}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm text-slate-700">
                    <div>
                      <span className="font-semibold text-slate-900">Chambre: </span>
                      {reservation.room?.name || "-"} #{reservation.room?.room_number || "-"}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900">Arrivee: </span>
                      {formatReservationDate(reservation.check_in)}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900">Depart: </span>
                      {formatReservationDate(reservation.check_out)}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900">Check-in: </span>
                      {formatReservationDateTime(reservation.actual_check_in_at)}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900">Check-out: </span>
                      {formatReservationDateTime(reservation.actual_check_out_at)}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-col gap-3">
                    <div>
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Statut</div>
                      {renderReservationStatusControl(reservation)}
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</div>
                      {renderReservationActions(reservation)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden max-h-[70vh] overflow-auto rounded-xl border border-slate-200 md:block">
              <table className="min-w-[1100px] bg-white text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="sticky top-0 z-10 bg-slate-100/95 px-3 py-3 pr-3 backdrop-blur">Client</th>
                    <th className="sticky top-0 z-10 bg-slate-100/95 px-3 py-3 pr-3 backdrop-blur">Chambre</th>
                    <th className="sticky top-0 z-10 bg-slate-100/95 px-3 py-3 pr-3 backdrop-blur">Periode</th>
                    <th className="sticky top-0 z-10 bg-slate-100/95 px-3 py-3 pr-3 backdrop-blur">Check-in</th>
                    <th className="sticky top-0 z-10 bg-slate-100/95 px-3 py-3 pr-3 backdrop-blur">Check-out</th>
                    <th className="sticky top-0 z-10 bg-slate-100/95 px-3 py-3 pr-3 backdrop-blur">Montant</th>
                    <th className="sticky top-0 z-10 bg-slate-100/95 px-3 py-3 pr-3 backdrop-blur">Statut</th>
                    <th className="sticky top-0 z-10 bg-slate-100/95 px-3 py-3 backdrop-blur">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReservations.map((reservation, index) => (
                    <tr
                      key={reservation.id}
                      className={`border-t border-slate-100 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/70"}`}
                    >
                      <td className="py-3 pr-3">
                        <div className="font-semibold text-slate-800">{reservation.guest_name}</div>
                        <div className="text-xs text-slate-500">{reservation.guest_phone || "-"}</div>
                      </td>
                      <td className="py-3 pr-3 text-slate-700">
                        {reservation.room?.name || "-"} #{reservation.room?.room_number || "-"}
                      </td>
                      <td className="py-3 pr-3 text-slate-700">
                        <div className="font-medium text-slate-800">
                          Arrivee: {formatReservationDate(reservation.check_in)}
                        </div>
                        <div className="text-xs text-slate-500">
                          Depart: {formatReservationDate(reservation.check_out)}
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-slate-700">
                        <div>{formatReservationDateTime(reservation.actual_check_in_at)}</div>
                      </td>
                      <td className="py-3 pr-3 text-slate-700">
                        <div>{formatReservationDateTime(reservation.actual_check_out_at)}</div>
                      </td>
                      <td className="py-3 pr-3 text-slate-700">{formatMoney(reservation.total_amount, reservation.total_currency)}</td>
                      <td className="py-3 pr-3">{renderReservationStatusControl(reservation)}</td>
                      <td className="py-3">{renderReservationActions(reservation)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {confirmationDialog ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reservation-confirmation-title"
          onClick={() => closeConfirmationDialog()}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="reservation-confirmation-title" className="text-lg font-bold text-slate-900">
              {confirmationDialog.title}
            </h3>
            <p className="mt-2 text-sm text-slate-600">{confirmationDialog.message}</p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => closeConfirmationDialog()}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Non
              </button>
              <button
                type="button"
                onClick={() => void confirmPendingAction()}
                disabled={updatingReservationId === confirmationDialog.reservationId || operationReservationId === confirmationDialog.reservationId}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                  confirmationDialog.tone === "emerald"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : confirmationDialog.tone === "orange"
                      ? "bg-orange-500 hover:bg-orange-600"
                      : confirmationDialog.tone === "red"
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-[#0d63b8] hover:bg-[#0a4d8f]"
                }`}
              >
                {confirmationDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {detailRoom ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  {detailRoom.name} #{detailRoom.room_number}
                </h3>
                <p className="text-sm text-slate-600">
                  {detailRoom.category?.name || "Sans categorie"} - {detailRoom.capacity} pers. -{" "}
                  {formatMoney(detailRoom.price_per_night, detailRoom.price_per_night_currency)}/nuit
                </p>
              </div>
              <button
                type="button"
                onClick={closeRoomDetails}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Fermer
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-2">
              {detailActiveImageUrl ? (
                <img
                  src={detailActiveImageUrl}
                  alt={`Chambre ${detailRoom.name}`}
                  className="h-72 w-full rounded-lg object-cover"
                />
              ) : (
                <div className="h-72 w-full rounded-lg bg-slate-100 flex items-center justify-center text-sm text-slate-500">
                  Pas d'image
                </div>
              )}
              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => changeDetailSlide(-1)}
                  disabled={(detailRoom.images.length ?? 0) < 2}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
                >
                  Precedent
                </button>
                <span className="text-xs text-slate-500">
                  {detailRoom.images.length === 0 ? "0/0" : `${detailActiveIndex + 1}/${detailRoom.images.length}`}
                </span>
                <button
                  type="button"
                  onClick={() => changeDetailSlide(1)}
                  disabled={(detailRoom.images.length ?? 0) < 2}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
                >
                  Suivant
                </button>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setRoomId(String(detailRoom.id));
                  closeRoomDetails();
                }}
                className="rounded-xl bg-[#0d63b8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a4d8f]"
              >
                Choisir cette chambre
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
