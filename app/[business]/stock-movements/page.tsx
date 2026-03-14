"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowDown, ArrowUp, Download, RefreshCcw } from "lucide-react";
import { ApiError } from "@/lib/api";
import {
  exportInventoryMovementsCsv,
  listInventoryMovements,
  type InventoryMovement,
} from "@/lib/inventoryApi";
import { toastError, toastSuccess } from "@/lib/toast";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

function formatQty(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(value);
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("fr-FR");
}

function movementActorLabel(movement: InventoryMovement): string {
  if (movement.createdByName && movement.createdByName.trim().length > 0) {
    return movement.createdByName;
  }
  if (movement.createdBy && movement.createdBy.trim().length > 0) {
    return `#${movement.createdBy}`;
  }
  return "N/A";
}

function movementSourceLabel(movement: InventoryMovement): string {
  if (!movement.sourceType && !movement.sourceId) return "Manuel";
  const type = movement.sourceType || "Source";
  return movement.sourceId ? `${type} #${movement.sourceId}` : type;
}

function movementBadge(direction: "in" | "out"): string {
  return direction === "in" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700";
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function StockMovementsPage() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";

  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState<"" | "in" | "out">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  async function loadMovements() {
    if (!businessSlug) return;
    setLoading(true);
    setError("");
    try {
      const res = await listInventoryMovements(businessSlug, {
        page,
        perPage: 20,
        q: query || undefined,
        direction: direction || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
      });
      setMovements(res.items);
      setLastPage(res.lastPage);
      setTotal(res.total);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      toastError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMovements();
  }, [businessSlug, page, query, direction, dateFrom, dateTo]);

  const totals = useMemo(() => {
    return movements.reduce(
      (acc, movement) => {
        if (movement.direction === "in") {
          acc.entries += movement.quantity;
        } else {
          acc.exits += movement.quantity;
        }
        return acc;
      },
      { entries: 0, exits: 0 }
    );
  }, [movements]);

  async function exportCsv() {
    if (!businessSlug) return;
    setExportingCsv(true);
    setError("");
    try {
      const csv = await exportInventoryMovementsCsv(businessSlug, {
        q: query || undefined,
        direction: direction || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
      });
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      downloadCsv(csv, `stock-movements-${stamp}.csv`);
      setInfo("Export CSV genere avec succes.");
      toastSuccess("Export CSV genere avec succes.");
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      toastError(message);
    } finally {
      setExportingCsv(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Mouvements stock</h1>
            <p className="mt-1 text-slate-500">
              Journal des entrees et sorties avec source, utilisateur et export.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                void loadMovements();
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCcw className="h-4 w-4" /> Actualiser
            </button>
            <Link
              href={businessSlug ? `/${businessSlug}/inventory` : "/"}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Retour inventaire
            </Link>
          </div>
        </div>
      </section>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</section>
      ) : null}
      {info ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{info}</section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Mouvements trouves</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{total}</div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Entrees page courante</div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">{formatQty(totals.entries)}</div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Sorties page courante</div>
          <div className="mt-2 text-2xl font-bold text-rose-700">{formatQty(totals.exits)}</div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <h2 className="text-base font-bold text-slate-900">Trace des entrees et sorties</h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Produit, raison, note, SKU..."
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <select
              value={direction}
              onChange={(event) => {
                setDirection(event.target.value as "" | "in" | "out");
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Tous</option>
              <option value="in">Entree</option>
              <option value="out">Sortie</option>
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <button
              onClick={() => {
                void exportCsv();
              }}
              disabled={exportingCsv}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4" />
              {exportingCsv ? "Export..." : "Exporter CSV"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-500">Chargement des mouvements...</div>
        ) : movements.length === 0 ? (
          <div className="py-8 text-center text-slate-500">Aucun mouvement trouve.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-3 pr-3 font-semibold">Date</th>
                  <th className="py-3 pr-3 font-semibold">Produit</th>
                  <th className="py-3 pr-3 font-semibold">Direction</th>
                  <th className="py-3 pr-3 font-semibold">Quantite</th>
                  <th className="py-3 pr-3 font-semibold">Cout unit.</th>
                  <th className="py-3 pr-3 font-semibold">Raison</th>
                  <th className="py-3 pr-3 font-semibold">Source</th>
                  <th className="py-3 pr-3 font-semibold">Utilisateur</th>
                  <th className="py-3 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id} className="border-b last:border-0">
                    <td className="py-3 pr-3 text-slate-600">{formatDateTime(movement.createdAt)}</td>
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-slate-800">{movement.productName}</div>
                      <div className="text-xs text-slate-500">{movement.productSku || "N/A"}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${movementBadge(
                          movement.direction
                        )}`}
                      >
                        {movement.direction === "in" ? (
                          <>
                            <ArrowDown className="h-3.5 w-3.5" /> Entree
                          </>
                        ) : (
                          <>
                            <ArrowUp className="h-3.5 w-3.5" /> Sortie
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3 pr-3 font-semibold text-slate-800">{formatQty(movement.quantity)}</td>
                    <td className="py-3 pr-3 text-slate-700">{formatMoney(movement.unitCost)}</td>
                    <td className="py-3 pr-3 text-slate-600">{movement.reason || "-"}</td>
                    <td className="py-3 pr-3 text-slate-600">{movementSourceLabel(movement)}</td>
                    <td className="py-3 pr-3 text-slate-600">{movementActorLabel(movement)}</td>
                    <td className="py-3 text-slate-600">{movement.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Page {page}/{Math.max(1, lastPage)}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || loading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Precedent
            </button>
            <button
              onClick={() => setPage((prev) => Math.min(lastPage, prev + 1))}
              disabled={page >= lastPage || loading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Suivant
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
