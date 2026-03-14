"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  getHotelMoments,
  getHotelReservations,
  getHotelRooms,
  type HotelMoment,
  type HotelReservation,
  type HotelRoom,
} from "@/lib/hotelApi";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateOnly(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return startOfDay(parsed);
}

type CellState = "available" | "reserved" | "moment" | "occupied" | "maintenance" | "cleaning";

function getCellState(
  room: HotelRoom,
  day: Date,
  reservations: HotelReservation[],
  moments: HotelMoment[]
): CellState {
  if (room.status === "maintenance") return "maintenance";
  if (room.status === "cleaning") return "cleaning";
  if (room.status === "occupied") return "occupied";

  const roomReservations = reservations.filter((r) => r.room_id === room.id);
  const hasReservation = roomReservations.some((reservation) => {
    if (!["pending", "confirmed", "checked_in"].includes(reservation.status)) return false;
    const checkIn = toDateOnly(reservation.check_in);
    const checkOut = toDateOnly(reservation.check_out);
    if (!checkIn || !checkOut) return false;
    return day >= checkIn && day < checkOut;
  });
  if (hasReservation) return "reserved";

  const roomMoments = moments.filter((m) => m.room_id === room.id);
  const hasMoment = roomMoments.some((moment) => {
    if (!["pending", "confirmed", "ongoing"].includes(moment.status)) return false;
    const start = toDateOnly(moment.start_at);
    if (!start) return false;
    return day.getTime() === start.getTime();
  });
  if (hasMoment) return "moment";

  return "available";
}

function cellClass(state: CellState): string {
  if (state === "reserved") return "bg-amber-100 text-amber-700";
  if (state === "moment") return "bg-violet-100 text-violet-700";
  if (state === "occupied") return "bg-rose-100 text-rose-700";
  if (state === "maintenance") return "bg-red-100 text-red-700";
  if (state === "cleaning") return "bg-sky-100 text-sky-700";
  return "bg-emerald-100 text-emerald-700";
}

function cellLabel(state: CellState): string {
  if (state === "reserved") return "Resa";
  if (state === "moment") return "2h";
  if (state === "occupied") return "Occ";
  if (state === "maintenance") return "Maint";
  if (state === "cleaning") return "Clean";
  return "Libre";
}

export default function HotelPlanningPage() {
  const params = useParams<{ business: string }>();
  const business = params?.business ?? "";

  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [reservations, setReservations] = useState<HotelReservation[]>([]);
  const [moments, setMoments] = useState<HotelMoment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const days = useMemo(() => {
    const base = startOfDay(new Date());
    return Array.from({ length: 14 }, (_, index) => {
      const day = new Date(base);
      day.setDate(base.getDate() + index);
      return day;
    });
  }, []);

  useEffect(() => {
    async function run() {
      if (!business) return;
      setLoading(true);
      setError("");
      try {
        const [roomData, reservationData, momentData] = await Promise.all([
          getHotelRooms(business),
          getHotelReservations(business),
          getHotelMoments(business),
        ]);
        setRooms(roomData);
        setReservations(reservationData);
        setMoments(momentData);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }

    void run();
  }, [business]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Hotel • Planning disponibilite</h1>
            <p className="mt-1 text-sm text-slate-600">Vue 14 jours pour chambres, reservations et moments 2h.</p>
          </div>
          <Link
            href={business ? `/${business}/hotel` : "/"}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Retour module hotel
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            ["Libre", "bg-emerald-100 text-emerald-700"],
            ["Resa", "bg-amber-100 text-amber-700"],
            ["Moment 2h", "bg-violet-100 text-violet-700"],
            ["Occupee", "bg-rose-100 text-rose-700"],
            ["Clean", "bg-sky-100 text-sky-700"],
            ["Maintenance", "bg-red-100 text-red-700"],
          ].map(([label, cls]) => (
            <span key={label} className={`rounded-full px-2 py-1 font-semibold ${cls}`}>
              {label}
            </span>
          ))}
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        {loading ? (
          <div className="mt-4 text-sm text-slate-600">Chargement planning...</div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[1080px] w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="sticky left-0 z-10 bg-white py-2 pr-3 min-w-[180px]">Chambre</th>
                  {days.map((day) => (
                    <th key={day.toISOString()} className="py-2 px-1 text-center min-w-[62px]">
                      {formatDayLabel(day)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.id} className="border-t border-slate-100">
                    <td className="sticky left-0 z-10 bg-white py-2 pr-3">
                      <div className="font-semibold text-slate-800">{room.name}</div>
                      <div className="text-[11px] text-slate-500">#{room.room_number}</div>
                    </td>
                    {days.map((day) => {
                      const state = getCellState(room, day, reservations, moments);
                      return (
                        <td key={`${room.id}-${day.toISOString()}`} className="py-2 px-1 text-center">
                          <span className={`inline-flex min-w-[52px] justify-center rounded-md px-2 py-1 font-semibold ${cellClass(state)}`}>
                            {cellLabel(state)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
