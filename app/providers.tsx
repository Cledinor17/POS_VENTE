"use client";

import { AuthProvider } from "@/context/AuthContext";
import { LocaleProvider } from "@/context/LocaleContext";
import AppToaster from "@/components/AppToaster";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import type { Locale } from "@/lib/locale";

export default function Providers({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: Locale;
}) {
  return (
    <LocaleProvider initialLocale={locale}>
      <AuthProvider>
        {children}
        <AppToaster />
        <ServiceWorkerRegistration />
      </AuthProvider>
    </LocaleProvider>
  );
}
