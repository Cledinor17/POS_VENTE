"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { usePermissionGuard } from "@/lib/usePermissionGuard";
import PermissionChecklist from "@/components/PermissionChecklist";
import {
  createCustomRole,
  deleteCustomRole,
  listCustomRoles,
  updateCustomRole,
  type CustomRole,
} from "@/lib/customRolesApi";
import { ALL_PERMISSIONS, summarizePermissions, type BusinessPermission } from "@/lib/businessAccess";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

export default function CustomRolesPage() {
  const { allowed, loading: permLoading } = usePermissionGuard("users.manage");
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";

  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [reloadSeq, setReloadSeq] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<BusinessPermission[]>([]);

  const load = useCallback(async () => {
    if (!businessSlug) return;
    setLoading(true);
    setError("");
    try {
      const items = await listCustomRoles(businessSlug);
      setRoles(items);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [businessSlug, reloadSeq]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setEditingId("");
    setName("");
    setPermissions([]);
  }

  function openCreateModal() {
    resetForm();
    setError("");
    setInfo("");
    setModalOpen(true);
  }

  function openEditModal(role: CustomRole) {
    setEditingId(role.id);
    setName(role.name);
    setPermissions([...role.permissions]);
    setError("");
    setInfo("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    resetForm();
  }

  function togglePermission(permission: BusinessPermission) {
    setPermissions((prev) =>
      prev.includes(permission) ? prev.filter((item) => item !== permission) : [...prev, permission],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessSlug) return;

    if (!name.trim()) {
      setError("Le nom du role est obligatoire.");
      return;
    }
    if (permissions.length === 0) {
      setError("Selectionne au moins une permission.");
      return;
    }

    setSaving(true);
    setError("");
    setInfo("");
    try {
      if (editingId) {
        await updateCustomRole(businessSlug, editingId, { name: name.trim(), permissions });
        setInfo("Role mis a jour.");
      } else {
        await createCustomRole(businessSlug, { name: name.trim(), permissions });
        setInfo("Role personnalise cree.");
      }
      setModalOpen(false);
      resetForm();
      setReloadSeq((prev) => prev + 1);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(role: CustomRole) {
    if (!businessSlug) return;
    if (!window.confirm(`Supprimer le role "${role.name}" ?`)) return;

    setBusyId(role.id);
    setError("");
    setInfo("");
    try {
      await deleteCustomRole(businessSlug, role.id);
      setInfo("Role supprime.");
      setReloadSeq((prev) => prev + 1);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusyId("");
    }
  }

  if (permLoading || !allowed) return null;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Roles personnalises</h1>
            <p className="mt-1 text-sm text-slate-500">
              Cree des roles specifiques a ce business, en plus des roles standards.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-xl brand-primary-btn px-4 py-2.5 text-sm font-semibold text-white"
          >
            Nouveau role
          </button>
        </div>
      </section>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</section>
      ) : null}
      {info ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{info}</section>
      ) : null}

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        {loading ? (
          <div className="py-8 text-center text-slate-500">Chargement...</div>
        ) : roles.length === 0 ? (
          <div className="py-8 text-center text-slate-500">Aucun role personnalise pour l&apos;instant.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-3 pr-3 font-semibold">Nom</th>
                  <th className="py-3 pr-3 font-semibold">Acces</th>
                  <th className="py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id} className="border-b last:border-0">
                    <td className="py-3 pr-3 font-semibold text-slate-800">{role.name}</td>
                    <td className="py-3 pr-3 text-slate-600">{summarizePermissions(role.permissions)}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(role)}
                          disabled={busyId === role.id}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(role)}
                          disabled={busyId === role.id}
                          className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={editingId ? "Modifier le role" : "Nouveau role"}
            className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="font-bold text-slate-900">{editingId ? "Modifier le role" : "Nouveau role"}</h2>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Fermer
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                {error ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                  </div>
                ) : null}

                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Nom du role (ex: Vendeur Junior)"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />

                <div className="text-xs text-slate-500">
                  {summarizePermissions(permissions)} | Lecture = consulter | Ajout = creer |
                  Modification = mettre a jour | Controle = actions avancees | Sensible =
                  rabais/remboursement/annulation
                </div>

                <PermissionChecklist
                  selected={permissions}
                  onToggle={togglePermission}
                  allowedPermissions={[...ALL_PERMISSIONS]}
                />
              </div>

              <div className="grid grid-cols-1 gap-2 border-t border-slate-100 p-5 sm:grid-cols-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-xl brand-primary-btn py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Enregistrement..." : editingId ? "Mettre a jour" : "Creer"}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
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
    </div>
  );
}
