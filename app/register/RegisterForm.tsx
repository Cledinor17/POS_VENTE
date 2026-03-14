"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Mail, UserRound } from "lucide-react";
import { ApiError } from "@/lib/api";
import { registerAccount } from "@/lib/authApi";

type ErrorBody = { message?: unknown };

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.body && typeof error.body === "object") {
      const body = error.body as ErrorBody;
      if (typeof body.message === "string" && body.message.length > 0) return body.message;
    }
    return error.message;
  }

  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return "Impossible de creer le compte.";
}

export default function RegisterForm() {
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
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-[1.9rem] font-semibold tracking-tight text-[#0f172a]">Rejoignez-nous</h2>
        <p className="text-sm leading-6 text-slate-400">
          Enregistrez votre compte et commencez a gerer votre etablissement.
        </p>
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
              placeholder="Nom complet"
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
              placeholder="E-mail professionnel"
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
              placeholder="Creer un mot de passe"
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
              placeholder="Confirmer le mot de passe"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#d4af37] px-4 py-3.5 text-base font-medium text-[#0f172a] transition hover:bg-[#c29b25] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>{loading ? "Creation du compte..." : "Creer mon espace business"}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>

      <p className="text-sm text-slate-500">
        Vous avez deja un compte ?{" "}
        <Link href="/login" className="font-semibold text-[#0f172a] hover:text-[#d4af37]">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
