"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Lock, Mail } from "lucide-react";
import { resetPassword } from "@/lib/authApi";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/context/AuthContext";

export default function ResetPasswordForm() {
  const t = useTranslations("auth.resetPassword");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuth();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await resetPassword({ email, code, password, passwordConfirmation });
      const data = await refresh();
      const slug = data?.activeBusiness?.slug || data?.businesses?.[0]?.slug;
      router.replace(slug ? `/${slug}/dashboard` : "/onboarding/business");
    } catch (err) {
      setError(getErrorMessage(err, t("generic_error")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold text-slate-900">{t("title")}</h2>
        <p className="text-sm leading-6 text-slate-500">{t("subtitle")}</p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700">{t("email_label")}</label>
          <div className="relative mt-1">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 py-3 pl-12 pr-4 outline-none transition focus:border-[#0b4f88]"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">{t("code_label")}</label>
          <input
            type="text"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-center text-lg tracking-[0.35em] outline-none transition focus:border-[#0b4f88]"
            placeholder={t("code_placeholder")}
            maxLength={12}
          />
        </div>

        <div className="relative">
          <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-2xl border border-slate-300 py-3 pl-12 pr-4 outline-none transition focus:border-[#0b4f88]"
            placeholder={t("password_placeholder")}
          />
        </div>

        <div className="relative">
          <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="password"
            required
            value={passwordConfirmation}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
            className="w-full rounded-2xl border border-slate-300 py-3 pl-12 pr-4 outline-none transition focus:border-[#0b4f88]"
            placeholder={t("confirm_placeholder")}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-[#0b4f88] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0a4273] disabled:opacity-60"
        >
          {loading ? t("submit_loading") : t("submit")}
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link href="/forgot-password" className="font-semibold text-[#0b4f88] hover:text-[#f59e0b]">
          {t("request_new_code_link")}
        </Link>

        <Link href="/login" className="text-slate-500 hover:text-slate-700">
          {t("back_to_login")}
        </Link>
      </div>
    </div>
  );
}
