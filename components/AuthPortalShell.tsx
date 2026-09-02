"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { Languages } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAppLocale } from "@/context/LocaleContext";
import type { Locale } from "@/lib/locale";

const LANGUAGE_OPTIONS: Array<{ value: Locale; label: string }> = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
  { value: "ht", label: "Kreyòl ayisyen" },
  { value: "es", label: "Español" },
  { value: "zh", label: "中文" },
  { value: "ar", label: "العربية" },
];

export default function AuthPortalShell({
  children,
  showMobileBrandLogo = true,
  showDesktopFormLogo = true,
}: {
  children: ReactNode;
  showMobileBrandLogo?: boolean;
  showDesktopFormLogo?: boolean;
}) {
  const { locale, setLocale } = useAppLocale();
  const t = useTranslations("auth.shell");

  return (
    <div className="min-h-[100dvh] w-full bg-[linear-gradient(135deg,#f8fafc_0%,#eef2f7_55%,#fff7ed_100%)]">
      <div className="flex items-center justify-end gap-2 border-b border-slate-200/70 bg-white/90 px-5 py-2.5 backdrop-blur sm:px-8">
        <Languages className="h-4 w-4 shrink-0 text-slate-500" />
        <select
          value={locale}
          onChange={(event) => setLocale(event.target.value as Locale)}
          aria-label="Langue"
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-medium text-slate-700 outline-none transition focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20"
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col items-center gap-1 border-b border-slate-200/70 bg-white/95 px-4 py-4 text-center shadow-sm sm:px-5 lg:hidden">
        {showMobileBrandLogo ? (
          <div className="mb-1 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Image src="/logo.png" alt="FC Manager" width={56} height={56} className="h-12 w-12 object-contain" />
          </div>
        ) : null}
        <span className="text-xl font-semibold tracking-tight text-[#0f172a]">
          FC <span className="text-[#d4af37]">Manager</span>
        </span>
        <span className="max-w-full px-2 text-[10px] font-semibold uppercase leading-4 tracking-[0.12em] text-slate-400 sm:tracking-[0.22em]">
          {t("badge")}
        </span>
      </div>
      <div className="flex min-h-[calc(100dvh-52px)] w-full flex-col lg:flex-row">
        <aside
          className="relative hidden min-h-[240px] w-full flex-col justify-center overflow-hidden lg:flex lg:min-h-[calc(100dvh-52px)] lg:w-[47%]"
          style={{
            backgroundImage:
              "linear-gradient(135deg,rgba(15,23,42,0.82),rgba(15,23,42,0.64) 45%,rgba(8,47,73,0.78)), url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1400&q=80')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0f172a]/70 to-transparent" />
          <div className="absolute left-0 top-0 h-full w-1 bg-[#d4af37]" />

          <div className="relative z-10 flex h-full flex-col justify-center px-5 py-8 text-white sm:px-8 sm:py-10 lg:px-10 xl:px-12">
            <div>
              <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-100/90 shadow-sm backdrop-blur">
                {t("badge")}
              </div>
              <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-5xl xl:text-[3.25rem]">
                FC <span className="text-[#d4af37]">Manager</span>
              </h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-slate-100/90 sm:text-base sm:leading-7">
                {t("tagline")}
              </p>
            </div>
          </div>
        </aside>

        <section className="flex flex-1 flex-col justify-start px-4 pb-6 pt-16 sm:px-8 sm:pb-8 sm:pt-20 md:justify-center md:py-8 lg:min-h-[calc(100dvh-52px)] lg:overflow-y-auto lg:px-12 lg:py-10 xl:px-16">
          <div className="mx-auto w-full max-w-[520px]">
            {showDesktopFormLogo ? (
              <div className="mb-6 hidden justify-center lg:flex">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
                  <Image src="/logo.png" alt="FC Manager" width={72} height={72} className="h-14 w-14 object-contain" />
                </div>
              </div>
            ) : null}
            <div className="rounded-2xl border border-white/80 bg-white/95 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.14)] backdrop-blur sm:rounded-[1.75rem] sm:p-8">
              {children}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
