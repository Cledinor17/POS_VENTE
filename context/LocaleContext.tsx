"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getToken } from "@/lib/api";
import { updateLocale as updateLocaleApi } from "@/lib/authApi";
import { getStoredLocale, isSupportedLocale, setStoredLocale, type Locale } from "@/lib/locale";

import fr from "@/messages/fr.json";
import en from "@/messages/en.json";
import ht from "@/messages/ht.json";
import es from "@/messages/es.json";
import zh from "@/messages/zh.json";
import ar from "@/messages/ar.json";

const MESSAGES: Record<Locale, Record<string, unknown>> = { fr, en, ht, es, zh, ar };

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // Reconcile with a client-only cookie value that may differ from what the
  // server saw when it rendered the root layout (e.g. first paint after the
  // cookie was just set client-side).
  useEffect(() => {
    const stored = getStoredLocale();
    setLocaleState((current) => (stored !== current ? stored : current));
  }, []);

  // A returning user's server-stored preference (from /api/me) can win over
  // whatever is in the cookie on this device, mirroring the existing
  // "pos-cart-count-changed" cross-component event pattern in this app.
  useEffect(() => {
    function handleLocaleChanged(event: Event) {
      const custom = event as CustomEvent<string>;
      if (isSupportedLocale(custom.detail)) {
        setLocaleState(custom.detail);
      }
    }

    window.addEventListener("pos-locale-changed", handleLocaleChanged as EventListener);
    return () => window.removeEventListener("pos-locale-changed", handleLocaleChanged as EventListener);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    setStoredLocale(next);
    if (getToken()) {
      updateLocaleApi(next).catch(() => {});
    }
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return (
    <LocaleContext.Provider value={value}>
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="America/Port-au-Prince">
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}

export function useAppLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useAppLocale must be used within LocaleProvider");
  return ctx;
}
