"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  BUSINESS_TYPES,
  createBusiness,
  SUPPORTED_CURRENCIES,
  type BusinessType,
} from "@/lib/businessApi";
import { RequireAuth } from "@/components/RequireAuth";
import PhoneField from "@/components/PhoneField";
import { useAuth } from "@/context/AuthContext";
import { Building2, MapPinned, Sparkles, Wallet } from "lucide-react";

type ModuleFlags = {
  has_hotel: boolean;
  has_restaurant: boolean;
  has_pool: boolean;
  has_services: boolean;
  has_moment: boolean;
};

const NO_MODULES: ModuleFlags = {
  has_hotel: false, has_restaurant: false, has_pool: false, has_services: false, has_moment: false,
};

const BUSINESS_TYPE_PRESETS: Record<BusinessType, { label: string; desc: string; flags: ModuleFlags }> = {
  hotel: {
    label: "Hotel",
    desc: "Chambres, reservations, restaurant, piscine, services, moments",
    flags: { has_hotel: true, has_restaurant: true, has_pool: true, has_services: true, has_moment: true },
  },
  restaurant: {
    label: "Restaurant",
    desc: "Tables, commandes et POS, sans module hotelier",
    flags: { ...NO_MODULES, has_restaurant: true },
  },
  bar_cafe: {
    label: "Bar / Cafe",
    desc: "Tables, commandes et POS, comme un restaurant",
    flags: { ...NO_MODULES, has_restaurant: true },
  },
  retail: {
    label: "Commerce de detail / Boutique",
    desc: "POS, stock et comptabilite",
    flags: NO_MODULES,
  },
  hardware_store: {
    label: "Quincaillerie",
    desc: "POS, stock et comptabilite",
    flags: NO_MODULES,
  },
  pharmacy: {
    label: "Pharmacie",
    desc: "POS, stock et comptabilite",
    flags: NO_MODULES,
  },
  supermarket: {
    label: "Supermarche / Epicerie",
    desc: "POS, stock et comptabilite",
    flags: NO_MODULES,
  },
  salon_beauty: {
    label: "Salon de beaute / Spa",
    desc: "POS, rendez-vous et prestations (module Services)",
    flags: { ...NO_MODULES, has_services: true },
  },
  garage: {
    label: "Garage / Mecanique",
    desc: "POS, stock de pieces et comptabilite",
    flags: NO_MODULES,
  },
  real_estate: {
    label: "Immobilier",
    desc: "Facturation, clients et comptabilite",
    flags: NO_MODULES,
  },
  clinic: {
    label: "Clinique / Centre de sante",
    desc: "Facturation, clients et comptabilite",
    flags: NO_MODULES,
  },
  school: {
    label: "Ecole / Centre de formation",
    desc: "Facturation, clients et comptabilite",
    flags: NO_MODULES,
  },
  fashion: {
    label: "Boutique de mode / Vetements",
    desc: "POS, stock et comptabilite",
    flags: NO_MODULES,
  },
  electronics: {
    label: "Electronique / Informatique",
    desc: "POS, stock et comptabilite",
    flags: NO_MODULES,
  },
  professional_services: {
    label: "Services professionnels",
    desc: "Facturation, clients et comptabilite",
    flags: NO_MODULES,
  },
  other: {
    label: "Autre",
    desc: "Tu configureras les modules ensuite dans Parametres",
    flags: NO_MODULES,
  },
};

type FormState = {
  name: string;
  slug: string;
  legalName: string;
  email: string;
  phone: string;
  website: string;
  taxNumber: string;
  currency: string;
  exchangeRateValue: string;
  timezone: string;
  invoiceFooter: string;
  line1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

const initialForm: FormState = {
  name: "",
  slug: "",
  legalName: "",
  email: "",
  phone: "",
  website: "",
  taxNumber: "",
  currency: "HTG",
  exchangeRateValue: "",
  timezone: "",
  invoiceFooter: "",
  line1: "",
  city: "",
  state: "",
  zip: "",
  country: "",
};

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return "Impossible de creer le business.";
}

