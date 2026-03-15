"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { hasPermission } from "@/lib/businessAccess";
import { getBusinessSettings, type BusinessSettings } from "@/lib/businessApi";
import IdentityDocumentField from "@/components/IdentityDocumentField";
import { convertAmount, formatMoney } from "@/lib/currency";
import {
  createHotelMoment,
  deleteHotelMoment,
  extractHotelMomentIdentityDocument,
  getHotelMoments,
  getHotelReservations,
  getHotelRooms,
  updateHotelMoment,
  type HotelMoment,
  type HotelReservation,
  type HotelRoom,
} from "@/lib/hotelApi";
import { useBusinessPermissions } from "@/lib/useBusinessPermissions";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

function toInputDateTime(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function getCurrentLocalDateTimeInput(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function parseDateOnly(value: string): Date | null {
  if (!value) return null;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (year <= 0 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(year, month - 1, day);
}

function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && endA > startB;
}

function getMomentDefaultAmount(room: HotelRoom | null, businessSettings: BusinessSettings | null): number {
  if (!room) return 0;
  if (room.price_per_moment > 0) return Number(room.price_per_moment.toFixed(2));
  return convertAmount(room.price_per_night / 12, room.price_per_night_currency, room.price_per_moment_currency, {
    exchangeRateDirection: businessSettings?.exchange_rate_direction,
    exchangeRateValue: businessSettings?.exchange_rate_value,
  });
}

type MomentConfirmationState =
  | {
      kind: "status";
      momentId: number;
      previousStatus: string;
      nextStatus: string;
      title: string;
      message: string;
      confirmLabel: string;
      tone: "blue" | "emerald" | "orange" | "red";
    }
  | {
      kind: "delete";
      momentId: number;
      title: string;
      message: string;
      confirmLabel: string;
      tone: "red";
    };

const MOMENT_STATUS_OPTIONS = [
  { value: "ongoing", label: "Check-in" },
  { value: "completed", label: "Check-out" },
] as const;

function getMomentStatusLabel(status: string): string {
  if (status === "pending") return "En attente";
  if (status === "confirmed") return "Confirmed";
  if (status === "ongoing") return "Check-in";
  if (status === "completed") return "Check-out";
  if (status === "cancelled") return "Annule";
  return status;
}

function getMomentStatusConfirmation(nextStatus: string) {
  if (nextStatus === "ongoing") {
    return {
      title: "Confirmer le check-in du moment",
      message: "Cette action demarre le moment et passe la chambre en occupation. Veux-tu continuer ?",
      confirmLabel: "Oui, faire le check-in",
      tone: "blue" as const,
    };
  }

  if (nextStatus === "completed") {
    return {
      title: "Confirmer le check-out du moment",
      message:
        "Cette action termine le moment, passe la chambre en nettoyage et ajoute une tache housekeeping en attente. Veux-tu continuer ?",
      confirmLabel: "Oui, faire le check-out",
      tone: "emerald" as const,
    };
  }

  if (nextStatus === "cancelled") {
    return {
      title: "Confirmer l'annulation",
      message: "Cette action annule le moment et libere la chambre. Veux-tu continuer ?",
      confirmLabel: "Oui, annuler le moment",
      tone: "orange" as const,
    };
  }

  return {
    title: "Confirmer le changement de statut",
    message: "Cette action met le moment a jour et la chambre restera occupee. Veux-tu continuer ?",
    confirmLabel: "Oui, confirmer",
    tone: "blue" as const,
  };
}

export default function HotelMomentsPage() {
  const params = useParams<{ business: string }>();
  const business = params?.business ?? "";
  const { loading: permissionsLoading, permissions: currentPermissions } = useBusinessPermissions(business);

  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [moments, setMoments] = useState<HotelMoment[]>([]);
  const [reservations, setReservations] = useState<HotelReservation[]>([]);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingMomentId, setUpdatingMomentId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [statusDrafts, setStatusDrafts] = useState<Record<number, string>>({});
  const [confirmationDialog, setConfirmationDialog] = useState<MomentConfirmationState | null>(null);

  const [roomId, setRoomId] = useState("");
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestLastName, setGuestLastName] = useState("");
  const [guestAddress, setGuestAddress] = useState("");
  const [guestDocumentNumber, setGuestDocumentNumber] = useState("");
  const [startAt, setStartAt] = useState(() => getCurrentLocalDateTimeInput());
  const [totalAmount, setTotalAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [identityDocumentFile, setIdentityDocumentFile] = useState<File | null>(null);
  const [importingIdentity, setImportingIdentity] = useState(false);
  const [identityImportError, setIdentityImportError] = useState("");
  const [identityImportSuccess, setIdentityImportSuccess] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const canReadMoments = hasPermission(currentPermissions, ["moments.read", "moments.manage"]);
  const canCreateMoments = hasPermission(currentPermissions, ["moments.create", "moments.manage"]);
  const canEditMoments = hasPermission(currentPermissions, ["moments.edit", "moments.manage"]);
  const canManageMoments = hasPermission(currentPermissions, "moments.manage");
  const hasMomentAccess = canReadMoments || canCreateMoments || canEditMoments || canManageMoments;
  const isMomentsReadOnly = canReadMoments && !canCreateMoments && !canEditMoments && !canManageMoments;

  const selectedStartAt = useMemo(() => {
    if (!startAt) return null;
    const parsed = new Date(startAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [startAt]);

  const availableRooms = useMemo(() => {
    if (!selectedStartAt) return [];
    const momentEndAt = new Date(selectedStartAt.getTime() + 120 * 60 * 1000);

    return rooms.filter((room) => {
      if (!room.is_active) return false;
      if (!room.is_moment) return false;
      if (room.status !== "available") return false;

      const hasMomentOverlap = moments.some((moment) => {
        if (moment.room_id !== room.id) return false;
        if (!["pending", "confirmed", "ongoing"].includes(moment.status)) return false;
        const momentStart = new Date(moment.start_at);
        const momentEnd = new Date(moment.end_at);
        if (Number.isNaN(momentStart.getTime()) || Number.isNaN(momentEnd.getTime())) return false;
        return rangesOverlap(selectedStartAt, momentEndAt, momentStart, momentEnd);
      });

      if (hasMomentOverlap) return false;

      const hasReservationOverlap = reservations.some((reservation) => {
        if (reservation.room_id !== room.id) return false;
        if (!["pending", "confirmed", "checked_in"].includes(reservation.status)) return false;
        const reservationStart = parseDateOnly(reservation.check_in);
        const reservationEnd = parseDateOnly(reservation.check_out);
        if (!reservationStart || !reservationEnd) return false;
        return rangesOverlap(selectedStartAt, momentEndAt, reservationStart, reservationEnd);
      });

      return !hasReservationOverlap;
    });
  }, [moments, reservations, rooms, selectedStartAt]);

  const selectedRoom = useMemo(
    () => availableRooms.find((room) => String(room.id) === roomId) ?? null,
    [availableRooms, roomId]
  );
  const selectedRoomMomentAmount = useMemo(
    () => getMomentDefaultAmount(selectedRoom, businessSettings),
    [businessSettings, selectedRoom]
  );

  async function loadData() {
    if (!business || permissionsLoading) return;
    if (!canReadMoments) {
      setRooms([]);
      setMoments([]);
      setReservations([]);
      setBusinessSettings(null);
      setStatusDrafts({});
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [roomsData, momentsData, reservationsData, businessSettingsData] = await Promise.all([
        getHotelRooms(business),
        getHotelMoments(business),
        getHotelReservations(business),
        getBusinessSettings(business),
      ]);
      setRooms(roomsData);
      setMoments(momentsData);
      setReservations(reservationsData);
      setBusinessSettings(businessSettingsData);
      setStatusDrafts(() => {
        const next: Record<number, string> = {};
        momentsData.forEach((moment) => {
          next[moment.id] = moment.status;
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
  }, [business, canReadMoments, permissionsLoading]);

  useEffect(() => {
    if (!roomId) return;
    const selectedStillAvailable = availableRooms.some((room) => String(room.id) === roomId);
    if (!selectedStillAvailable) {
      setRoomId("");
      setTotalAmount("");
    }
  }, [availableRooms, roomId]);

  useEffect(() => {
    if (!isCreateModalOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsCreateModalOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCreateModalOpen]);

  function resetCreateForm() {
    setRoomId("");
    setGuestFirstName("");
    setGuestLastName("");
    setGuestAddress("");
    setGuestDocumentNumber("");
    setStartAt(getCurrentLocalDateTimeInput());
    setTotalAmount("");
    setNotes("");
    setIdentityDocumentFile(null);
    setImportingIdentity(false);
    setIdentityImportError("");
    setIdentityImportSuccess("");
  }

  function openCreateModal() {
    if (!canCreateMoments) return;
    resetCreateForm();
    setError("");
    setSuccess("");
    setIsCreateModalOpen(true);
  }

  function closeCreateModal() {
    setError("");
    setIsCreateModalOpen(false);
  }

  function handleRoomSelection(nextRoomId: string) {
    setRoomId(nextRoomId);
    const nextRoom = availableRooms.find((room) => String(room.id) === nextRoomId) ?? null;
    setTotalAmount(nextRoom ? getMomentDefaultAmount(nextRoom, businessSettings).toFixed(2) : "");
  }

  function handleIdentityDocumentChange(file: File | null) {
    setIdentityDocumentFile(file);
    setIdentityImportError("");
    setIdentityImportSuccess("");
  }

  async function handleIdentityImport() {
    if (!business) return;
    if (!identityDocumentFile) {
      setIdentityImportError("Ajoute d'abord une piece d'identite.");
      setIdentityImportSuccess("");
      return;
    }

    setImportingIdentity(true);
    setIdentityImportError("");
    setIdentityImportSuccess("");
    try {
      const extracted = await extractHotelMomentIdentityDocument(business, identityDocumentFile);
      const hasImportedData =
        extracted.lastName.trim() !== "" ||
        extracted.firstName.trim() !== "" ||
        extracted.address.trim() !== "" ||
        extracted.documentNumber.trim() !== "";

      if (!hasImportedData) {
        setIdentityImportError("Aucune information exploitable n'a ete detectee sur cette piece.");
        return;
      }

      if (extracted.lastName.trim() !== "") {
        setGuestLastName(extracted.lastName);
      }
      if (extracted.firstName.trim() !== "") {
        setGuestFirstName(extracted.firstName);
      }
      if (extracted.address.trim() !== "") {
        setGuestAddress(extracted.address);
      }
      if (extracted.documentNumber.trim() !== "") {
        setGuestDocumentNumber(extracted.documentNumber);
      }

      setIdentityImportSuccess("Informations importees. Verifie les champs avant d'enregistrer.");
    } catch (err) {
      setIdentityImportError(getErrorMessage(err));
    } finally {
      setImportingIdentity(false);
    }
  }

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!business) return;
    if (!canCreateMoments) {
      setError("Tu n'as pas l'autorisation d'ajouter un moment.");
      return;
    }
    if (!roomId) {
      setError("Selectionne une chambre.");
      return;
    }
    if (guestLastName.trim().length === 0 && guestFirstName.trim().length === 0) {
      setError("Nom ou prenom obligatoire.");
      return;
    }
    if (!startAt) {
      setError("Date/heure debut obligatoire.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await createHotelMoment(business, {
        roomId: Number(roomId),
        guestFirstName: guestFirstName.trim(),
        guestLastName: guestLastName.trim(),
        guestAddress: guestAddress.trim(),
        guestDocumentNumber: guestDocumentNumber.trim(),
        startAt: new Date(startAt).toISOString(),
        totalAmount: totalAmount.trim() !== "" ? Number(totalAmount) : undefined,
        notes: notes.trim(),
        identityDocumentFile,
      });
      resetCreateForm();
      setIsCreateModalOpen(false);
      setSuccess("Moment 2h ajoute.");
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(momentId: number) {
    if (!business || !canManageMoments) return;
    setError("");
    setSuccess("");
    try {
      await deleteHotelMoment(business, momentId);
      setSuccess("Moment supprime.");
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleStatusSave(moment: HotelMoment): Promise<boolean> {
    if (!business || !canEditMoments) return false;
    const nextStatus = statusDrafts[moment.id] ?? moment.status;
    if (nextStatus === moment.status) return true;

    setUpdatingMomentId(moment.id);
    setError("");
    setSuccess("");
    try {
      await updateHotelMoment(business, moment.id, { status: nextStatus });
      setSuccess(
        nextStatus === "completed"
          ? "Check-out du moment enregistre. Chambre passee en nettoyage et housekeeping en attente."
          : nextStatus === "ongoing"
            ? "Check-in du moment enregistre."
            : "Statut moment mis a jour."
      );
      await loadData();
      return true;
    } catch (err) {
      setError(getErrorMessage(err));
      return false;
    } finally {
      setUpdatingMomentId(null);
    }
  }

  function closeConfirmationDialog() {
    setConfirmationDialog((current) => {
      if (current?.kind === "status") {
        setStatusDrafts((prev) => ({
          ...prev,
          [current.momentId]: current.previousStatus,
        }));
      }
      return null;
    });
  }

  function requestStatusConfirmation(moment: HotelMoment, nextStatus?: string) {
    if (!canEditMoments) return;
    const resolvedNextStatus = nextStatus ?? statusDrafts[moment.id] ?? moment.status;
    if (resolvedNextStatus === moment.status) return;

    const details = getMomentStatusConfirmation(resolvedNextStatus);
    setConfirmationDialog({
      kind: "status",
      momentId: moment.id,
      previousStatus: moment.status,
      nextStatus: resolvedNextStatus,
      title: details.title,
      message: details.message,
      confirmLabel: details.confirmLabel,
      tone: details.tone,
    });
  }

  function handleStatusChange(moment: HotelMoment, nextStatus: string) {
    setStatusDrafts((prev) => ({
      ...prev,
      [moment.id]: nextStatus,
    }));

    if (nextStatus === moment.status) {
      return;
    }

    requestStatusConfirmation(moment, nextStatus);
  }

  function requestDeleteConfirmation(moment: HotelMoment) {
    if (!canManageMoments) return;
    setConfirmationDialog({
      kind: "delete",
      momentId: moment.id,
      title: "Confirmer la suppression",
      message:
        "Veux-tu vraiment supprimer ce moment ? La chambre sera re-evaluee automatiquement apres la suppression.",
      confirmLabel: "Oui, supprimer",
      tone: "red",
    });
  }

  async function confirmPendingAction() {
    if (!confirmationDialog) return;

    if (confirmationDialog.kind === "status") {
      const moment = moments.find((item) => item.id === confirmationDialog.momentId);
      if (!moment) {
        closeConfirmationDialog();
        return;
      }
      const saved = await handleStatusSave(moment);
      if (saved) {
        setConfirmationDialog(null);
      } else {
        closeConfirmationDialog();
      }
      return;
    }

    await handleDelete(confirmationDialog.momentId);
    setConfirmationDialog(null);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Hotel - Moments (2h)</h1>
            <p className="mt-1 text-sm text-slate-600">Reservation rapide de chambre pour 120 minutes.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canCreateMoments ? (
              <button
                type="button"
                onClick={openCreateModal}
                className="rounded-xl bg-[#0d63b8] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0a4d8f]"
              >
                Nouveau moment
              </button>
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
      {!permissionsLoading && !hasMomentAccess ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Ce profil n&apos;a pas encore d&apos;acces au module moments.
        </div>
      ) : null}
      {!permissionsLoading && !canReadMoments && canCreateMoments ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Ce profil peut lancer un moment, mais il ne voit pas la liste complete des moments.
        </div>
      ) : null}
      {!permissionsLoading && isMomentsReadOnly ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Acces en lecture seule: le suivi reste visible, mais les changements et suppressions sont masques.
        </div>
      ) : null}

      {isCreateModalOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="moment-modal-title"
          onClick={closeCreateModal}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 id="moment-modal-title" className="text-lg font-bold text-slate-900">
                  Nouveau moment (2h)
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Choisis la chambre, charge la piece du client si besoin, puis confirme le montant du moment.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Fermer
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              ) : null}
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Chambre libre et propre</span>
                  <select
                    value={roomId}
                    onChange={(event) => handleRoomSelection(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                  >
                    <option value="">Selectionner</option>
                    {availableRooms.map((room) => (
                      <option key={room.id} value={String(room.id)}>
                        {room.name} #{room.room_number} - {formatMoney(getMomentDefaultAmount(room, businessSettings), room.price_per_moment_currency)}/moment
                      </option>
                    ))}
                  </select>
                  {selectedStartAt && availableRooms.length === 0 ? (
                    <p className="text-xs text-amber-700">
                      Aucune chambre libre, propre et active pour moments sur ce creneau. Les chambres de sejour ou desactivees pour moments sont exclues.
                    </p>
                  ) : null}
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Debut</span>
                  <input
                    type="datetime-local"
                    value={startAt}
                    onChange={(event) => setStartAt(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                  />
                </label>
              </div>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
                <div className="space-y-3">
                  <IdentityDocumentField
                    file={identityDocumentFile}
                    onFileChange={handleIdentityDocumentChange}
                    title="Piece du client"
                    description="Televerse la piece ou prends une photo, puis utilise l'import automatique pour remplir les champs."
                    className="h-fit"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleIdentityImport()}
                      disabled={!identityDocumentFile || importingIdentity}
                      className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {importingIdentity ? "Import en cours..." : "Importer les informations"}
                    </button>
                  </div>
                  {identityImportError ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                      {identityImportError}
                    </div>
                  ) : null}
                  {identityImportSuccess ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      {identityImportSuccess}
                    </div>
                  ) : null}
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="font-semibold text-slate-900">Import auto</div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    L'import lit la piece pour proposer le nom, le prenom, l'adresse et le numero du document. Verifie toujours le resultat avant validation.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Nom</span>
                  <input
                    value={guestLastName}
                    onChange={(event) => setGuestLastName(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Prenom</span>
                  <input
                    value={guestFirstName}
                    onChange={(event) => setGuestFirstName(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                  />
                </label>
                <label className="space-y-1 text-sm md:col-span-2">
                  <span className="font-semibold text-slate-700">Adresse</span>
                  <input
                    value={guestAddress}
                    onChange={(event) => setGuestAddress(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Numero de piece</span>
                  <input
                    value={guestDocumentNumber}
                    onChange={(event) => setGuestDocumentNumber(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                  />
                </label>
              </div>
              {selectedRoom ? (
                <div className="grid gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900 md:grid-cols-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Chambre choisie</div>
                    <div className="mt-1 font-semibold">
                      {selectedRoom.name} #{selectedRoom.room_number}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Prix / moment</div>
                    <div className="mt-1 font-semibold">
                      {formatMoney(selectedRoomMomentAmount, selectedRoom.price_per_moment_currency)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Base de calcul</div>
                    <div className="mt-1">
                      {selectedRoom.price_per_moment > 0
                        ? "Prix moment defini sur la chambre"
                        : `Fallback depuis prix/nuit: ${formatMoney(selectedRoom.price_per_night, selectedRoom.price_per_night_currency)}`}
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Montant</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={totalAmount}
                    onChange={(event) => setTotalAmount(event.target.value)}
                    placeholder="Montant du moment"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                  />
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
              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#0d63b8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a4d8f] disabled:opacity-60"
                >
                  {saving ? "Enregistrement..." : "Ajouter moment 2h"}
                </button>
              </div>
            </form>
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
        <h2 className="text-lg font-bold text-slate-900">Liste moments</h2>
        {!canReadMoments ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
            La liste des moments n&apos;est pas visible avec ce profil.
          </div>
        ) : loading ? (
          <div className="mt-4 text-sm text-slate-600">Chargement...</div>
        ) : moments.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
            Aucun moment enregistre.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2 pr-3">Client</th>
                  <th className="py-2 pr-3">Chambre</th>
                  <th className="py-2 pr-3">Debut</th>
                  <th className="py-2 pr-3">Fin</th>
                  <th className="py-2 pr-3">Montant</th>
                  <th className="py-2 pr-3">Statut</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {moments.map((moment) => (
                  <tr key={moment.id} className="border-t border-slate-100">
                    <td className="py-2 pr-3">
                      <div className="font-semibold text-slate-800">{moment.guest_name}</div>
                      <div className="text-xs text-slate-500">
                        {moment.guest_document_number
                          ? `Piece: ${moment.guest_document_number}`
                          : moment.guest_address || "-"}
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-slate-700">
                      {moment.room?.name || "-"} #{moment.room?.room_number || "-"}
                    </td>
                    <td className="py-2 pr-3 text-slate-700">{toInputDateTime(moment.start_at).replace("T", " ")}</td>
                    <td className="py-2 pr-3 text-slate-700">{toInputDateTime(moment.end_at).replace("T", " ")}</td>
                    <td className="py-2 pr-3 text-slate-700">{formatMoney(moment.total_amount, moment.total_currency)}</td>
                    <td className="py-2 pr-3">
                      {(() => {
                        const currentStatus = statusDrafts[moment.id] ?? moment.status;
                        const isSelectable = MOMENT_STATUS_OPTIONS.some((option) => option.value === currentStatus);
                        const isLockedStatus = moment.status === "completed" || moment.status === "cancelled";

                        return (
                          <select
                            value={isSelectable ? currentStatus : ""}
                            onChange={(event) => handleStatusChange(moment, event.target.value)}
                            disabled={isLockedStatus || !canEditMoments || updatingMomentId === moment.id}
                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none disabled:opacity-60"
                          >
                            {!isSelectable ? (
                              <option value="" disabled>
                                {getMomentStatusLabel(currentStatus)}
                              </option>
                            ) : null}
                            {MOMENT_STATUS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        );
                      })()}
                    </td>
                    <td className="py-2">
                      {canManageMoments ? (
                        <button
                          type="button"
                          onClick={() => requestDeleteConfirmation(moment)}
                          disabled={updatingMomentId === moment.id}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          Supprimer
                        </button>
                      ) : !canEditMoments ? (
                        <span className="text-xs text-slate-400">Lecture seule</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmationDialog ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="moment-confirmation-title"
          onClick={closeConfirmationDialog}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="moment-confirmation-title" className="text-lg font-bold text-slate-900">
              {confirmationDialog.title}
            </h3>
            <p className="mt-2 text-sm text-slate-600">{confirmationDialog.message}</p>
            {confirmationDialog.kind === "status" ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Mention: le statut passe vers <span className="font-semibold">{getMomentStatusLabel(confirmationDialog.nextStatus)}</span>.
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Mention: cette action supprime definitivement le moment.
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeConfirmationDialog}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Non
              </button>
              <button
                type="button"
                onClick={() => void confirmPendingAction()}
                disabled={updatingMomentId === confirmationDialog.momentId}
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
    </div>
  );
}
