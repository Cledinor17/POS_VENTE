"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { resendVerificationCode, verifyRegistration } from "@/lib/authApi";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/context/AuthContext";

export default function VerifyAccountForm() {
  const t = useTranslations("auth.verify");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuth();
  const initialEmail = searchParams.get("email") ?? "";
  const initialDebugCode = searchParams.get("debug") ?? "";

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [debugCode, setDebugCode] = useState(initialDebugCode);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const canSubmit = useMemo(() => email.trim().length > 0 && code.trim().length > 0, [email, code]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      await verifyRegistration({ email, code });
      await refresh();
      router.replace("/onboarding/business");
    } catch (err) {
      setError(getErrorMessage(err, t("generic_error")));
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    setError("");
    setMessage("");
    setResending(true);

    try {
      const result = await resendVerificationCode(email);
      setMessage(result.message);
      setDebugCode(result.debug_code ?? "");
    } catch (err) {
      setError(getErrorMessage(err, t("generic_error")));
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold text-slate-900">{t("title")}</h2>
        <p className="text-sm leading-6 text-slate-500">{t("subtitle")}</p>
      </div>

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      {debugCode ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("debug_code_prefix")} <span className="font-semibold">{debugCode}</span>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700">{t("email_label")}</label>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#0b4f88]"
            placeholder="nom@entreprise.com"
          />
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

        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="w-full rounded-2xl bg-[#0b4f88] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0a4273] disabled:opacity-60"
        >
          {loading ? t("submit_loading") : t("submit")}
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <button
          type="button"
          onClick={onResend}
          disabled={resending || email.trim().length === 0}
          className="font-semibold text-[#0b4f88] hover:text-[#f59e0b] disabled:opacity-60"
        >
          {resending ? t("resend_loading") : t("resend")}
        </button>

        <Link href="/login" className="text-slate-500 hover:text-slate-700">
          {t("back_to_login")}
        </Link>
      </div>
    </div>
  );
}
