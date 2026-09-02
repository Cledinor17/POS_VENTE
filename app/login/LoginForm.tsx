"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { login } from "../../lib/authApi";
import { ApiError } from "../../lib/api";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../context/AuthContext";

export default function LoginForm() {
  const t = useTranslations("auth.login");
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      await login(email, password);
      const data = await refresh();
      if (!data?.user) {
        setErr(t("profile_load_failed"));
        return;
      }

      const isSafeNext = typeof next === "string" && next.startsWith("/") && !next.startsWith("//");
      if (isSafeNext) {
        router.replace(next);
        return;
      }

      const slug = data?.activeBusiness?.slug || data?.businesses?.[0]?.slug;
      router.replace(slug ? `/${slug}/dashboard` : "/onboarding/business");
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 403 && error.body && typeof error.body === "object") {
        const body = error.body as Record<string, unknown>;
        if (body.requires_verification === true && typeof body.email === "string") {
          const params = new URLSearchParams({ email: body.email });
          if (typeof body.debug_code === "string" && body.debug_code.trim().length > 0) {
            params.set("debug", body.debug_code);
          }
          router.replace(`/verify-account?${params.toString()}`);
          return;
        }
      }

      setErr(getErrorMessage(error, t("generic_error")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-7">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.12)] sm:h-20 sm:w-20 sm:rounded-3xl">
          <Image src="/logo.png" alt="FC Manager" width={72} height={72} className="h-12 w-12 object-contain sm:h-14 sm:w-14" />
        </div>
        <div className="mx-auto h-1 w-12 rounded-full bg-[#d4af37]" />
        <h2 className="text-[1.65rem] font-semibold tracking-tight text-[#0f172a] sm:text-[2rem]">{t("title")}</h2>
        <p className="mx-auto max-w-sm text-sm leading-6 text-slate-500">{t("subtitle")}</p>
      </div>

      {err ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 shadow-sm">
          {err}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-4">
          <div className="group relative">
            <span className="pointer-events-none absolute left-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg bg-white text-slate-400 shadow-sm ring-1 ring-slate-200 transition group-focus-within:text-[#d4af37] group-focus-within:ring-[#d4af37]/40 sm:left-3">
              <Mail className="h-4 w-4" />
            </span>
            <input
              type="email"
              required
              className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-14 pr-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/15 sm:pl-16"
              placeholder={t("email_placeholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="group relative">
            <span className="pointer-events-none absolute left-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg bg-white text-slate-400 shadow-sm ring-1 ring-slate-200 transition group-focus-within:text-[#d4af37] group-focus-within:ring-[#d4af37]/40 sm:left-3">
              <Lock className="h-4 w-4" />
            </span>
            <input
              type="password"
              required
              className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-14 pr-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/15 sm:pl-16"
              placeholder={t("password_placeholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="flex flex-col items-start gap-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <Link href="/forgot-password" className="font-medium text-slate-600 transition hover:text-[#d4af37]">
              {t("forgot_password_link")}
            </Link>
            <Link href="/verify-account" className="font-medium text-slate-600 transition hover:text-[#d4af37]">
              {t("forgot_code_link")}
            </Link>
          </div>

          <button
            className="group inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#0f172a] px-4 text-base font-semibold text-white shadow-[0_14px_30px_rgba(15,23,42,0.24)] transition hover:-translate-y-0.5 hover:bg-[#1e293b] hover:shadow-[0_18px_36px_rgba(15,23,42,0.28)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
            disabled={loading}
          >
            <span>{loading ? t("submit_loading") : t("submit")}</span>
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </button>
        </div>
      </form>

      <p className="text-center text-sm text-slate-500">
        {t("no_account")}{" "}
        <Link href="/register" className="font-semibold text-[#0f172a] transition hover:text-[#d4af37]">
          {t("create_business_link")}
        </Link>
      </p>

      <p className="text-center text-xs text-slate-400">
        <Link href="/faq" className="underline underline-offset-2 hover:text-[#0f172a]">
          {t("faq_link")}
        </Link>
      </p>
    </div>
  );
}
