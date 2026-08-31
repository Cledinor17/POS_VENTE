"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, Lock, Mail, UserRound } from "lucide-react";
import { registerAccount } from "@/lib/authApi";
import { getErrorMessage } from "@/lib/errors";

export default function RegisterForm() {
  const t = useTranslations("auth.register");
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await registerAccount({
        name,
        email,
        password,
        passwordConfirmation,
      });

      const params = new URLSearchParams({ email: result.email });
      if (result.debug_code) params.set("debug", result.debug_code);
      router.replace(`/verify-account?${params.toString()}`);
    } catch (err) {
      setError(getErrorMessage(err, t("generic_error")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-[1.9rem] font-semibold tracking-tight text-[#0f172a]">{t("title")}</h2>
        <p className="text-sm leading-6 text-slate-400">{t("subtitle")}</p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-4">
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-xl border border-transparent bg-[#f1f5f9] py-3.5 pl-12 pr-4 text-slate-700 outline-none transition focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10"
              placeholder={t("name_placeholder")}
            />
          </div>

          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-transparent bg-[#f1f5f9] py-3.5 pl-12 pr-4 text-slate-700 outline-none transition focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10"
              placeholder={t("email_placeholder")}
            />
          </div>

          <div className="relative">
            <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-transparent bg-[#f1f5f9] py-3.5 pl-12 pr-4 text-slate-700 outline-none transition focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10"
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
              className="w-full rounded-xl border border-transparent bg-[#f1f5f9] py-3.5 pl-12 pr-4 text-slate-700 outline-none transition focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10"
              placeholder={t("confirm_placeholder")}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#d4af37] px-4 py-3.5 text-base font-medium text-[#0f172a] transition hover:bg-[#c29b25] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>{loading ? t("submit_loading") : t("submit")}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>

      <p className="text-sm text-slate-500">
        {t("have_account")}{" "}
        <Link href="/login" className="font-semibold text-[#0f172a] hover:text-[#d4af37]">
          {t("login_link")}
        </Link>
      </p>
    </div>
  );
}
