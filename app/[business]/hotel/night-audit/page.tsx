"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { formatMoney as formatCurrency } from "@/lib/currency";
import { getHotelNightAuditReport, type HotelNightAuditReport } from "@/lib/hotelApi";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

function formatDateInput(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function currency(value: number, reportCurrency: string): string {
  return formatCurrency(value, reportCurrency);
}

export default function HotelNightAuditPage() {
  const params = useParams<{ business: string }>();
  const business = params?.business ?? "";

  const [date, setDate] = useState(formatDateInput(new Date()));
  const [report, setReport] = useState<HotelNightAuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    if (!business) return;
    setLoading(true);
    setError("");
    try {
      const data = await getHotelNightAuditReport(business, { date });
      setReport(data);
    } catch (err) {
      setError(getErrorMessage(err));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [business, date]);

  const paymentRows = useMemo(() => {
    if (!report) return [];
    return Object.entries(report.payments_by_method).sort((a, b) => b[1] - a[1]);
  }, [report]);
  const reportCurrency = report?.currency || "USD";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Hotel - Night Audit</h1>
            <p className="mt-1 text-sm text-slate-600">Synthese journaliere: revenus, occupancy, paiements et cash control.</p>
          </div>
          <div className="flex gap-2">
            <label className="space-y-1 text-sm">
              <span className="font-semibold text-slate-700">Date audit</span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-400 focus:outline-none"
              />
            </label>
            <Link
              href={business ? `/${business}/hotel` : "/"}
              className="self-end rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Retour module hotel
            </Link>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Chargement audit...</div>
      ) : !report ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
          Rapport indisponible.
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Occupation</div>
              <div className="mt-2 text-2xl font-extrabold text-slate-900">{report.occupancy_rate.toFixed(2)}%</div>
              <div className="mt-1 text-xs text-slate-500">{report.in_house_count}/{report.rooms_total} chambres in-house</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Revenue total</div>
              <div className="mt-2 text-2xl font-extrabold text-slate-900">{currency(report.total_revenue, reportCurrency)}</div>
              <div className="mt-1 text-xs text-slate-500">
                Chambres {currency(report.room_revenue, reportCurrency)} + Extras {currency(report.extra_revenue, reportCurrency)}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paiements</div>
              <div className="mt-2 text-2xl font-extrabold text-slate-900">{currency(report.payments_total, reportCurrency)}</div>
              <div className="mt-1 text-xs text-slate-500">Solde ouvert: {currency(report.outstanding_balance, reportCurrency)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">ADR / RevPAR</div>
              <div className="mt-2 text-2xl font-extrabold text-slate-900">{currency(report.adr, reportCurrency)}</div>
              <div className="mt-1 text-xs text-slate-500">RevPAR: {currency(report.revpar, reportCurrency)}</div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-bold text-slate-900">Arrivees / Departs</h2>
              <div className="mt-3 text-sm text-slate-700 space-y-1">
                <div className="flex justify-between">
                  <span>Arrivees</span>
                  <span className="font-semibold">{report.arrivals_count}</span>
                </div>
                <div className="flex justify-between">
                  <span>Departs</span>
                  <span className="font-semibold">{report.departures_count}</span>
                </div>
                <div className="flex justify-between">
                  <span>In-house</span>
                  <span className="font-semibold">{report.in_house_count}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-2">
              <h2 className="text-lg font-bold text-slate-900">Paiements par mode</h2>
              {paymentRows.length === 0 ? (
                <div className="mt-3 text-sm text-slate-600">Aucun paiement pour cette date.</div>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="py-2 pr-3">Mode</th>
                        <th className="py-2">Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentRows.map(([method, amount]) => (
                        <tr key={method} className="border-t border-slate-100">
                          <td className="py-2 pr-3 text-slate-700">{method || "-"}</td>
                          <td className="py-2 text-slate-700">{currency(amount, reportCurrency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-bold text-slate-900">Liste arrivees</h2>
              {report.arrivals.length === 0 ? (
                <div className="mt-3 text-sm text-slate-600">Aucune arrivee.</div>
              ) : (
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {report.arrivals.map((reservation) => (
                    <li key={reservation.id} className="rounded-lg border border-slate-100 px-3 py-2">
                      <div className="font-semibold">{reservation.guest_name}</div>
                      <div className="text-xs text-slate-500">
                        {reservation.room?.name || "-"} #{reservation.room?.room_number || "-"}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-bold text-slate-900">Housekeeping en attente</h2>
              {report.housekeeping_pending.length === 0 ? (
                <div className="mt-3 text-sm text-slate-600">Aucune tache en attente.</div>
              ) : (
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {report.housekeeping_pending.map((task) => (
                    <li key={task.id} className="rounded-lg border border-slate-100 px-3 py-2">
                      <div className="font-semibold">
                        {task.task_type} - {task.priority}
                      </div>
                      <div className="text-xs text-slate-500">
                        {task.room?.name || "-"} #{task.room?.room_number || "-"} - {task.status}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