export default function BusinessOnboardingPage() {
  const router = useRouter();
  const { businesses, refresh } = useAuth();
  const [form, setForm] = useState<FormState>(() => ({
    ...initialForm,
    timezone: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Port-au-Prince" : "America/Port-au-Prince",
  }));
  const [businessType, setBusinessType] = useState<BusinessType>("other");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");

  useEffect(() => {
    if (businesses.length > 0) {
      router.replace(`/${businesses[0].slug}/dashboard`);
    }
  }, [businesses, router]);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [logoFile]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    const exchangeRateValue = Number(form.exchangeRateValue);
    if (!form.exchangeRateValue.trim() || !Number.isFinite(exchangeRateValue) || exchangeRateValue <= 0) {
      setError("Le taux de change est obligatoire (ex: 132.5 pour 1 USD).");
      return;
    }

    setLoading(true);

    try {
      const business = await createBusiness({
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        legal_name: form.legalName.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        website: form.website.trim() || undefined,
        tax_number: form.taxNumber.trim() || undefined,
        currency: form.currency.trim() || undefined,
        exchange_rate_direction: "usd_to_htg",
        exchange_rate_value: exchangeRateValue,
        timezone: form.timezone.trim() || undefined,
        invoice_footer: form.invoiceFooter.trim() || undefined,
        business_type: businessType,
        ...BUSINESS_TYPE_PRESETS[businessType].flags,
        address: {
          line1: form.line1.trim() || undefined,
          city: form.city.trim() || undefined,
          state: form.state.trim() || undefined,
          zip: form.zip.trim() || undefined,
          country: form.country.trim() || undefined,
        },
        logoFile,
      });

      await refresh();
      router.replace(`/${business.slug}/dashboard`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <RequireAuth>
      <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.12),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef4ff_100%)] px-4 py-4 sm:px-6 lg:px-8">
        <div className="grid min-h-[calc(100dvh-2rem)] w-full gap-6 xl:grid-cols-[minmax(320px,0.88fr)_minmax(0,1.12fr)] xl:gap-8">
          <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-[#0b4f88] via-[#0d63b8] to-[#0f7ad8] p-6 text-white shadow-[0_20px_60px_rgba(11,79,136,0.16)] sm:p-8 xl:sticky xl:top-4 xl:flex xl:min-h-[calc(100dvh-2rem)] xl:flex-col xl:p-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle,_rgba(255,255,255,0.14)_1px,_transparent_1px)] bg-[length:20px_20px]" />
            <div className="absolute inset-y-0 right-0 w-40 bg-[radial-gradient(circle,_rgba(255,255,255,0.2),_transparent_68%)] blur-2xl" />
            <div className="absolute -bottom-16 left-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -top-20 right-0 h-56 w-56 rounded-full bg-[#d4af37]/20 blur-3xl" />

            <div className="relative flex h-full flex-col">
              <div className="max-w-xl space-y-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/90 ring-1 ring-white/15">
                  <Sparkles className="h-3.5 w-3.5" />
                  Derniere etape
                </span>
                <h1 className="text-3xl font-semibold text-white sm:text-4xl xl:text-5xl">Creez votre business</h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-100/85 sm:text-base">
                  Votre compte est maintenant valide. Il ne reste plus qu a configurer votre entreprise pour entrer dans le systeme.
                </p>
              </div>

              <div className="mt-8 space-y-3 xl:mt-auto">
                <div className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm transition-colors hover:bg-white/[0.14]">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                    <Building2 className="h-4 w-4 text-white" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">Identite</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-100/75">Nom commercial, raison sociale et slug de votre business.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm transition-colors hover:bg-white/[0.14]">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                    <Wallet className="h-4 w-4 text-white" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">Finances</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-100/75">Devise, fuseau horaire et informations de contact.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm transition-colors hover:bg-white/[0.14]">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                    <MapPinned className="h-4 w-4 text-white" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">Adresse</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-100/75">Adresse de base pour la facturation et les operations.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white/95 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8 xl:max-h-[calc(100dvh-2rem)] xl:overflow-y-auto xl:p-10">
              {error ? (
                <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
              ) : null}

              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Type d&apos;activite</label>
                  <p className="mt-0.5 text-xs text-slate-500">Modifiable ensuite dans Parametres.</p>
                  <select
                    value={businessType}
                    onChange={(event) => setBusinessType(event.target.value as BusinessType)}
                    className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#0b4f88]"
                  >
                    {BUSINESS_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {BUSINESS_TYPE_PRESETS[type].label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-slate-500">{BUSINESS_TYPE_PRESETS[businessType].desc}</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Nom du business</label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                      className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#0b4f88]"
                      placeholder="Ex: Hotel Horizon"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">Slug public</label>
                    <input
                      type="text"
                      value={form.slug}
                      onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
                      className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#0b4f88]"
                      placeholder="hotel-horizon"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Raison sociale</label>
                    <input
                      type="text"
                      value={form.legalName}
                      onChange={(event) => setForm((prev) => ({ ...prev, legalName: event.target.value }))}
                      className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#0b4f88]"
                      placeholder="Entreprise XYZ SA"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">Email business</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                      className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#0b4f88]"
                      placeholder="contact@business.com"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Telephone</label>
                    <PhoneField
                      value={form.phone}
                      onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))}
                      className="mt-1 w-full"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">Site web</label>
                    <input
                      type="url"
                      value={form.website}
                      onChange={(event) => setForm((prev) => ({ ...prev, website: event.target.value }))}
                      className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#0b4f88]"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Devise</label>
                    <select
                      value={form.currency}
                      onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value }))}
                      className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#0b4f88]"
                    >
                      {SUPPORTED_CURRENCIES.map((currency) => (
                        <option key={currency.code} value={currency.code}>
                          {currency.code} - {currency.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">Taux de change (1 USD = ? HTG)</label>
                    <input
                      type="number"
                      min="0.000001"
                      step="0.01"
                      required
                      value={form.exchangeRateValue}
                      onChange={(event) => setForm((prev) => ({ ...prev, exchangeRateValue: event.target.value }))}
                      className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#0b4f88]"
                      placeholder="Ex: 132.5"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Modifiable ensuite dans Parametres. Verifiez le taux du jour avant de valider.
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">Fuseau horaire</label>
                    <input
                      type="text"
                      value={form.timezone}
                      onChange={(event) => setForm((prev) => ({ ...prev, timezone: event.target.value }))}
                      className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#0b4f88]"
                      placeholder="America/Port-au-Prince"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">NIF / NINU / ID</label>
                    <input
                      type="text"
                      value={form.taxNumber}
                      onChange={(event) => setForm((prev) => ({ ...prev, taxNumber: event.target.value }))}
                      className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#0b4f88]"
                      placeholder="NIF / NINU / ID"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Adresse</label>
                  <input
                    type="text"
                    value={form.line1}
                    onChange={(event) => setForm((prev) => ({ ...prev, line1: event.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#0b4f88]"
                    placeholder="Rue, numero, zone"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Logo de l&apos;entreprise</label>
                  <div className="mt-1 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white text-lg font-semibold text-slate-500 shadow-sm">
                        {logoPreviewUrl ? (
                          <Image
                            src={logoPreviewUrl}
                            alt="Apercu logo"
                            width={80}
                            height={80}
                            className="h-full w-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <span>{(form.name.trim().slice(0, 1) || "B").toUpperCase()}</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
                          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0b4f88]"
                        />
                        <p className="text-xs leading-5 text-slate-500">
                          {logoFile
                            ? `Fichier selectionne: ${logoFile.name}`
                            : "Optionnel. Choisissez une image pour afficher le logo du business."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-slate-700">Ville</label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
                      className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#0b4f88]"
                      placeholder="Ville"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">Etat / zone</label>
                    <input
                      type="text"
                      value={form.state}
                      onChange={(event) => setForm((prev) => ({ ...prev, state: event.target.value }))}
                      className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#0b4f88]"
                      placeholder="Etat"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">Code postal</label>
                    <input
                      type="text"
                      value={form.zip}
                      onChange={(event) => setForm((prev) => ({ ...prev, zip: event.target.value }))}
                      className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#0b4f88]"
                      placeholder="ZIP"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Pays</label>
                  <input
                    type="text"
                    value={form.country}
                    onChange={(event) => setForm((prev) => ({ ...prev, country: event.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#0b4f88]"
                    placeholder="Pays"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Note de pied de page</label>
                  <textarea
                    rows={4}
                    value={form.invoiceFooter}
                    onChange={(event) => setForm((prev) => ({ ...prev, invoiceFooter: event.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#0b4f88]"
                    placeholder="Merci pour votre confiance. Cette note apparaitra sur les factures et tickets."
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-[#0b4f88] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0a4273] disabled:opacity-60"
                >
                  {loading ? "Creation du business..." : "Creer mon business"}
                </button>
              </form>
            </section>
        </div>
      </div>
    </RequireAuth>
  );
}
