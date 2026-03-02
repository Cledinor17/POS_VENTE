"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/context/AuthContext";
import { logout } from "@/lib/authApi";

export default function AppLandingPage() {
  const router = useRouter();
  const { activeBusiness, businesses, loading, clear } = useAuth();

  useEffect(() => {
    if (loading) return;

    const slug = activeBusiness?.slug || businesses[0]?.slug;
    if (!slug) return;

    router.replace(`/${slug}/dashboard`);
  }, [activeBusiness, businesses, loading, router]);

  async function onLogout() {
    try {
      await logout();
    } finally {
      clear();
      router.replace("/login");
    }
  }

  const slug = activeBusiness?.slug || businesses[0]?.slug;

  return (
    <RequireAuth>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {slug ? (
            <p className="text-slate-700">Redirection en cours...</p>
          ) : (
            <div className="space-y-4">
              <h1 className="text-xl font-semibold text-slate-900">Aucun business assigne</h1>
              <p className="text-slate-600">
                Votre compte est authentifie mais aucun business actif n&apos;est disponible.
              </p>
              <button
                className="rounded-xl border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
                onClick={onLogout}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </RequireAuth>
  );
}
