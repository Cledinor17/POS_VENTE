"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  BedDouble,
  ChevronLeft,
  ChevronRight,
  Eye,
  ImageIcon,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import {
  createHotelRoom,
  deleteHotelRoom,
  getHotelAmenities,
  getHotelCategories,
  getHotelNecessities,
  getHotelRooms,
  updateHotelRoom,
  type HotelAmenity,
  type HotelCategory,
  type HotelNecessity,
  type HotelRoom,
} from "@/lib/hotelApi";
import { formatMoney } from "@/lib/currency";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
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

export default function HotelRoomsPage() {
  const params = useParams<{ business: string }>();
  const business = params?.business ?? "";

  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [categories, setCategories] = useState<HotelCategory[]>([]);
  const [amenities, setAmenities] = useState<HotelAmenity[]>([]);
  const [necessities, setNecessities] = useState<HotelNecessity[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingRoomId, setUpdatingRoomId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [roomDrafts, setRoomDrafts] = useState<
    Record<number, { status: string; priceNight: string; priceMoment: string; isMoment: boolean }>
  >({});

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [detailRoom, setDetailRoom] = useState<HotelRoom | null>(null);
  const [detailSlideIndex, setDetailSlideIndex] = useState(0);

  const [name, setName] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [floor, setFloor] = useState("");
  const [capacity, setCapacity] = useState("2");
  const [status, setStatus] = useState("available");
  const [isMoment, setIsMoment] = useState(true);
  const [pricePerNight, setPricePerNight] = useState("0");
  const [pricePerMoment, setPricePerMoment] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAmenityIds, setSelectedAmenityIds] = useState<number[]>([]);
  const [selectedNecessityQty, setSelectedNecessityQty] = useState<Record<number, string>>({});
  const [imageSlots, setImageSlots] = useState<Array<File | null>>([null, null, null]);
  const imageInputRefs = useRef<Array<HTMLInputElement | null>>([null, null, null]);

  const imagePreviewUrls = useMemo(
    () =>
      imageSlots.map((file) => ({
        url: file ? URL.createObjectURL(file) : "",
      })),
    [imageSlots]
  );

  useEffect(() => {
    return () => {
      imagePreviewUrls.forEach((item) => {
        if (item.url) URL.revokeObjectURL(item.url);
      });
    };
  }, [imagePreviewUrls]);

  async function loadData() {
    if (!business) return;
    setLoading(true);
    setError("");
    try {
      const [roomsData, categoriesData, amenitiesData, necessitiesData] = await Promise.all([
        getHotelRooms(business),
        getHotelCategories(business),
        getHotelAmenities(business),
        getHotelNecessities(business),
      ]);
      setRooms(roomsData);
      setCategories(categoriesData);
      setAmenities(amenitiesData);
      setNecessities(necessitiesData);
      setRoomDrafts(() => {
        const next: Record<number, { status: string; priceNight: string; priceMoment: string; isMoment: boolean }> = {};
        roomsData.forEach((room) => {
          next[room.id] = {
            status: room.status,
            priceNight: String(room.price_per_night),
            priceMoment: room.price_per_moment > 0 ? String(room.price_per_moment) : "",
            isMoment: room.is_moment,
          };
        });
        return next;
      });
      setDetailRoom((prev) => {
        if (!prev) return null;
        const refreshed = roomsData.find((room) => room.id === prev.id);
        return refreshed ?? null;
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [business]);

  const occupiedCount = useMemo(() => rooms.filter((room) => room.status === "occupied").length, [rooms]);

  function resetCreateForm() {
    setName("");
    setRoomNumber("");
    setCategoryId("");
    setFloor("");
    setCapacity("2");
    setStatus("available");
    setIsMoment(true);
    setPricePerNight("0");
    setPricePerMoment("");
    setDescription("");
    setSelectedAmenityIds([]);
    setSelectedNecessityQty({});
    setImageSlots([null, null, null]);
  }

  function toggleAmenity(amenityId: number) {
    setSelectedAmenityIds((prev) =>
      prev.includes(amenityId) ? prev.filter((id) => id !== amenityId) : [...prev, amenityId]
    );
  }

  function toggleNecessity(necessityId: number, enabled: boolean) {
    setSelectedNecessityQty((prev) => {
      const next = { ...prev };
      if (!enabled) {
        delete next[necessityId];
      } else if (!next[necessityId]) {
        next[necessityId] = "1";
      }
      return next;
    });
  }

  function setImageAt(index: number, file: File | null) {
    setImageSlots((prev) => {
      const next = [...prev];
      next[index] = file;
      return next;
    });
  }

  function removeImageAt(index: number) {
    setImageAt(index, null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!business) return;
    if (name.trim().length < 2) {
      setError("Nom chambre obligatoire.");
      return;
    }
    if (roomNumber.trim().length < 1) {
      setError("Numero chambre obligatoire.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const necessitiesPayload = Object.entries(selectedNecessityQty)
        .map(([necessityId, quantity]) => ({ necessityId: Number(necessityId), quantity: Number(quantity || "1") }))
        .filter((item) => item.necessityId > 0 && item.quantity > 0);

      const images = imageSlots.filter((file): file is File => file instanceof File);

      await createHotelRoom(business, {
        name: name.trim(),
        roomNumber: roomNumber.trim(),
        categoryId: categoryId ? Number(categoryId) : null,
        floor: floor.trim(),
        capacity: Number(capacity || 1),
        status,
        isMoment,
        pricePerNight: Number(pricePerNight || 0),
        pricePerMoment: pricePerMoment.trim() !== "" ? Number(pricePerMoment) : undefined,
        description: description.trim(),
        amenityIds: selectedAmenityIds,
        necessities: necessitiesPayload,
        images,
      });

      resetCreateForm();
      setIsCreateModalOpen(false);
      setSuccess("Chambre ajoutee.");
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(roomId: number) {
    if (!business) return;
    if (!window.confirm("Supprimer cette chambre ?")) return;
    setError("");
    setSuccess("");
    try {
      await deleteHotelRoom(business, roomId);
      setSuccess("Chambre supprimee.");
      if (detailRoom?.id === roomId) {
        setDetailRoom(null);
        setDetailSlideIndex(0);
      }
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleRoomSave(room: HotelRoom) {
    if (!business) return;
    const draft = roomDrafts[room.id];
    if (!draft) return;

    const nextStatus = draft.status || room.status;
    const nextPriceNight = Number(draft.priceNight || room.price_per_night);
    const nextPriceMoment = draft.priceMoment.trim() === "" ? 0 : Number(draft.priceMoment);
    const nextIsMoment = draft.isMoment;
    const statusChanged = nextStatus !== room.status;
    const priceNightChanged = Number.isFinite(nextPriceNight) && nextPriceNight !== room.price_per_night;
    const priceMomentChanged = Number.isFinite(nextPriceMoment) && nextPriceMoment !== room.price_per_moment;
    const isMomentChanged = nextIsMoment !== room.is_moment;
    if (!statusChanged && !priceNightChanged && !priceMomentChanged && !isMomentChanged) return;

    setUpdatingRoomId(room.id);
    setError("");
    setSuccess("");
    try {
      await updateHotelRoom(business, room.id, {
        status: nextStatus,
        isMoment: nextIsMoment,
        pricePerNight: Number.isFinite(nextPriceNight) ? nextPriceNight : room.price_per_night,
        pricePerMoment: Number.isFinite(nextPriceMoment) ? nextPriceMoment : room.price_per_moment,
      });
      setSuccess("Chambre mise a jour.");
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUpdatingRoomId(null);
    }
  }

  function openRoomDetails(room: HotelRoom) {
    setDetailRoom(room);
    setDetailSlideIndex(0);
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

  const detailHasImages = (detailRoom?.images.length ?? 0) > 0;
  const detailActiveIndex = detailHasImages ? Math.min(detailSlideIndex, (detailRoom?.images.length ?? 1) - 1) : 0;
  const detailActiveImage = detailHasImages && detailRoom ? detailRoom.images[detailActiveIndex] : null;
  const detailActiveImageUrl = detailActiveImage
    ? resolveImageUrl(detailActiveImage.image_path, detailActiveImage.image_url)
    : "";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Hotel - Chambres</h1>
            <p className="mt-1 text-sm text-slate-600">Affichage en tableau, creation en modal, details avec slideshow.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0d63b8] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0a4d8f]"
            >
              <Plus className="h-4 w-4" />
              Nouvelle chambre
            </button>
            <Link
              href={business ? `/${business}/hotel` : "/"}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Retour module hotel
            </Link>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total chambres</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">{rooms.length}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Occupees</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">{occupiedCount}</div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold text-slate-900">Liste chambres</h2>
        {loading ? (
          <div className="mt-4 text-sm text-slate-600">Chargement...</div>
        ) : rooms.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
            Aucune chambre enregistree.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2 pr-3">Chambre</th>
                  <th className="py-2 pr-3">Apercu</th>
                  <th className="py-2 pr-3">Categorie</th>
                  <th className="py-2 pr-3">Etage</th>
                  <th className="py-2 pr-3">Capacite</th>
                  <th className="py-2 pr-3">Prix/nuit</th>
                  <th className="py-2 pr-3">Prix/moment</th>
                  <th className="py-2 pr-3">Statut</th>
                  <th className="py-2 pr-3">Moments</th>
                  <th className="py-2 pr-3">Images</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => {
                  const previewImage = room.images[0] ?? null;
                  const previewUrl = previewImage
                    ? resolveImageUrl(previewImage.image_path, previewImage.image_url)
                    : "";

                  return (
                    <tr key={room.id} className="border-t border-slate-100">
                      <td className="py-2 pr-3 text-slate-800 font-semibold">
                        {room.name} #{room.room_number}
                      </td>
                      <td className="py-2 pr-3">
                        {previewUrl ? (
                          <img
                            src={previewUrl}
                            alt={`Apercu ${room.name}`}
                            className="h-12 w-16 rounded-md border border-slate-200 object-cover"
                          />
                        ) : (
                          <div className="inline-flex h-12 w-16 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500">
                            <ImageIcon className="h-4 w-4" />
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-slate-700">{room.category?.name || "Sans categorie"}</td>
                      <td className="py-2 pr-3 text-slate-700">{room.floor || "-"}</td>
                      <td className="py-2 pr-3 text-slate-700">{room.capacity}</td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={roomDrafts[room.id]?.priceNight ?? String(room.price_per_night)}
                          onChange={(event) =>
                            setRoomDrafts((prev) => ({
                              ...prev,
                              [room.id]: {
                                status: prev[room.id]?.status ?? room.status,
                                priceNight: event.target.value,
                                priceMoment: prev[room.id]?.priceMoment ?? (room.price_per_moment > 0 ? String(room.price_per_moment) : ""),
                                isMoment: prev[room.id]?.isMoment ?? room.is_moment,
                              },
                            }))
                          }
                          className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                        />
                        <div className="mt-1 text-[11px] text-slate-500">{room.price_per_night_currency}</div>
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={roomDrafts[room.id]?.priceMoment ?? (room.price_per_moment > 0 ? String(room.price_per_moment) : "")}
                          onChange={(event) =>
                            setRoomDrafts((prev) => ({
                              ...prev,
                              [room.id]: {
                                status: prev[room.id]?.status ?? room.status,
                                priceNight: prev[room.id]?.priceNight ?? String(room.price_per_night),
                                priceMoment: event.target.value,
                                isMoment: prev[room.id]?.isMoment ?? room.is_moment,
                              },
                            }))
                          }
                          placeholder="Optionnel"
                          className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                        />
                        <div className="mt-1 text-[11px] text-slate-500">{room.price_per_moment_currency}</div>
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          value={roomDrafts[room.id]?.status ?? room.status}
                          onChange={(event) =>
                            setRoomDrafts((prev) => ({
                              ...prev,
                              [room.id]: {
                                status: event.target.value,
                                priceNight: prev[room.id]?.priceNight ?? String(room.price_per_night),
                                priceMoment: prev[room.id]?.priceMoment ?? (room.price_per_moment > 0 ? String(room.price_per_moment) : ""),
                                isMoment: prev[room.id]?.isMoment ?? room.is_moment,
                              },
                            }))
                          }
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                        >
                          <option value="available">Disponible</option>
                          <option value="reserved">Reservee</option>
                          <option value="occupied">Occupee</option>
                          <option value="cleaning">Nettoyage</option>
                          <option value="maintenance">Maintenance</option>
                        </select>
                      </td>
                      <td className="py-2 pr-3">
                        <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                          <input
                            type="checkbox"
                            checked={roomDrafts[room.id]?.isMoment ?? room.is_moment}
                            onChange={(event) =>
                              setRoomDrafts((prev) => ({
                                ...prev,
                                [room.id]: {
                                  status: prev[room.id]?.status ?? room.status,
                                  priceNight: prev[room.id]?.priceNight ?? String(room.price_per_night),
                                  priceMoment: prev[room.id]?.priceMoment ?? (room.price_per_moment > 0 ? String(room.price_per_moment) : ""),
                                  isMoment: event.target.checked,
                                },
                              }))
                            }
                            className="h-4 w-4 rounded border-slate-300 text-[#0d63b8] focus:ring-[#0d63b8]"
                          />
                          <span>{(roomDrafts[room.id]?.isMoment ?? room.is_moment) ? "Autorise" : "Bloque"}</span>
                        </label>
                      </td>
                      <td className="py-2 pr-3 text-slate-700">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                          <ImageIcon className="h-3.5 w-3.5" />
                          {room.images.length}
                        </span>
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => void handleRoomSave(room)}
                            disabled={updatingRoomId === room.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                          >
                            <Save className="h-3.5 w-3.5" />
                            {updatingRoomId === room.id ? "..." : "Sauver"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openRoomDetails(room)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Details
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(room.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
          <div className="w-full max-w-5xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div className="inline-flex items-center gap-2 text-slate-900">
                <BedDouble className="h-5 w-5 text-[#0d63b8]" />
                <h2 className="text-lg font-bold">Nouvelle chambre</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Nom</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                    placeholder="Suite Ocean"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Numero</span>
                  <input
                    value={roomNumber}
                    onChange={(event) => setRoomNumber(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                    placeholder="305"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Categorie</span>
                  <select
                    value={categoryId}
                    onChange={(event) => setCategoryId(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                  >
                    <option value="">Sans categorie</option>
                    {categories.map((category) => (
                      <option key={category.id} value={String(category.id)}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-6">
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Etage</span>
                  <input
                    value={floor}
                    onChange={(event) => setFloor(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                    placeholder="3e"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Capacite</span>
                  <input
                    type="number"
                    min="1"
                    value={capacity}
                    onChange={(event) => setCapacity(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Prix / nuit (USD)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={pricePerNight}
                    onChange={(event) => setPricePerNight(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Prix / moment (HTG)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={pricePerMoment}
                    onChange={(event) => setPricePerMoment(event.target.value)}
                    placeholder="Optionnel"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Statut</span>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                  >
                    <option value="available">Disponible</option>
                    <option value="reserved">Reservee</option>
                    <option value="occupied">Occupee</option>
                    <option value="cleaning">Nettoyage</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </label>
                <label className="flex items-end">
                  <span className="inline-flex w-full items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={isMoment}
                      onChange={(event) => setIsMoment(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[#0d63b8] focus:ring-[#0d63b8]"
                    />
                    <span className="font-semibold">Accepte les moments</span>
                  </span>
                </label>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-700">Images (optionnel)</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {Array.from({ length: 3 }, (_, index) => {
                    const preview = imagePreviewUrls[index]?.url || "";
                    return (
                      <div
                        key={`preview-${index}`}
                        className="relative h-28 overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                      >
                        <input
                          ref={(el) => {
                            imageInputRefs.current[index] = el;
                          }}
                          type="file"
                          accept="image/*"
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            if (file) setImageAt(index, file);
                            event.currentTarget.value = "";
                          }}
                          className="hidden"
                        />
                        {preview ? (
                          <>
                            <img
                              src={preview}
                              alt={`Preview ${index + 1}`}
                              className="h-full w-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeImageAt(index)}
                              className="absolute right-1 top-1 rounded-md bg-white/90 p-1 text-slate-700 hover:bg-white"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => imageInputRefs.current[index]?.click()}
                            className="flex h-full w-full items-center justify-center text-slate-500 hover:bg-slate-100"
                          >
                            <span className="inline-flex items-center gap-1 text-xs font-semibold">
                              <Plus className="h-3.5 w-3.5" />
                              Ajouter
                            </span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <span className="text-xs text-slate-500">
                  {imageSlots.filter((file) => file !== null).length}/3 image(s) selectionnee(s)
                </span>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="text-sm font-semibold text-slate-700">Accessoires</div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {amenities.map((amenity) => (
                      <label key={amenity.id} className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={selectedAmenityIds.includes(amenity.id)}
                          onChange={() => toggleAmenity(amenity.id)}
                        />
                        <span>{amenity.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="text-sm font-semibold text-slate-700">Necessaires (quantite)</div>
                  <div className="mt-2 space-y-2">
                    {necessities.map((necessity) => {
                      const enabled = selectedNecessityQty[necessity.id] !== undefined;
                      return (
                        <div key={necessity.id} className="flex items-center gap-2">
                          <label className="inline-flex items-center gap-2 text-sm text-slate-700 min-w-[180px]">
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={(event) => toggleNecessity(necessity.id, event.target.checked)}
                            />
                            <span>{necessity.name}</span>
                          </label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            disabled={!enabled}
                            value={selectedNecessityQty[necessity.id] ?? "1"}
                            onChange={(event) =>
                              setSelectedNecessityQty((prev) => ({ ...prev, [necessity.id]: event.target.value }))
                            }
                            className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <label className="space-y-1 text-sm block">
                <span className="font-semibold text-slate-700">Description</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
                />
              </label>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#0d63b8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a4d8f] disabled:opacity-60"
                >
                  {saving ? "Enregistrement..." : "Ajouter chambre"}
                </button>
              </div>
            </form>
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
                  {detailRoom.price_per_moment > 0 ? ` - ${formatMoney(detailRoom.price_per_moment, detailRoom.price_per_moment_currency)}/moment` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={closeRoomDetails}
                className="rounded-lg border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
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
                  disabled={detailRoom.images.length < 2}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Precedent
                </button>
                <span className="text-xs text-slate-500">
                  {detailRoom.images.length === 0 ? "0/0" : `${detailActiveIndex + 1}/${detailRoom.images.length}`}
                </span>
                <button
                  type="button"
                  onClick={() => changeDetailSlide(1)}
                  disabled={detailRoom.images.length < 2}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
                >
                  Suivant
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
              <div>Etage: {detailRoom.floor || "-"}</div>
              <div>Statut: {detailRoom.status || "-"}</div>
              <div>Prix/moment: {detailRoom.price_per_moment > 0 ? formatMoney(detailRoom.price_per_moment, detailRoom.price_per_moment_currency) : "-"}</div>
              <div>Moments: {detailRoom.is_moment ? "Autorises" : "Non autorises"}</div>
            </div>
            {detailRoom.description ? <p className="mt-2 text-sm text-slate-700">{detailRoom.description}</p> : null}
            {detailRoom.amenities.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1">
                {detailRoom.amenities.map((amenity) => (
                  <span
                    key={amenity.id}
                    className="rounded-full bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-700"
                  >
                    {amenity.name}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
