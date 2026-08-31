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
}: {
  children: ReactNode;
}) {
  const { locale, setLocale } = useAppLocale();
  const t = useTranslations("auth.shell");

  return (
    <div className="min-h-[100dvh] w-full bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.12),_transparent_26%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)]">
      <div className="flex items-center justify-end gap-2 border-b border-slate-100 bg-white px-5 py-2.5 sm:px-8">
        <Languages className="h-4 w-4 shrink-0 text-slate-500" />
        <select
          value={locale}
          onChange={(event) => setLocale(event.target.value as Locale)}
          aria-label="Langue"
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 outline-none transition focus:border-[#0f172a]"
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col items-center gap-1 border-b border-slate-100 bg-white px-5 py-4 text-center lg:hidden">
        <Image src="/logo.png" alt="FC Manager" width={56} height={56} className="mb-1 h-14 w-14 object-contain" />
        <span className="text-xl font-semibold tracking-tight text-[#0f172a]">
          FC <span className="text-[#d4af37]">Manager</span>
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          {t("badge")}
        </span>
      </div>
      <div className="flex min-h-[100dvh] w-full flex-col bg-white lg:flex-row">
        <aside
          className="relative hidden min-h-[240px] w-full flex-col justify-center overflow-hidden lg:flex lg:min-h-[100dvh] lg:w-[47%]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(15,23,42,0.72), rgba(15,23,42,0.9)), url('https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(212,175,55,0.28),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(255,255,255,0.08),_transparent_24%)]" />

          <div className="relative z-10 flex h-full flex-col justify-center px-5 py-8 text-white sm:px-8 sm:py-10 lg:px-10 xl:px-12">
            <div>
              <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-100/90">
                {t("badge")}
              </div>
              <h1 className="mt-5 text-3xl font-semibold leading-tight sm:text-4xl xl:text-[2.65rem]">
                FC <span className="text-[#d4af37]">Manager</span>
              </h1>
              <p className="mt-3 max-w-md text-sm leading-6 text-slate-100/88 sm:text-base sm:leading-7">
                {t("tagline")}
              </p>
            </div>
          </div>
        </aside>

        <section className="flex flex-1 flex-col justify-center bg-white px-5 py-6 sm:px-8 sm:py-8 lg:min-h-[100dvh] lg:overflow-y-auto lg:px-12 lg:py-10 xl:px-16">
          <div className="mx-auto w-full max-w-[520px]">
            <div className="mb-6 hidden justify-center lg:flex">
              <Image src="/logo.png" alt="FC Manager" width={72} height={72} className="h-16 w-16 object-contain" />
            </div>
            <div className="space-y-6">{children}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
