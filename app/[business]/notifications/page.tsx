"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/notificationsApi";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("fr-FR");
}

export default function NotificationsPage() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [reloadSeq, setReloadSeq] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [res, count] = await Promise.all([
        listNotifications({ page, perPage: 20, unreadOnly }),
        getUnreadNotificationCount(),
      ]);
      setItems(res.items);
      setLastPage(res.lastPage);
      setTotal(res.total);
      setUnreadCount(count);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [page, unreadOnly, reloadSeq]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleItemClick(notification: AppNotification) {
    if (notification.readAt) return;
    try {
      await markNotificationRead(notification.id);
      setReloadSeq((prev) => prev + 1);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setReloadSeq((prev) => prev + 1);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
            <p className="mt-1 text-sm text-slate-500">
              {total} notification(s) &middot; {unreadCount} non lue(s)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(event) => {
                  setPage(1);
                  setUnreadOnly(event.target.checked);
                }}
              />
              Non lues seulement
            </label>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Tout marquer comme lu
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</section>
      ) : null}

      <section className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        {loading ? (
          <div className="py-8 text-center text-slate-500">Chargement...</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-slate-500">Aucune notification.</div>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item.id} className="border-b border-slate-100 last:border-0">
                <button
                  type="button"
                  onClick={() => void handleItemClick(item)}
                  className={`flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50 ${
                    item.readAt ? "" : "bg-blue-50/60"
                  }`}
                >
                  {!item.readAt ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-600" /> : null}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                    {item.body ? <div className="mt-0.5 text-sm text-slate-600">{item.body}</div> : null}
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                      <span>{formatDate(item.createdAt)}</span>
                      {item.business ? <span>&middot; {item.business.name}</span> : null}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between px-5 py-4">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Precedent
          </button>
          <span className="text-sm text-slate-500">Page {page}/{Math.max(1, lastPage)}</span>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(lastPage, prev + 1))}
            disabled={page >= lastPage}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Suivant
          </button>
        </div>
      </section>
    </div>
  );
}
