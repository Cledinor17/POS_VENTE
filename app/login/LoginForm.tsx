"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { login } from "../../lib/authApi";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

type ErrorBody = { message?: unknown };

function getLoginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.body && typeof error.body === "object") {
      const body = error.body as ErrorBody;
      if (typeof body.message === "string" && body.message.length > 0) {
        return body.message;
      }
    }
    return error.message;
  }
  return "Echec de la connexion";
}

export default function LoginForm() {
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
        setErr("Connexion etablie, mais impossible de charger le profil (/api/me).");
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

      setErr(getLoginErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-[1.9rem] font-semibold tracking-tight text-[#0f172a]">Bon retour !</h2>
        <p className="text-sm leading-6 text-slate-400">
          Entrez vos identifiants pour acceder a votre espace hotelier.
        </p>
      </div>

      {err ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
          {err}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-4">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              required
              className="w-full rounded-xl border border-transparent bg-[#f1f5f9] py-3.5 pl-12 pr-4 text-slate-700 outline-none transition focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10"
              placeholder="Adresse e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="relative">
            <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="password"
              required
              className="w-full rounded-xl border border-transparent bg-[#f1f5f9] py-3.5 pl-12 pr-4 text-slate-700 outline-none transition focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end text-sm">
            <Link href="/verify-account" className="font-medium text-[#0f172a] hover:text-[#d4af37]">
              J ai deja un code de validation
            </Link>
          </div>

          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0f172a] px-4 py-3.5 text-base font-medium text-white transition hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading}
          >
            <span>{loading ? "Connexion en cours..." : "Se connecter"}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>

      <p className="text-sm text-slate-500">
        Nouveau sur la plateforme ?{" "}
        <Link href="/register" className="font-semibold text-[#0f172a] hover:text-[#d4af37]">
          Creer un etablissement
        </Link>
      </p>
    </div>
  );
}
