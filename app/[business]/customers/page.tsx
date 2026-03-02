"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  createCustomer,
  listCustomers,
  updateCustomer,
  type CustomerItem,
} from "@/lib/customersApi";
function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}
export default function CustomersPage() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";
  const [items, setItems] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"" | "1" | "0">("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!businessSlug) return;
      setLoading(true);
      setError("");
      try {
        const res = await listCustomers(businessSlug, {
          page,
          perPage: 20,
          q: query || undefined,
          isActive: activeFilter === "" ? undefined : activeFilter === "1",
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
  }, [businessSlug, page, query, activeFilter]);
  const activeCount = useMemo(
    () => items.filter((item) => item.isActive).length,
    [items],
  );
  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessSlug) return;
    if (!name.trim()) {
      setError("Le nom du client est obligatoire.");
      return;
    }
    setSaving(true);
    setError("");
    setInfo("");
    try {
      await createCustomer(businessSlug, {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      setName("");
      setEmail("");
      setPhone("");
      setInfo("Client ajoute avec succes.");
      setPage(1);
      const refresh = await listCustomers(businessSlug, {
        page: 1,
        perPage: 20,
        q: query || undefined,
        isActive: activeFilter === "" ? undefined : activeFilter === "1",
      });
      setItems(refresh.items);
      setLastPage(refresh.lastPage);
      setTotal(refresh.total);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }
  async function handleToggle(item: CustomerItem) {
    if (!businessSlug) return;
    const id = String(item.id);
    setBusyId(id);
    setError("");
    setInfo("");
    try {
      const updated = await updateCustomer(businessSlug, id, {
        isActive: !item.isActive,
      });
      setItems((prev) => prev.map((row) => (row.id === id ? updated : row)));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId("");
    }
  }
  async function handleRename(item: CustomerItem) {
    if (!businessSlug) return;
    const nextName = window.prompt("Nouveau nom du client", item.name);
    if (!nextName) return;
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === item.name) return;
    const id = String(item.id);
    setBusyId(id);
    setError("");
    setInfo("");
    try {
      const updated = await updateCustomer(businessSlug, id, { name: trimmed });
      setItems((prev) => prev.map((row) => (row.id === id ? updated : row)));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId("");
    }
  }
  return (
    <div className="space-y-6">
      <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
            <p className="text-slate-500 mt-1">
              Liste clients reliee au backend.
            </p>
          </div>
          <div className="text-sm text-slate-500">
            {total} client(s) | actifs sur page: {activeCount}
          </div>
        </div>
      </section>
      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </section>
      ) : null}
      {info ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {info}
        </section>
      ) : null}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <form
          onSubmit={handleCreate}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3"
        >
          <h2 className="font-bold text-slate-900">Nouveau client</h2>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nom *"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Telephone"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl brand-primary-btn text-white py-2.5 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? "Ajout..." : "Ajouter"}
          </button>
        </form>
        <div className="xl:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_170px_auto] gap-3">
            <input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Rechercher (nom, email, phone...)"
              className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <select
              value={activeFilter}
              onChange={(event) => {
                setActiveFilter(event.target.value as "" | "1" | "0");
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Tous</option> <option value="1">Actifs</option>
              <option value="0">Inactifs</option>
            </select>
            <button
              onClick={() => {
                setQuery(queryInput.trim());
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Filtrer
            </button>
          </div>
          {loading ? (
            <div className="py-8 text-center text-slate-500">
              Chargement des clients...
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-slate-500">
              Aucun client trouve.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-3 pr-3 font-semibold">Client</th>
                    <th className="py-3 pr-3 font-semibold">Contact</th>
                    <th className="py-3 pr-3 font-semibold">Statut</th>
                    <th className="py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const busy = busyId === item.id;
                    return (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-3 pr-3">
                          <div className="font-semibold text-slate-800">
                            {item.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {item.code || "-"}
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-slate-600">
                          <div>{item.email || "-"}</div>
                          <div className="text-xs">{item.phone || "-"}</div>
                        </td>
                        <td className="py-3 pr-3">
                          <span
                            className={
                              item.isActive
                                ? "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                                : "inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                            }
                          >
                            {item.isActive ? "Actif" : "Inactif"}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                void handleRename(item);
                              }}
                              disabled={busy}
                              title="Renommer"
                              aria-label="Renommer"
                              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            >
                              <i
                                className="fa-solid fa-pen-to-square"
                                aria-hidden="true"
                              />
                            </button>
                            <button
                              onClick={() => {
                                void handleToggle(item);
                              }}
                              disabled={busy}
                              title={item.isActive ? "Desactiver" : "Activer"}
                              aria-label={
                                item.isActive ? "Desactiver" : "Activer"
                              }
                              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            >
                              <i
                                className={
                                  item.isActive
                                    ? "fa-solid fa-user-slash"
                                    : "fa-solid fa-user-check"
                                }
                                aria-hidden="true"
                              />
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
        </div>
      </section>
    </div>
  );
}
