"use client";

import type { ReactNode } from "react";
import Link from "next/link";

export default function AuthPortalShell({
  activeTab,
  children,
}: {
  activeTab: "login" | "register";
  children: ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] w-full bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.12),_transparent_26%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)]">
      <div className="flex min-h-[100dvh] w-full flex-col bg-white lg:flex-row">
        <aside
          className="relative flex min-h-[240px] w-full flex-col justify-center overflow-hidden lg:min-h-[100dvh] lg:w-[47%]"
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
                Portail hotelier
              </div>
              <h1 className="mt-5 text-3xl font-semibold leading-tight sm:text-4xl xl:text-[2.65rem]">
                Suite<span className="text-[#d4af37]">Manager</span>
              </h1>
              <p className="mt-3 max-w-md text-sm leading-6 text-slate-100/88 sm:text-base sm:leading-7">
                La plateforme centralisee pour gerer votre etablissement hotelier. Connectez-vous a
                votre espace ou creez votre business pour commencer.
              </p>
            </div>
          </div>
        </aside>

        <section className="flex flex-1 flex-col justify-center bg-white px-5 py-6 sm:px-8 sm:py-8 lg:min-h-[100dvh] lg:overflow-y-auto lg:px-12 lg:py-10 xl:px-16">
          <div className="mx-auto w-full max-w-[520px]">
            <div className="mb-8 rounded-xl bg-[#f1f5f9] p-1.5">
              <div className="grid grid-cols-2 gap-1.5">
                <Link
                  href="/login"
                  className={`rounded-lg px-4 py-3 text-center text-sm font-medium transition ${
                    activeTab === "login"
                      ? "bg-white text-[#0f172a] shadow-[0_6px_18px_rgba(15,23,42,0.08)]"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Connexion
                </Link>
                <Link
                  href="/register"
                  className={`rounded-lg px-4 py-3 text-center text-sm font-medium transition ${
                    activeTab === "register"
                      ? "bg-white text-[#0f172a] shadow-[0_6px_18px_rgba(15,23,42,0.08)]"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Creer un etablissement
                </Link>
              </div>
            </div>

            <div className="space-y-6">{children}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
