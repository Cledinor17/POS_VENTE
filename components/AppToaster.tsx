"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import {
  APP_TOAST_EVENT,
  type AppToastPayload,
  type AppToastTone,
} from "@/lib/toast";

type ToastItem = {
  id: number;
  tone: AppToastTone;
  message: string;
};

const DEFAULT_DURATION_MS = 2800;

const LEGACY_NOTICE_SELECTOR = [
  "section.rounded-xl.border.px-4.py-3.text-sm.border-rose-200.bg-rose-50",
  "div.rounded-xl.border.px-4.py-3.text-sm.border-rose-200.bg-rose-50",
  "div.rounded-xl.border.p-3.text-sm.border-red-200.bg-red-50.text-red-600",
  "div.rounded-lg.border.p-3.text-sm.border-red-200.bg-red-50.text-red-600",
  "section.rounded-xl.border.px-4.py-3.text-sm.border-emerald-200.bg-emerald-50",
  "div.rounded-xl.border.px-4.py-3.text-sm.border-emerald-200.bg-emerald-50",
  "section.rounded-xl.border.px-4.py-3.text-sm.border-amber-200.bg-amber-50",
  "div.rounded-xl.border.px-4.py-3.text-sm.border-amber-200.bg-amber-50",
  "section.rounded-xl.border.px-4.py-3.text-sm.border-blue-200.bg-blue-50",
  "div.rounded-xl.border.px-4.py-3.text-sm.border-blue-200.bg-blue-50",
].join(",");

function normalizeMessage(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function inferLegacyTone(node: Element): AppToastTone | null {
  const classes = node.className;
  if (typeof classes !== "string") return null;
  if (
    classes.includes("border-rose-200") ||
    classes.includes("text-rose-700") ||
    classes.includes("border-red-200") ||
    classes.includes("text-red-600") ||
    classes.includes("text-red-700")
  ) {
    return "error";
  }
  if (
    classes.includes("border-emerald-200") ||
    classes.includes("text-emerald-700")
  ) {
    return "success";
  }
  if (
    classes.includes("border-amber-200") ||
    classes.includes("text-amber-700")
  ) {
    return "warning";
  }
  if (classes.includes("border-blue-200") || classes.includes("text-blue-700")) {
    return "info";
  }
  return null;
}

export default function AppToaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timeoutByIdRef = useRef<Record<number, number>>({});
  const legacyTextByNodeRef = useRef<WeakMap<Element, string>>(new WeakMap());
  const lastPushedRef = useRef<{ key: string; at: number }>({ key: "", at: 0 });
  const idCounterRef = useRef(0);

  function nextToastId(): number {
    idCounterRef.current += 1;
    if (idCounterRef.current >= Number.MAX_SAFE_INTEGER) {
      idCounterRef.current = 1;
    }
    return idCounterRef.current;
  }

  function removeToast(id: number) {
    setItems((prev) => prev.filter((item) => item.id !== id));
    const timer = timeoutByIdRef.current[id];
    if (timer) {
      window.clearTimeout(timer);
      delete timeoutByIdRef.current[id];
    }
  }

  function pushToast(payload: AppToastPayload) {
    const message = normalizeMessage(payload.message || "");
    if (!message) return;

    const tone = payload.tone;
    const dedupeKey = `${tone}:${message}`;
    const now = Date.now();
    if (
      lastPushedRef.current.key === dedupeKey &&
      now - lastPushedRef.current.at < 600
    ) {
      return;
    }
    lastPushedRef.current = { key: dedupeKey, at: now };

    const id = nextToastId();
    const durationMs = payload.durationMs ?? DEFAULT_DURATION_MS;
    setItems((prev) => [...prev.slice(-3), { id, tone, message }]);
    timeoutByIdRef.current[id] = window.setTimeout(() => {
      removeToast(id);
    }, durationMs);
  }

  useEffect(() => {
    const handleToast = (event: Event) => {
      const custom = event as CustomEvent<AppToastPayload>;
      if (!custom.detail) return;
      pushToast(custom.detail);
    };

    window.addEventListener(APP_TOAST_EVENT, handleToast as EventListener);
    return () => {
      window.removeEventListener(APP_TOAST_EVENT, handleToast as EventListener);
    };
  }, []);

  useEffect(() => {
    const syncLegacyNotices = () => {
      const nodes = document.querySelectorAll(LEGACY_NOTICE_SELECTOR);
      nodes.forEach((node) => {
        if (node.closest('[data-app-toaster-root="1"]')) return;
        const tone = inferLegacyTone(node);
        if (!tone) return;
        const text = normalizeMessage(node.textContent || "");
        if (!text) return;

        const prevText = legacyTextByNodeRef.current.get(node) || "";
        if (prevText !== text) {
          legacyTextByNodeRef.current.set(node, text);
          pushToast({ tone, message: text });
        }

        if (node instanceof HTMLElement) {
          node.style.display = "none";
          node.setAttribute("data-toast-bridged", "1");
        }
      });
    };

    let frameId = 0;
    const scheduleSync = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        syncLegacyNotices();
      });
    };

    scheduleSync();
    const observer = new MutationObserver(() => {
      scheduleSync();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => {
      observer.disconnect();
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    return () => {
      Object.values(timeoutByIdRef.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      timeoutByIdRef.current = {};
    };
  }, []);

  const rendered = useMemo(
    () =>
      items.map((item) => {
        const toneClasses =
          item.tone === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : item.tone === "warning"
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : item.tone === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-blue-200 bg-blue-50 text-blue-700";
        const Icon =
          item.tone === "success"
            ? CheckCircle2
            : item.tone === "warning" || item.tone === "error"
              ? AlertCircle
              : Info;
        return (
          <section
            key={item.id}
            className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-lg ${toneClasses}`}
            role={item.tone === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            <div className="flex items-start gap-2">
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1">{item.message}</span>
              <button
                onClick={() => removeToast(item.id)}
                className="rounded p-0.5 opacity-70 hover:opacity-100"
                aria-label="Fermer notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </section>
        );
      }),
    [items],
  );

  if (items.length === 0) return null;
  return (
    <div
      data-app-toaster-root="1"
      className="pointer-events-none fixed right-4 top-20 z-[90] flex w-[min(92vw,360px)] flex-col gap-2"
    >
      {rendered}
    </div>
  );
}
