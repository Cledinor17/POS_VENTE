// app/login/LoginForm.tsx
"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
      router.replace(slug ? `/${slug}/dashboard` : "/");
    } catch (error: unknown) {
      setErr(getLoginErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 space-y-6 shadow-sm">
      {/* ... gardez exactement le même contenu du form que vous aviez ... */}
       <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">Connexion</h1>
          <p className="text-slate-500 text-sm">Entrez vos identifiants pour acceder a votre POS.</p>
        </div>
        {err && (
          <div className="border border-red-200 bg-red-50 text-red-600 text-sm rounded-lg p-3 animate-pulse">
            {err}
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Email</label>
            <input type="email" required className="mt-1 w-full border border-slate-300 rounded-xl px-4 py-2.5 outline-none" placeholder="nom@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Mot de passe</label>
            <input type="password" required className="mt-1 w-full border border-slate-300 rounded-xl px-4 py-2.5 outline-none" placeholder="********" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
        <button className="w-full brand-primary-btn text-white font-semibold rounded-xl px-4 py-3 disabled:opacity-50" disabled={loading}>
          {loading ? "Connexion en cours..." : "Se connecter"}
        </button>
    </form>
  );
}