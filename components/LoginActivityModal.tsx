"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Laptop, LogOut, Smartphone, Tablet, X } from "lucide-react";
import { ApiError } from "@/lib/api";
import { logout } from "@/lib/authApi";
import { useAuth } from "@/context/AuthContext";
import {
  listMyLoginActivity,
  listUserLoginActivity,
  type LoginActivityItem,
} from "@/lib/loginActivityApi";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("fr-FR");
}

function DeviceIcon({ deviceType }: { deviceType: string | null }) {
  if (deviceType === "mobile") return <Smartphone className="h-4 w-4 text-slate-500" />;
  if (deviceType === "tablet") return <Tablet className="h-4 w-4 text-slate-500" />;
  return <Laptop className="h-4 w-4 text-slate-500" />;
}

type Props =
  | { mode: "self"; title?: string; onClose: () => void }
  | { mode: "user"; business: string; userId: string; userName: string; onClose: () => void };

export default function LoginActivityModal(props: Props) {
  const router = useRouter();
  const { clear } = useAuth();
  const [items, setItems] = useState<LoginActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogoutThisDevice() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      clear();
      router.replace("/login");
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res =
        props.mode === "self"
          ? await listMyLoginActivity(page)
          : await listUserLoginActivity(props.business, props.userId, page);
      setItems(res.items);
      setLastPage(res.lastPage);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, props.mode, props.mode === "user" ? props.business : "", props.mode === "user" ? props.userId : ""]);

  useEffect(() => {
    void load();
  }, [load]);

  const title = props.mode === "self" ? (props.title ?? "Mes connexions") : `Connexions - ${props.userName}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={props.onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-bold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-lg border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-50"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {props.mode === "self" ? (
          <div className="border-b border-amber-100 bg-amber-50 px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-amber-800">
                Vous ne reconnaissez pas une de ces connexions ? Deconnectez cet appareil immediatement.
              </p>
              <button
                type="button"
                onClick={() => void handleLogoutThisDevice()}
                disabled={loggingOut}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                <LogOut className="h-3.5 w-3.5" />
                {loggingOut ? "Deconnexion..." : "Deconnecter cet appareil"}
              </button>
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {error ? (
            <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="py-8 text-center text-sm text-slate-500">Chargement...</div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">Aucune connexion enregistree.</div>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <DeviceIcon deviceType={item.deviceType} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-800">
                      {item.browser ?? "Navigateur inconnu"}
                      {item.platform ? ` sur ${item.platform}` : ""}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {formatDate(item.createdAt)} &middot; IP {item.ipAddress ?? "inconnue"}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
          >
            Precedent
          </button>
          <span className="text-xs text-slate-500">Page {page}/{Math.max(1, lastPage)}</span>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(lastPage, prev + 1))}
            disabled={page >= lastPage}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
          >
            Suivant
          </button>
        </div>
      </div>
    </div>
  );
}
