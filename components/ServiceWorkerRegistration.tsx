"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // Never register in dev: Turbopack's dev chunk URLs aren't
      // content-hashed/immutable like production's, so a cache-first SW can
      // serve a stale JS chunk against freshly changed server-rendered HTML
      // and cause hydration mismatches on every code change. Also
      // proactively unregister a dev-registered SW from before this guard
      // existed, so already-affected browsers self-heal without DevTools.
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          registrations.forEach((registration) => registration.unregister());
        })
        .catch(() => {
          // Some browsers/policies deny Service Worker access outright
          // (NotSupportedError) — nothing to clean up in that case.
        });
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline mode is a progressive enhancement — registration failure
      // must never block the app from working online.
    });
  }, []);

  return null;
}
