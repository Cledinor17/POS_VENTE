"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  createBusinessUser,
  listBusinessUsers,
  removeBusinessUser,
  updateBusinessUser,
  type BusinessUserItem,
} from "@/lib/businessUsersApi";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

const ROLE_OPTIONS: Array<"admin" | "manager" | "accountant" | "staff"> = [
  "admin",
  "manager",
  "accountant",
  "staff",
];

const STATUS_OPTIONS: Array<"active" | "disabled"> = ["active", "disabled"];

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR");
}

export default function UsersPage() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";

  const [items, setItems] = useState<BusinessUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyRowId, setBusyRowId] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [reloadSeq, setReloadSeq] = useState(0);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "accountant" | "staff">("staff");

  const [rowRoleById, setRowRoleById] = useState<Record<string, string>>({});
  const [rowStatusById, setRowStatusById] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!businessSlug) return;
      setLoading(true);
      setError("");

      try {
        const res = await listBusinessUsers(businessSlug, { page, perPage: 20 });
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
  }, [businessSlug, page, reloadSeq]);

  useEffect(() => {
    setRowRoleById((prev) => {
      const next = { ...prev };
      for (const item of items) {
        next[item.id] = next[item.id] || item.role;
      }
      return next;
    });

    setRowStatusById((prev) => {
      const next = { ...prev };
      for (const item of items) {
        next[item.id] = next[item.id] || item.status;
      }
      return next;
    });
  }, [items]);

  const activeCount = useMemo(
    () => items.filter((item) => item.status === "active").length,
    [items],
  );

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessSlug) return;

    if (!name.trim()) {
      setError("Le nom est obligatoire.");
      return;
    }
    if (!email.trim()) {
      setError("L'email est obligatoire.");
      return;
    }

    setSaving(true);
    setError("");
    setInfo("");

    try {
      await createBusinessUser(businessSlug, {
        name: name.trim(),
        email: email.trim(),
        password: password.trim() || undefined,
        role,
      });

      setName("");
      setEmail("");
      setPassword("");
      setRole("staff");
      setInfo("Utilisateur ajoute au business.");
      setPage(1);
      setReloadSeq((prev) => prev + 1);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(item: BusinessUserItem) {
    if (!businessSlug) return;

    const nextRole = (rowRoleById[item.id] || item.role) as
      | "admin"
      | "manager"
      | "accountant"
      | "staff";
    const nextStatus = (rowStatusById[item.id] || item.status) as "active" | "disabled";

    setBusyRowId(item.id);
    setError("");
    setInfo("");

    try {
      await updateBusinessUser(businessSlug, item.id, {
        role: nextRole,
        status: nextStatus,
      });
      setInfo("Utilisateur mis a jour.");
      setReloadSeq((prev) => prev + 1);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyRowId("");
    }
  }

  async function handleRemove(item: BusinessUserItem) {
    if (!businessSlug) return;
    if (!window.confirm(`Retirer ${item.name} de ce business ?`)) return;

    setBusyRowId(item.id);
    setError("");
    setInfo("");

    try {
      await removeBusinessUser(businessSlug, item.id);
      setInfo("Utilisateur retire du business.");
      setReloadSeq((prev) => prev + 1);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyRowId("");
    }
  }

  return (
    <div className="space-y-6">
      <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Utilisateurs</h1>
            <p className="text-slate-500 mt-1">
              Gere les utilisateurs rattachés a ce business.
            </p>
          </div>
          <div className="text-sm text-slate-500">
            {total} utilisateur(s) | actifs sur page: {activeCount}
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
          <h2 className="font-bold text-slate-900">Ajouter un utilisateur</h2>

          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nom *"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />

          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email *"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />

          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mot de passe (optionnel)"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />

          <select
            value={role}
            onChange={(event) =>
              setRole(event.target.value as "admin" | "manager" | "accountant" | "staff")
            }
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            {ROLE_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl brand-primary-btn text-white py-2.5 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? "Ajout..." : "Ajouter"}
          </button>
        </form>

        <div className="xl:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          {loading ? (
            <div className="py-8 text-center text-slate-500">
              Chargement des utilisateurs...
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-slate-500">
              Aucun utilisateur trouve.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-3 pr-3 font-semibold">Utilisateur</th>
                    <th className="py-3 pr-3 font-semibold">Role</th>
                    <th className="py-3 pr-3 font-semibold">Statut</th>
                    <th className="py-3 pr-3 font-semibold">Ajoute le</th>
                    <th className="py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const busy = busyRowId === item.id;
                    return (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-3 pr-3">
                          <div className="font-semibold text-slate-800">{item.name}</div>
                          <div className="text-xs text-slate-500">{item.email}</div>
                        </td>

                        <td className="py-3 pr-3">
                          <select
                            value={rowRoleById[item.id] || item.role}
                            onChange={(event) =>
                              setRowRoleById((prev) => ({
                                ...prev,
                                [item.id]: event.target.value,
                              }))
                            }
                            className="rounded-lg border border-slate-300 px-2.5 py-1.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                            disabled={busy}
                          >
                            {ROLE_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="py-3 pr-3">
                          <select
                            value={rowStatusById[item.id] || item.status}
                            onChange={(event) =>
                              setRowStatusById((prev) => ({
                                ...prev,
                                [item.id]: event.target.value,
                              }))
                            }
                            className="rounded-lg border border-slate-300 px-2.5 py-1.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                            disabled={busy}
                          >
                            {STATUS_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="py-3 pr-3 text-slate-600">
                          {formatDate(item.createdAt)}
                        </td>

                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                void handleUpdate(item);
                              }}
                              disabled={busy}
                              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                              title="Enregistrer"
                              aria-label="Enregistrer"
                            >
                              <i className="fa-solid fa-floppy-disk" aria-hidden="true" />
                            </button>
                            <button
                              onClick={() => {
                                void handleRemove(item);
                              }}
                              disabled={busy}
                              className="rounded-lg border border-rose-300 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                              title="Retirer"
                              aria-label="Retirer"
                            >
                              <i className="fa-solid fa-user-minus" aria-hidden="true" />
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
