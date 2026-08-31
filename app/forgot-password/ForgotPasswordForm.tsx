"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Mail } from "lucide-react";
import { forgotPassword } from "@/lib/authApi";
import { getErrorMessage } from "@/lib/errors";

export default function ForgotPasswordForm() {
  const t = useTranslations("auth.forgotPassword");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await forgotPassword(email);
      setMessage(result.message);
      setSubmitted(true);
    } catch (err) {
      setError(getErrorMessage(err, t("generic_error")));
    } finally {
      setLoading(false);
    }
  }

  function goToResetPassword() {
    router.push(`/reset-password?email=${encodeURIComponent(email)}`);
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

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="relative">
          <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-2xl border border-slate-300 py-3 pl-12 pr-4 outline-none transition focus:border-[#0b4f88]"
            placeholder={t("email_placeholder")}
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

      {submitted ? (
        <button
          type="button"
          onClick={goToResetPassword}
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          {t("code_received_link")}
        </button>
      ) : null}

      <div className="text-center text-sm">
        <Link href="/login" className="text-slate-500 hover:text-slate-700">
          {t("back_to_login")}
        </Link>
      </div>
    </div>
  );
}
