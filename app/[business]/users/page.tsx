"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  createBusinessUser,
  listBusinessUsers,
  removeBusinessUser,
  updateBusinessUser,
  type BusinessUserItem,
} from "@/lib/businessUsersApi";
import {
  ALL_PERMISSIONS,
  PERMISSION_GROUPS,
  PERMISSION_HINTS,
  PERMISSION_LABELS,
  ROLE_LABELS,
  ROLE_OPTIONS,
  STATUS_OPTIONS,
  getDefaultPermissionsForRole,
  hasPermission,
  normalizeBusinessPermissions,
  summarizePermissions,
  type BusinessPermission,
  type BusinessRole,
  type BusinessUserStatus,
} from "@/lib/businessAccess";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

function isBusinessRole(value: string): value is BusinessRole {
  return (ROLE_OPTIONS as readonly string[]).includes(value);
}

function normalizeRole(value: string): BusinessRole {
  return isBusinessRole(value) ? value : "staff";
}

function normalizeStatus(value: string): BusinessUserStatus {
  return value === "disabled" ? "disabled" : "active";
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR");
}

function roleLabel(role: string): string {
  return ROLE_LABELS[normalizeRole(role)] ?? role;
}

function PermissionChecklist({
  selected,
  onToggle,
  allowedPermissions,
}: {
  selected: BusinessPermission[];
  onToggle: (permission: BusinessPermission) => void;
  allowedPermissions: BusinessPermission[];
}) {
  const allowed = useMemo(() => new Set(allowedPermissions), [allowedPermissions]);
  const active = useMemo(() => new Set(selected), [selected]);

  function permissionTone(permission: BusinessPermission): {
    badge: string;
    className: string;
  } {
    if (permission.endsWith(".read")) {
      return {
        badge: "Lecture",
        className: "bg-sky-50 text-sky-700 border-sky-200",
      };
    }

    if (permission.endsWith(".create")) {
      return {
        badge: "Ajout",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    }

    if (permission.endsWith(".edit")) {
      return {
        badge: "Modification",
        className: "bg-violet-50 text-violet-700 border-violet-200",
      };
    }

    if (
      permission === "billing.discount" ||
      permission === "billing.refund" ||
      permission === "billing.void"
    ) {
      return {
        badge: "Sensible",
        className: "bg-amber-50 text-amber-700 border-amber-200",
      };
    }

    return {
      badge: "Controle",
      className: "bg-slate-100 text-slate-700 border-slate-200",
    };
  }

  return (
    <div className="space-y-4">
      {PERMISSION_GROUPS.map((group) => {
        const visiblePermissions = group.permissions.filter((permission) => allowed.has(permission));
        if (visiblePermissions.length === 0) return null;

        return (
          <div key={group.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-slate-900">{group.title}</h3>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {visiblePermissions.map((permission) => (
                <label
                  key={permission}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3"
                >
                  <input
                    type="checkbox"
                    checked={active.has(permission)}
                    onChange={() => onToggle(permission)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">
                        {PERMISSION_LABELS[permission]}
                      </span>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                          permissionTone(permission).className
                        }`}
                      >
                        {permissionTone(permission).badge}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      {PERMISSION_HINTS[permission]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function UsersPage() {
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";
  const { businesses, activeBusiness, permissions: fallbackPermissions, refresh } = useAuth();

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
  const [availableRoles, setAvailableRoles] = useState<BusinessRole[]>(
    ROLE_OPTIONS.filter((role) => role !== "owner"),
  );
  const [availablePermissions, setAvailablePermissions] = useState<BusinessPermission[]>([
    ...ALL_PERMISSIONS,
  ]);

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<BusinessRole>("receptionist");
  const [createPermissions, setCreatePermissions] = useState<BusinessPermission[]>(
    getDefaultPermissionsForRole("receptionist"),
  );

  const [accessModalUser, setAccessModalUser] = useState<BusinessUserItem | null>(null);
  const [accessPermissions, setAccessPermissions] = useState<BusinessPermission[]>([]);

  const [rowRoleById, setRowRoleById] = useState<Record<string, BusinessRole>>({});
  const [rowStatusById, setRowStatusById] = useState<Record<string, BusinessUserStatus>>({});
  const [rowPermissionsById, setRowPermissionsById] = useState<Record<string, BusinessPermission[]>>({});

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
        setAvailableRoles(
          (res.roles.length > 0 ? res.roles : ROLE_OPTIONS)
            .filter((entry): entry is BusinessRole => isBusinessRole(entry))
            .filter((entry) => entry !== "owner"),
        );
        setAvailablePermissions(
          normalizeBusinessPermissions(res.permissions.length > 0 ? res.permissions : ALL_PERMISSIONS),
        );
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
        next[item.id] = next[item.id] || normalizeRole(item.role);
      }
      return next;
    });

    setRowStatusById((prev) => {
      const next = { ...prev };
      for (const item of items) {
        next[item.id] = next[item.id] || normalizeStatus(item.status);
      }
      return next;
    });

    setRowPermissionsById((prev) => {
      const next = { ...prev };
      for (const item of items) {
        next[item.id] = next[item.id] || normalizeBusinessPermissions(item.permissions);
      }
      return next;
    });
  }, [items]);

  useEffect(() => {
    if (!userModalOpen && !accessModalUser) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeUserModal();
        closeAccessModal();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [userModalOpen, accessModalUser]);

  const activeCount = useMemo(
    () => items.filter((item) => item.status === "active").length,
    [items],
  );
  const currentBusinessEntry = useMemo(
    () => businesses.find((item: any) => item?.slug === businessSlug) ?? activeBusiness ?? null,
    [activeBusiness, businesses, businessSlug],
  );
  const currentPermissions = useMemo(() => {
    const scoped = (currentBusinessEntry as any)?.pivot?.permissions;
    if (Array.isArray(scoped)) {
      return scoped.filter((value: unknown): value is string => typeof value === "string");
    }
    return fallbackPermissions;
  }, [currentBusinessEntry, fallbackPermissions]);
  const canManageUsers = hasPermission(currentPermissions, "users.manage");

  function resetUserForm(nextRole: BusinessRole = "receptionist") {
    setName("");
    setEmail("");
    setPassword("");
    setRole(nextRole);
    setCreatePermissions(getDefaultPermissionsForRole(nextRole));
  }

  function closeUserModal() {
    setUserModalOpen(false);
    resetUserForm();
  }

  function openUserModal() {
    resetUserForm();
    setError("");
    setInfo("");
    if (!canManageUsers) return;
    setUserModalOpen(true);
  }

  function closeAccessModal() {
    setAccessModalUser(null);
    setAccessPermissions([]);
  }

  function openAccessModal(item: BusinessUserItem) {
    setError("");
    setInfo("");
    setAccessModalUser(item);
    setAccessPermissions(
      normalizeBusinessPermissions(rowPermissionsById[item.id] ?? item.permissions),
    );
  }

  function toggleCreatePermission(permission: BusinessPermission) {
    setCreatePermissions((prev) =>
      prev.includes(permission) ? prev.filter((item) => item !== permission) : [...prev, permission],
    );
  }

  function toggleAccessPermission(permission: BusinessPermission) {
    setAccessPermissions((prev) =>
      prev.includes(permission) ? prev.filter((item) => item !== permission) : [...prev, permission],
    );
  }

  function handleRoleChangeForRow(userId: string, nextRoleRaw: string) {
    const nextRole = normalizeRole(nextRoleRaw);
    setRowRoleById((prev) => ({ ...prev, [userId]: nextRole }));
    setRowPermissionsById((prev) => ({
      ...prev,
      [userId]: getDefaultPermissionsForRole(nextRole),
    }));
  }

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
        permissions: normalizeBusinessPermissions(createPermissions),
      });

      closeUserModal();
      await refresh();
      setInfo("Utilisateur ajoute avec ses droits d'acces.");
      setPage(1);
      setReloadSeq((prev) => prev + 1);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(item: BusinessUserItem) {
    if (!businessSlug || !canManageUsers) return;

    const nextRole = normalizeRole(rowRoleById[item.id] || item.role);
    const nextStatus = normalizeStatus(rowStatusById[item.id] || item.status);
    const nextPermissions = normalizeBusinessPermissions(
      rowPermissionsById[item.id] ?? item.permissions,
    );

    setBusyRowId(item.id);
    setError("");
    setInfo("");

    try {
      await updateBusinessUser(businessSlug, item.id, {
        role: nextRole,
        status: nextStatus,
        permissions: nextPermissions,
      });
      await refresh();
      setInfo("Utilisateur mis a jour.");
      setReloadSeq((prev) => prev + 1);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyRowId("");
    }
  }

  async function handleSaveAccessModal() {
    if (!businessSlug || !accessModalUser || !canManageUsers) return;

    const item = accessModalUser;
    const nextRole = normalizeRole(rowRoleById[item.id] || item.role);
    const nextStatus = normalizeStatus(rowStatusById[item.id] || item.status);
    const nextPermissions = normalizeBusinessPermissions(accessPermissions);

    setBusyRowId(item.id);
    setError("");
    setInfo("");

    try {
      await updateBusinessUser(businessSlug, item.id, {
        role: nextRole,
        status: nextStatus,
        permissions: nextPermissions,
      });
      await refresh();
      setRowPermissionsById((prev) => ({
        ...prev,
        [item.id]: nextPermissions,
      }));
      setInfo("Acces utilisateur mis a jour.");
      closeAccessModal();
      setReloadSeq((prev) => prev + 1);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyRowId("");
    }
  }

  async function handleRemove(item: BusinessUserItem) {
    if (!businessSlug || !canManageUsers) return;
    if (!window.confirm(`Retirer ${item.name} de ce business ?`)) return;

    setBusyRowId(item.id);
    setError("");
    setInfo("");

    try {
      await removeBusinessUser(businessSlug, item.id);
      await refresh();
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
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Utilisateurs</h1>
            <p className="mt-1 text-slate-500">
              Attribue les acces par utilisateur selon le role, puis ajuste-les a tout moment.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm text-slate-500">
              {total} utilisateur(s) | actifs sur page: {activeCount}
            </div>
            {canManageUsers ? (
              <button
                type="button"
                onClick={openUserModal}
                className="rounded-xl brand-primary-btn px-4 py-2.5 text-sm font-semibold text-white"
              >
                Nouvel utilisateur
              </button>
            ) : null}
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

      <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        {loading ? (
          <div className="py-8 text-center text-slate-500">Chargement des utilisateurs...</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-slate-500">Aucun utilisateur trouve.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-3 pr-3 font-semibold">Utilisateur</th>
                  <th className="py-3 pr-3 font-semibold">Role</th>
                  <th className="py-3 pr-3 font-semibold">Statut</th>
                  <th className="py-3 pr-3 font-semibold">Acces</th>
                  <th className="py-3 pr-3 font-semibold">Ajoute le</th>
                  <th className="py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const busy = busyRowId === item.id;
                  const rowRole = normalizeRole(rowRoleById[item.id] || item.role);
                  const rowStatus = normalizeStatus(rowStatusById[item.id] || item.status);
                  const rowPermissions = normalizeBusinessPermissions(
                    rowPermissionsById[item.id] ?? item.permissions,
                  );
                  const locked = item.role === "owner";

                  return (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-3 pr-3">
                        <div className="font-semibold text-slate-800">{item.name}</div>
                        <div className="text-xs text-slate-500">{item.email}</div>
                      </td>

                      <td className="py-3 pr-3">
                        <select
                          value={rowRole}
                          onChange={(event) => handleRoleChangeForRow(item.id, event.target.value)}
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                          disabled={busy || locked || !canManageUsers}
                        >
                          {availableRoles.map((option) => (
                            <option key={option} value={option}>
                              {ROLE_LABELS[option]}
                            </option>
                          ))}
                          {locked ? <option value="owner">Proprietaire</option> : null}
                        </select>
                      </td>

                      <td className="py-3 pr-3">
                        <select
                          value={rowStatus}
                          onChange={(event) =>
                            setRowStatusById((prev) => ({
                              ...prev,
                              [item.id]: normalizeStatus(event.target.value),
                            }))
                          }
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                          disabled={busy || locked || !canManageUsers}
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option === "active" ? "Actif" : "Desactive"}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="py-3 pr-3">
                        <div className="space-y-1">
                          <div className="font-medium text-slate-800">
                            {summarizePermissions(rowPermissions)}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                item.hasCustomPermissions
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {item.hasCustomPermissions ? "Personnalise" : "Par role"}
                            </span>
                            <button
                              type="button"
                              onClick={() => openAccessModal(item)}
                              disabled={busy || locked || !canManageUsers}
                              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            >
                              Configurer acces
                            </button>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 pr-3 text-slate-600">{formatDate(item.createdAt)}</td>

                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              void handleUpdate(item);
                            }}
                            disabled={busy || locked || !canManageUsers}
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
                            disabled={busy || locked || !canManageUsers}
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
      </section>

      {userModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={closeUserModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Ajouter un utilisateur"
            className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-bold text-slate-900">Ajouter un utilisateur</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Choisis un role par defaut puis ajuste ce que la personne peut voir ou modifier.
                </p>
              </div>
              <button
                type="button"
                onClick={closeUserModal}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Fermer
              </button>
            </div>

            <form onSubmit={handleCreate} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Mot de passe (optionnel)"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />

                  <select
                    value={role}
                    onChange={(event) => {
                      const nextRole = normalizeRole(event.target.value);
                      setRole(nextRole);
                      setCreatePermissions(getDefaultPermissionsForRole(nextRole));
                    }}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    {availableRoles.map((option) => (
                      <option key={option} value={option}>
                        {ROLE_LABELS[option]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Role choisi: {roleLabel(role)}
                    </div>
                    <div className="text-xs text-slate-500">
                      Par defaut: {summarizePermissions(createPermissions)} | Lecture = consulter |
                      Ajout = creer | Modification = mettre a jour | Controle = actions avancees |
                      Sensible = rabais/remboursement/annulation
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCreatePermissions(getDefaultPermissionsForRole(role))}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white"
                  >
                    Reinitialiser selon le role
                  </button>
                </div>

                <PermissionChecklist
                  selected={createPermissions}
                  onToggle={toggleCreatePermission}
                  allowedPermissions={availablePermissions}
                />
              </div>

              <div className="grid grid-cols-1 gap-2 border-t border-slate-100 p-5 sm:grid-cols-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-xl brand-primary-btn py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Ajout..." : "Ajouter"}
                </button>
                <button
                  type="button"
                  onClick={closeUserModal}
                  disabled={saving}
                  className="w-full rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {accessModalUser ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={closeAccessModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Configurer les acces"
            className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-bold text-slate-900">Configurer les acces</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {accessModalUser.name} | {roleLabel(rowRoleById[accessModalUser.id] || accessModalUser.role)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeAccessModal}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Fermer
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {summarizePermissions(accessPermissions)}
                  </div>
                  <div className="text-xs text-slate-500">
                    Ajuste ce que cet utilisateur peut consulter, creer, modifier ou controler.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setAccessPermissions(
                      getDefaultPermissionsForRole(
                        normalizeRole(rowRoleById[accessModalUser.id] || accessModalUser.role),
                      ),
                    )
                  }
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white"
                >
                  Reinitialiser selon le role
                </button>
              </div>

              <PermissionChecklist
                selected={accessPermissions}
                onToggle={toggleAccessPermission}
                allowedPermissions={availablePermissions}
              />
            </div>

            <div className="grid grid-cols-1 gap-2 border-t border-slate-100 p-5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  void handleSaveAccessModal();
                }}
                disabled={busyRowId === accessModalUser.id}
                className="w-full rounded-xl brand-primary-btn py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyRowId === accessModalUser.id ? "Enregistrement..." : "Enregistrer les acces"}
              </button>
              <button
                type="button"
                onClick={closeAccessModal}
                disabled={busyRowId === accessModalUser.id}
                className="w-full rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
