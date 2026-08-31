"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "../lib/notificationsApi";
import { subscribeToUserNotifications } from "../lib/realtime";

// Real-time push (see lib/realtime.ts) is the primary mechanism now; this is
// just a safety net if the WebSocket connection is unavailable (network,
// blocked, Reverb down, ...).
const POLL_INTERVAL_MS = 5 * 60_000;

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "a l'instant";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}

export default function NotificationBell({ business }: { business: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const openRef = useRef(open);
  openRef.current = open;

  const refreshUnreadCount = useCallback(async () => {
    try {
      const count = await getUnreadNotificationCount();
      setUnreadCount(count);
    } catch {
      // Silent: polling failures shouldn't disrupt the rest of the UI.
    }
  }, []);

  useEffect(() => {
    void refreshUnreadCount();
    const interval = setInterval(() => {
      void refreshUnreadCount();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshUnreadCount]);

  async function loadList() {
    setLoading(true);
    setError("");
    try {
      const res = await listNotifications({ perPage: 10 });
      setItems(res.items);
    } catch {
      setError("Impossible de charger les notifications.");
    } finally {
      setLoading(false);
    }
  }

  const loadListRef = useRef(loadList);
  loadListRef.current = loadList;

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    void subscribeToUserNotifications(userId, () => {
      void refreshUnreadCount();
      if (openRef.current) void loadListRef.current();
    }).then((fn) => {
      if (cancelled) fn();
      else unsubscribe = fn;
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [user?.id, refreshUnreadCount]);

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) void loadList();
  }

  async function handleItemClick(notification: AppNotification) {
    if (notification.readAt) return;
    setItems((prev) =>
      prev.map((item) => (item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await markNotificationRead(notification.id);
    } catch {
      void refreshUnreadCount();
    }
  }

  async function handleMarkAllRead() {
    setItems((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch {
      void refreshUnreadCount();
    }
  }

  return (
    <div className="relative">
      <button
        onClick={toggleOpen}
        className="relative inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-orange-50"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="h-4 w-4 text-slate-700" />
        {unreadCount > 0 ? (
          <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold inline-flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="font-semibold text-slate-900">Notifications</div>
            {unreadCount > 0 ? (
              <button
                onClick={() => void handleMarkAllRead()}
                className="text-xs font-semibold text-indigo-600 hover:underline"
              >
                Tout marquer comme lu
              </button>
            ) : null}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">Chargement...</div>
            ) : error ? (
              <div className="px-4 py-6 text-center text-sm text-rose-600">{error}</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">Aucune notification.</div>
            ) : (
              items.map((item) => {
                const content = (
                  <div
                    className={`px-4 py-3 border-b border-slate-50 last:border-0 transition-colors hover:bg-slate-50 ${
                      item.readAt ? "" : "bg-blue-50/60"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!item.readAt ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-600" /> : null}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                        {item.body ? <div className="mt-0.5 text-xs text-slate-600">{item.body}</div> : null}
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                          <span>{timeAgo(item.createdAt)}</span>
                          {item.business ? <span>· {item.business.name}</span> : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void handleItemClick(item)}
                    className="block w-full text-left"
                  >
                    {content}
                  </button>
                );
              })
            )}
          </div>

          {items.length > 0 ? (
            <div className="border-t border-slate-100 px-4 py-2 text-center">
              <Link
                href={`/${business}/notifications`}
                onClick={() => setOpen(false)}
                className="text-xs font-semibold text-indigo-600 hover:underline"
              >
                Voir toutes les notifications
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
