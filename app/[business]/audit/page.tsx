"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { exportAuditLogsExcel, exportAuditLogsPdf, listAuditLogs, type AuditLogItem } from "@/lib/adminApi";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

function formatActor(item: AuditLogItem): string {
  if (item.userName && item.userName.trim().length > 0) return item.userName;
  if (item.userEmail && item.userEmail.trim().length > 0) return item.userEmail;
  if (item.userId && item.userId.trim().length > 0) return `#${item.userId}`;
  return "-";
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export default function AuditPage() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";

  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!businessSlug) return;
      setLoading(true);
      setError("");
      try {
        const res = await listAuditLogs(businessSlug, {
          page,
          action: action || undefined,
          from: from || undefined,
          to: to || undefined,
        });

        if (!mounted) return;
        setItems(res.items);
        setLastPage(res.lastPage);
        setTotal(res.total);
      } catch (e) {
        if (mounted) setError(getErrorMessage(e));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [businessSlug, page, action, from, to]);

  async function handleExportExcel() {
    if (!businessSlug) return;
    setError("");
    setExportingExcel(true);
    try {
      const blob = await exportAuditLogsExcel(businessSlug, {
        action: action || undefined,
        from: from || undefined,
        to: to || undefined,
      });
      downloadBlob(blob, `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setExportingExcel(false);
    }
  }

  async function handleExportPdf() {
    if (!businessSlug) return;
    setError("");
    setExportingPdf(true);
    try {
      const blob = await exportAuditLogsPdf(businessSlug, {
        action: action || undefined,
        from: from || undefined,
        to: to || undefined,
      });
      downloadBlob(blob, `audit-logs-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Audit & securite</h1>
        <p className="text-sm text-slate-500 mt-1">Journaux d'audit backend (`audit/logs`).</p>
      </section>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </section>
      ) : null}

      <section className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
            }}
            placeholder="Action (invoice.void...)"
            className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <input
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <input
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <button
            onClick={() => {
              setAction("");
              setFrom("");
              setTo("");
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Reinitialiser
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              void handleExportExcel();
            }}
            disabled={loading || exportingExcel || exportingPdf}
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
          >
            {exportingExcel ? "Export..." : "Exporter Excel"}
          </button>
          <button
            onClick={() => {
              void handleExportPdf();
            }}
            disabled={loading || exportingPdf || exportingExcel}
            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            {exportingPdf ? "Export..." : "Exporter PDF"}
          </button>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b text-sm text-slate-600">{total} log(s)</div>
        {loading ? (
          <div className="py-10 text-center text-slate-500">Chargement...</div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-slate-500">Aucun log trouve.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-3 pr-3 px-4 font-semibold">Date</th>
                  <th className="py-3 pr-3 font-semibold">Action</th>
                  <th className="py-3 pr-3 font-semibold">Entite</th>
                  <th className="py-3 pr-3 font-semibold">Utilisateur</th>
                  <th className="py-3 px-4 font-semibold">Group ID</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-3 pr-3 px-4 text-slate-600">
                      {item.occurredAt ? new Date(item.occurredAt).toLocaleString("fr-FR") : "-"}
                    </td>
                    <td className="py-3 pr-3 font-semibold text-slate-800">{item.action}</td>
                    <td className="py-3 pr-3 text-slate-700">
                      {item.entityType || "-"}
                      {item.entityId ? ` #${item.entityId}` : ""}
                    </td>
                    <td className="py-3 pr-3 text-slate-700">
                      {formatActor(item)}
                      {item.userId ? <div className="text-[11px] text-slate-400">#{item.userId}</div> : null}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-xs">{item.groupId || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-4 py-3 border-t flex items-center justify-between">
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
