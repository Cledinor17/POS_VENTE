"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BedDouble, Building2, CreditCard, ShieldCheck } from "lucide-react";

type FeatureCard = {
  icon: LucideIcon;
  title: string;
  text: string;
};

type AuthShellProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  panelPosition?: "left" | "right";
  featureCards?: FeatureCard[];
  visual?: ReactNode;
};

const FEATURE_CARDS: FeatureCard[] = [
  {
    icon: BedDouble,
    title: "Reservations et sejours",
    text: "Suivi hotel, moments, housekeeping et night audit dans un seul systeme.",
  },
  {
    icon: CreditCard,
    title: "Facturation centralisee",
    text: "Bar, piscine, commandes hotel et paiements relies au bon business.",
  },
  {
    icon: Building2,
    title: "Multi business",
    text: "Chaque compte peut creer et piloter son entreprise dans un espace dedie.",
  },
  {
    icon: ShieldCheck,
    title: "Trace utilisateur",
    text: "Les operations restent reliees a l utilisateur connecte et au business actif.",
  },
];

export default function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  panelPosition = "right",
  featureCards = FEATURE_CARDS,
  visual,
}: AuthShellProps) {
  const formFirst = panelPosition === "left";

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top_left,_rgba(11,79,136,0.18),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.16),_transparent_34%),linear-gradient(180deg,_#f8fafc_0%,_#eef4ff_100%)] p-3 sm:p-4 md:p-8">
      <div className="mx-auto grid min-h-[calc(100dvh-1.5rem)] max-w-7xl items-stretch gap-4 sm:gap-6 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[1.1fr_0.9fr]">
        <section
          className={`flex items-start justify-center lg:items-center ${formFirst ? "lg:order-1" : "lg:order-2"}`}
        >
          <div className="w-full max-w-xl rounded-[1.6rem] border border-slate-200/80 bg-white/95 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:rounded-[2rem] sm:p-6 md:p-8">
            {children}
            {footer ? <div className="mt-6 border-t border-slate-100 pt-5">{footer}</div> : null}
          </div>
        </section>

        <section
          className={`relative overflow-hidden rounded-[1.6rem] border border-white/60 bg-gradient-to-br from-[#0b4f88] via-[#0d63b8] to-[#f59e0b] p-5 text-white shadow-[0_30px_80px_rgba(11,79,136,0.18)] sm:rounded-[2rem] sm:p-6 md:p-8 lg:p-10 ${formFirst ? "lg:order-2" : "lg:order-1"}`}
        >
          <div className="absolute -left-16 top-6 h-32 w-32 rounded-full bg-white/10 blur-2xl sm:top-10 sm:h-40 sm:w-40" />
          <div className="absolute right-0 top-1/3 h-32 w-32 rounded-full bg-orange-200/20 blur-3xl sm:h-48 sm:w-48" />

          <div className="relative flex h-full flex-col">
            <div className="inline-flex w-fit items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100">
              {eyebrow}
            </div>

            <div className="mt-4 max-w-2xl sm:mt-6">
              <h1 className="text-3xl font-semibold leading-tight sm:text-4xl md:text-5xl">{title}</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-100/90 md:mt-4 md:text-base">{subtitle}</p>
            </div>

            {visual ? (
              <div className="mt-5 flex-1 sm:mt-8">{visual}</div>
            ) : (
              <>
                <div className="mt-5 grid gap-3 sm:mt-8 sm:gap-4 md:grid-cols-2">
                  {featureCards.map((feature) => {
                    const Icon = feature.icon;
                    return (
                      <article
                        key={feature.title}
                        className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm"
                      >
                        <div className="inline-flex rounded-xl bg-white/15 p-2 text-white">
                          <Icon className="h-5 w-5" />
                        </div>
                        <h2 className="mt-3 text-lg font-semibold">{feature.title}</h2>
                        <p className="mt-1 text-sm leading-6 text-slate-100/85">{feature.text}</p>
                      </article>
                    );
                  })}
                </div>

                <div className="mt-auto pt-6 text-sm text-slate-100/85 sm:pt-8">
                  <p>Business ready from day one.</p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <Link href="/login" className="rounded-full border border-white/20 px-3 py-1 hover:bg-white/10">
                      Connexion
                    </Link>
                    <Link href="/register" className="rounded-full border border-white/20 px-3 py-1 hover:bg-white/10">
                      Creer un compte
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
