"use client";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  closeAccountingPeriod,
  createAccountingPeriod,
  listAccountingPeriods,
  reopenAccountingPeriod,
  type AccountingPeriodItem,
} from "@/lib/adminApi";
function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}
export default function AccountingPeriodsPage() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";
  const [items, setItems] = useState<AccountingPeriodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!businessSlug) return;
      setLoading(true);
      setError("");
      try {
        const res = await listAccountingPeriods(businessSlug, page);
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
  }, [businessSlug, page]);
  async function refreshFirstPage() {
    if (!businessSlug) return;
    const res = await listAccountingPeriods(businessSlug, 1);
    setItems(res.items);
    setLastPage(res.lastPage);
    setTotal(res.total);
    setPage(1);
  }
  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessSlug) return;
    if (!startDate || !endDate) {
      setError("Start date et end date sont obligatoires.");
      return;
    }
    setSaving(true);
    setError("");
    setInfo("");
    try {
      await createAccountingPeriod(businessSlug, {
        name: name.trim() || undefined,
        startDate,
        endDate,
        notes: notes.trim() || undefined,
      });
      setName("");
      setStartDate("");
      setEndDate("");
      setNotes("");
      setInfo("Periode creee.");
      await refreshFirstPage();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }
  async function handleClose(item: AccountingPeriodItem) {
    if (!businessSlug) return;
    const confirmed = window.confirm(
      `Fermer la periode ${item.name || item.id} ?`,
    );
    if (!confirmed) return;
    setBusyId(item.id);
    setError("");
    setInfo("");
    try {
      const updated = await closeAccountingPeriod(businessSlug, item.id);
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? updated : row)),
      );
      setInfo("Periode fermee.");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId("");
    }
  }
  async function handleReopen(item: AccountingPeriodItem) {
    if (!businessSlug) return;
    const confirmed = window.confirm(
      `Reouvrir la periode ${item.name || item.id} ?`,
    );
    if (!confirmed) return;
    setBusyId(item.id);
    setError("");
    setInfo("");
    try {
      const updated = await reopenAccountingPeriod(businessSlug, item.id);
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? updated : row)),
      );
      setInfo("Periode reouverte.");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId("");
    }
  }
  return (
    <div className="space-y-5">
      {" "}
      <section className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        {" "}
        <h1 className="text-xl font-bold text-slate-900">
          Periodes comptables
        </h1>{" "}
        <p className="text-sm text-slate-500 mt-1">
          Gestion backend `accounting/periods`.
        </p>{" "}
      </section>{" "}
      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {" "}
          {error}{" "}
        </section>
      ) : null}{" "}
      {info ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {" "}
          {info}{" "}
        </section>
      ) : null}{" "}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {" "}
        <form
          onSubmit={handleCreate}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3"
        >
          {" "}
          <h2 className="font-bold text-slate-900">Nouvelle periode</h2>{" "}
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nom (optionnel)"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />{" "}
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />{" "}
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />{" "}
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="Notes"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />{" "}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl brand-primary-btn text-white py-2.5 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {" "}
            {saving ? "Creation..." : "Creer"}{" "}
          </button>{" "}
        </form>{" "}
        <section className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {" "}
          <div className="px-4 py-3 border-b text-sm text-slate-600">
            {total} periode(s)
          </div>{" "}
          {loading ? (
            <div className="py-10 text-center text-slate-500">
              Chargement...
            </div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-slate-500">
              Aucune periode trouvee.
            </div>
          ) : (
            <div className="overflow-x-auto">
              {" "}
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-3 pr-3 px-4 font-semibold">Periode</th>
                    <th className="py-3 pr-3 font-semibold">Debut</th>
                    <th className="py-3 pr-3 font-semibold">Fin</th>
                    <th className="py-3 pr-3 font-semibold">Statut</th>
                    <th className="py-3 px-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const busy = busyId === item.id;
                    return (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-3 pr-3 px-4">
                          <div className="font-semibold text-slate-800">
                            {item.name || `Periode #${item.id}`}
                          </div>
                          <div className="text-xs text-slate-500">
                            {item.notes || "-"}
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-slate-700">
                          {item.startDate}
                        </td>
                        <td className="py-3 pr-3 text-slate-700">
                          {item.endDate}
                        </td>
                        <td className="py-3 pr-3">
                          <span
                            className={
                              item.status === "closed"
                                ? "inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700"
                                : "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                            }
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {item.status === "open" ? (
                            <button
                              onClick={() => {
                                void handleClose(item);
                              }}
                              disabled={busy}
                              className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                            >
                              Fermer
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                void handleReopen(item);
                              }}
                              disabled={busy}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            >
                              Reouvrir
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}{" "}
          <div className="px-4 py-3 border-t flex items-center justify-between">
            {" "}
            <div className="text-xs text-slate-500">
              {" "}
              Page {page}/{Math.max(1, lastPage)}{" "}
            </div>{" "}
            <div className="flex items-center gap-2">
              {" "}
              <button
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1 || loading}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {" "}
                Precedent{" "}
              </button>{" "}
              <button
                onClick={() => setPage((prev) => Math.min(lastPage, prev + 1))}
                disabled={page >= lastPage || loading}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {" "}
                Suivant{" "}
              </button>{" "}
            </div>{" "}
          </div>{" "}
        </section>{" "}
      </section>{" "}
    </div>
  );
}
