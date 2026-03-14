"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

const LINKS = [
  { label: "Dashboard", href: "dashboard", hint: "KPI occupation, ADR, RevPAR" },
  { label: "Planning", href: "planning", hint: "Disponibilite 14 jours (PMS board)" },
  { label: "Categories", href: "categories", hint: "Classification chambres + image" },
  { label: "Chambres", href: "rooms", hint: "Gestion chambres + slideshow" },
  { label: "Reservations", href: "reservations", hint: "Booking par chambre" },
  { label: "Folios", href: "folios", hint: "Facturation, charges, paiements et balance" },
  { label: "Moments (2h)", href: "moments", hint: "Creneaux rapides 120 minutes" },
  { label: "Housekeeping", href: "housekeeping", hint: "Nettoyage, inspection, maintenance" },
  { label: "Night Audit", href: "night-audit", hint: "Cloture journaliere et controles revenus" },
  { label: "Accessoires", href: "amenities", hint: "Services / equipements proposes" },
  { label: "Necessaires", href: "necessities", hint: "Stock des necessaires hotel" },
];

export default function HotelModuleHomePage() {
  const params = useParams<{ business: string }>();
  const business = params?.business ?? "";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-extrabold text-slate-900">Gestion Hotel</h1>
        <p className="mt-2 text-sm text-slate-600">
          Module hotel actif pour <span className="font-semibold">{business.toUpperCase()}</span>.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {LINKS.map((item) => (
          <Link
            key={item.href}
            href={business ? `/${business}/hotel/${item.href}` : "/"}
            className="rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-blue-300 hover:bg-blue-50"
          >
            <div className="text-base font-bold text-slate-900">{item.label}</div>
            <div className="mt-1 text-sm text-slate-600">{item.hint}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
