"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { listAllPosSales, type PosSaleHistoryItem } from "@/lib/posApi";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function SalesReportsPage() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";

  const [allItems, setAllItems] = useState<PosSaleHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 20;

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!businessSlug) return;
      setLoading(true);
      setError("");
      try {
        const records = await listAllPosSales(businessSlug, {
          status: status || undefined,
          from: from || undefined,
          to: to || undefined,
        });
        if (!mounted) return;
        setAllItems(records);
        setTotal(records.length);

        const nextLastPage = Math.max(1, Math.ceil(records.length / perPage));
        setLastPage(nextLastPage);
        setPage((prev) => Math.min(prev, nextLastPage));
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
  }, [businessSlug, status, from, to]);

  const items = useMemo(() => {
    const start = (page - 1) * perPage;
    return allItems.slice(start, start + perPage);
  }, [allItems, page, perPage]);

  const totals = useMemo(() => {
    let gross = 0;
    let paid = 0;
    let refunded = 0;
    for (const item of allItems) {
      gross += item.total;
      paid += item.paidTotal;
      refunded += item.refundedTotal;
    }
    return { gross, paid, refunded };
  }, [allItems]);

  return (
    <div className="space-y-5">
      <section className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Rapports ventes</h1>
        <p className="text-sm text-slate-500 mt-1">Base backend: endpoint `sales` POS.</p>
      </section>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </section>
      ) : null}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total ventes (filtre)" value={formatMoney(totals.gross)} tone="text-indigo-700" />
        <StatCard label="Encaisse (filtre)" value={formatMoney(totals.paid)} tone="text-emerald-700" />
        <StatCard label="Rembourse (filtre)" value={formatMoney(totals.refunded)} tone="text-rose-700" />
      </section>

      <section className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">Tous statuts</option>
            <option value="paid">Payee</option>
            <option value="partially_paid">Partielle</option>
            <option value="issued">Ouverte</option>
            <option value="refunded">Remboursee</option>
            <option value="void">Annulee</option>
          </select>
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
              setStatus("");
              setFrom("");
              setTo("");
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Reinitialiser
          </button>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b text-sm text-slate-600">{total} ticket(s)</div>
        {loading ? (
          <div className="py-10 text-center text-slate-500">Chargement...</div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-slate-500">Aucune vente trouvee.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-3 pr-3 px-4 font-semibold">Ticket</th>
                  <th className="py-3 pr-3 font-semibold">Date</th>
                  <th className="py-3 pr-3 font-semibold">Client</th>
                  <th className="py-3 pr-3 font-semibold">Total</th>
                  <th className="py-3 pr-3 font-semibold">Paye</th>
                  <th className="py-3 pr-3 font-semibold">Remb.</th>
                  <th className="py-3 px-4 font-semibold">Statut</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-3 pr-3 px-4 font-semibold text-slate-800">{item.receiptNo}</td>
                    <td className="py-3 pr-3 text-slate-600">
                      {item.createdAt ? new Date(item.createdAt).toLocaleString("fr-FR") : "-"}
                    </td>
                    <td className="py-3 pr-3 text-slate-700">{item.customerName}</td>
                    <td className="py-3 pr-3 font-semibold text-slate-800">{formatMoney(item.total)}</td>
                    <td className="py-3 pr-3 text-emerald-700 font-semibold">{formatMoney(item.paidTotal)}</td>
                    <td className="py-3 pr-3 text-rose-700 font-semibold">{formatMoney(item.refundedTotal)}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {item.status}
                      </span>
                    </td>
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

function StatCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}
