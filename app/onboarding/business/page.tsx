"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { createBusiness, getOnlineCurrencies, type CurrencyOption } from "@/lib/businessApi";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/context/AuthContext";

type FormState = {
  name: string;
  slug: string;
  legalName: string;
  email: string;
  phone: string;
  website: string;
  taxNumber: string;
  currency: string;
  timezone: string;
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
  currency: "USD",
  timezone: "",
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
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (businesses.length > 0) {
      router.replace(`/${businesses[0].slug}/dashboard`);
    }
  }, [businesses, router]);

  useEffect(() => {
    let mounted = true;

    async function loadCurrencies() {
      try {
        const items = await getOnlineCurrencies();
        if (mounted) setCurrencies(items);
      } catch {
        if (mounted) setCurrencies([]);
      }
    }

    void loadCurrencies();
    return () => {
      mounted = false;
    };
  }, []);

  const currencyOptions = useMemo(() => {
    if (currencies.length > 0) return currencies;
    return [
      { code: "USD", name: "US Dollar" },
      { code: "HTG", name: "Haitian Gourde" },
      { code: "EUR", name: "Euro" },
    ];
  }, [currencies]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
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
        timezone: form.timezone.trim() || undefined,
        address: {
          line1: form.line1.trim() || undefined,
          city: form.city.trim() || undefined,
          state: form.state.trim() || undefined,
          zip: form.zip.trim() || undefined,
          country: form.country.trim() || undefined,
        },
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
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.12),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef4ff_100%)] p-4 md:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur md:p-8">
            <div className="max-w-2xl space-y-3">
              <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#0b4f88]">
                Onboarding business
              </span>
              <h1 className="text-3xl font-semibold text-slate-900 md:text-4xl">Creez votre business</h1>
              <p className="text-sm leading-6 text-slate-500 md:text-base">
                Votre compte est maintenant valide. Il ne reste qu a configurer votre entreprise pour entrer dans le systeme.
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-[2rem] border border-slate-200 bg-gradient-to-br from-[#0b4f88] to-[#0d63b8] p-6 text-white shadow-[0_20px_60px_rgba(11,79,136,0.16)] md:p-8">
              <h2 className="text-xl font-semibold">Ce que vous configurez ici</h2>
              <div className="mt-5 space-y-4 text-sm text-slate-100/90">
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                  Nom commercial, identite legale et slug de votre business.
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                  Devise, fuseau horaire et informations de contact.
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                  Adresse de base pour la facturation et les operations.
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] md:p-8">
              {error ? (
                <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
              ) : null}

              <form onSubmit={onSubmit} className="space-y-4">
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
                    <input
                      type="text"
                      value={form.phone}
                      onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                      className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-[#0b4f88]"
                      placeholder="+509 ..."
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
                      {currencyOptions.map((currency) => (
                        <option key={currency.code} value={currency.code}>
                          {currency.code} - {currency.name}
                        </option>
                      ))}
                    </select>
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
      </div>
    </RequireAuth>
  );
}
