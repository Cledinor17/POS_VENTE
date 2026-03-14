"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck } from "lucide-react";

export type SensitiveActionApproval = {
  userId?: string;
  email?: string;
  password: string;
};

export type SensitiveActionApproverOption = {
  id: string;
  name: string;
  role?: string | null;
  email?: string | null;
};

export default function SensitiveActionApprovalModal({
  open,
  title,
  description,
  confirmLabel = "Autoriser",
  cancelLabel = "Annuler",
  loading = false,
  approvers,
  approversLoading = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  approvers?: SensitiveActionApproverOption[];
  approversLoading?: boolean;
  onClose: () => void;
  onConfirm: (approval: SensitiveActionApproval) => Promise<void> | void;
}) {
  const [mounted, setMounted] = useState(false);
  const [selectedApproverId, setSelectedApproverId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    setLocalError("");
    setSelectedApproverId(approvers?.[0]?.id ?? "");
    setEmail("");
    setPassword("");
  }, [approvers, open]);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [loading, onClose, open]);

  async function handleSubmit() {
    if (approvers) {
      if (approversLoading) {
        setLocalError("Chargement des approbateurs en cours.");
        return;
      }

      if (approvers.length === 0) {
        setLocalError("Aucun utilisateur autorise n est disponible pour valider cette action.");
        return;
      }

      if (!selectedApproverId) {
        setLocalError("Choisis un manager ou superviseur.");
        return;
      }
    } else if (!email.trim()) {
      setLocalError("L email du manager ou superviseur est requis.");
      return;
    }

    if (!password.trim()) {
      setLocalError("Le mot de passe du manager ou superviseur est requis.");
      return;
    }

    setLocalError("");
    await onConfirm({
      userId: approvers ? selectedApproverId : undefined,
      email: approvers ? undefined : email.trim(),
      password,
    });
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/45 p-4 sm:p-6"
      onClick={() => {
        if (!loading) onClose();
      }}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{title}</h2>
              <p className="mt-1 text-sm text-slate-600">{description}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Cette action demande la validation d un manager ou d un superviseur.
          </div>

          {localError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {localError}
            </div>
          ) : null}

          {approvers ? (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Utilisateur autorise</label>
              <select
                value={selectedApproverId}
                onChange={(event) => setSelectedApproverId(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                disabled={loading || approversLoading || approvers.length === 0}
              >
                {approvers.length === 0 ? (
                  <option value="">
                    {approversLoading ? "Chargement..." : "Aucun approbateur disponible"}
                  </option>
                ) : null}
                {approvers.map((approver) => (
                  <option key={approver.id} value={approver.id}>
                    {approver.name}
                    {approver.role ? ` - ${approver.role}` : ""}
                  </option>
                ))}
              </select>
              {selectedApproverId ? (
                <p className="text-xs text-slate-500">
                  {approvers.find((item) => item.id === selectedApproverId)?.email || ""}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Email du manager / superviseur</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="manager@hotel.com"
                className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                disabled={loading}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mot de passe de validation"
              className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              disabled={loading}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={loading}
            className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Validation..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
