"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ShieldCheck, Landmark, SlidersHorizontal, Building2 } from "lucide-react";

type SettingItem = {
  title: string;
  description: string;
  href: (business: string) => string;
  icon: React.ComponentType<{ className?: string }>;
};

const items: SettingItem[] = [
  {
    title: "MY Business",
    description: "Modifier les informations de ton business actif.",
    href: (business) => `/${business}/business`,
    icon: Building2,
  },
  {
    title: "Audit et securite",
    description: "Consulte les actions sensibles et les traces systeme.",
    href: (business) => `/${business}/audit`,
    icon: ShieldCheck,
  },
  {
    title: "Periodes comptables",
    description: "Ouvre ou cloture les periodes pour verrouiller les ecritures.",
    href: (business) => `/${business}/accounting/periods`,
    icon: Landmark,
  },
  {
    title: "Modele de parametrage",
    description: "Base prete pour brancher les futurs reglages metier.",
    href: (business) => `/${business}/dashboard`,
    icon: SlidersHorizontal,
  },
];

export default function SettingsPage() {
  const params = useParams<{ business: string }>();
  const business = params?.business ?? "";

  return (
    <div className="space-y-6">
      <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Parametres</h1>
        <p className="text-slate-500 mt-1">
          Centralise les reglages d administration sans changer le flux actuel.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.title}
              href={item.href(business)}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:border-blue-200 hover:bg-orange-50 transition-colors"
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#0d63b8]">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-3 text-base font-semibold text-slate-900">
                {item.title}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{item.description}</p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
