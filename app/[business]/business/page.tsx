"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { usePermissionGuard } from "@/lib/usePermissionGuard";
import { ApiError } from "@/lib/api";
import {
  BUSINESS_TYPES,
  getBusinessSettings,
  SUPPORTED_CURRENCIES,
  updateBusinessSettings,
  type BusinessSettings,
  type BusinessType,
} from "@/lib/businessApi";
import { formatExchangeRateSummary } from "@/lib/currency";
import PhoneField from "@/components/PhoneField";

const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  hotel: "Hotel",
  restaurant: "Restaurant",
  bar_cafe: "Bar / Cafe",
  retail: "Commerce de detail / Boutique",
  hardware_store: "Quincaillerie",
  pharmacy: "Pharmacie",
  supermarket: "Supermarche / Epicerie",
  salon_beauty: "Salon de beaute / Spa",
  garage: "Garage / Mecanique",
  real_estate: "Immobilier",
  clinic: "Clinique / Centre de sante",
  school: "Ecole / Centre de formation",
  fashion: "Boutique de mode / Vetements",
  electronics: "Electronique / Informatique",
  professional_services: "Services professionnels",
  other: "Autre",
};

const MODULE_DEFINITIONS = [
  { key: "has_hotel", label: "Hotel", desc: "Chambres, reservations, housekeeping, audit de nuit", allowedTypes: ["hotel"] },
  { key: "has_restaurant", label: "Restaurant", desc: "Tables et commandes restaurant", allowedTypes: ["hotel"] },
  { key: "has_pool", label: "Piscine", desc: "Tickets et entrees piscine", allowedTypes: ["hotel"] },
  { key: "has_services", label: "Services", desc: "Spa, massage, lavanderie, excursions...", allowedTypes: BUSINESS_TYPES },
  { key: "has_moment", label: "Moments (2h)", desc: "Location de chambre a l'heure", allowedTypes: ["hotel"] },
] as const satisfies ReadonlyArray<{
  key: "has_hotel" | "has_restaurant" | "has_pool" | "has_services" | "has_moment";
  label: string;
  desc: string;
  allowedTypes: readonly BusinessType[];
}>;

function moduleAllowedForType(key: (typeof MODULE_DEFINITIONS)[number]["key"], businessType: BusinessType): boolean {
  const definition = MODULE_DEFINITIONS.find((item) => item.key === key);
  return definition ? (definition.allowedTypes as readonly BusinessType[]).includes(businessType) : false;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";
const API_ORIGIN = (() => {
  try {
    return API_BASE ? new URL(API_BASE).origin : "";
  } catch {
    return "";
  }
})();

type BusinessFormState = {
  name: string;
  legalName: string;
  email: string;
  phone: string;
  website: string;
  taxNumber: string;
  currency: string;
  exchangeRateDirection: string;
  exchangeRateValue: string;
  timezone: string;
  invoiceFooter: string;
  businessType: BusinessType;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

const initialFormState: BusinessFormState = {
  name: "",
  legalName: "",
  email: "",
  phone: "",
  website: "",
  taxNumber: "",
  currency: "",
  exchangeRateDirection: "usd_to_htg",
  exchangeRateValue: "1",
  timezone: "",
  invoiceFooter: "",
  businessType: "hotel",
  line1: "",
  line2: "",
  city: "",
  state: "",
  zip: "",
  country: "",
};

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

function toFormState(data: BusinessSettings): BusinessFormState {
  return {
    name: data.name ?? "",
    legalName: data.legal_name ?? "",
    email: data.email ?? "",
    phone: data.phone ?? "",
    website: data.website ?? "",
    taxNumber: data.tax_number ?? "",
    currency: data.currency ?? "",
    exchangeRateDirection: data.exchange_rate_direction ?? "usd_to_htg",
    exchangeRateValue: String(data.exchange_rate_value ?? 1),
    timezone: data.timezone ?? "",
    invoiceFooter: data.invoice_footer ?? "",
    businessType: data.business_type ?? "hotel",
    line1: data.address?.line1 ?? "",
    line2: data.address?.line2 ?? "",
    city: data.address?.city ?? "",
    state: data.address?.state ?? "",
    zip: data.address?.zip ?? "",
    country: data.address?.country ?? "",
  };
}

function resolveLogoUrl(data: BusinessSettings): string {
  const raw = (data.logo_url || data.logo_path || "").trim();
  if (!raw) return "";
  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("data:") ||
    raw.startsWith("blob:")
  ) {
    return raw;
  }

  const normalized = raw.replace(/^\/+/, "");
  const relative = normalized.startsWith("storage/")
    ? normalized
    : `storage/${normalized}`;

  return API_ORIGIN ? `${API_ORIGIN}/${relative}` : `/${relative}`;
}

function buildCurrencyPolicyMessage(hasHotel: boolean, hasMoment: boolean): string {
  const parts: string[] = [];
  if (hasHotel) parts.push("les chambres/nuit en USD");
  if (hasMoment) parts.push("les moments en HTG");
  parts.push("les produits en HTG");

  const joined = parts.length > 1
    ? `${parts.slice(0, -1).join(", ")} et ${parts[parts.length - 1]}`
    : parts[0];

  return `Le systeme gardera ${joined}, tout en laissant le client payer dans l'une ou l'autre devise.`;
}

function validateForm(form: BusinessFormState): string {
  if (form.name.trim().length < 2) {
    return "Le nom du business est obligatoire (min 2 caracteres).";
  }
  if (form.email.trim().length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return "L'email n'est pas valide.";
  }
  if (Number(form.exchangeRateValue) <= 0) {
    return "Le taux de change doit etre superieur a zero.";
  }
  return "";
}

export default function BusinessPage() {
  const { allowed, loading: permLoading } = usePermissionGuard("business.read");
  const params = useParams<{ business: string }>();
  const business = params?.business ?? "";

  const [form, setForm] = useState<BusinessFormState>(initialFormState);
  const [modules, setModules] = useState({
    has_hotel: true,
    has_restaurant: true,
    has_pool: true,
    has_services: true,
    has_moment: true,
  });
  const [savedModules, setSavedModules] = useState({
    has_hotel: true,
    has_restaurant: true,
    has_pool: true,
    has_services: true,
    has_moment: true,
  });
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  const [loyaltyEarnAmount, setLoyaltyEarnAmount] = useState("100");
  const [loyaltyRedeemValue, setLoyaltyRedeemValue] = useState("1");
  const [loyaltyCapPercent, setLoyaltyCapPercent] = useState("50");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");
  const [currentLogoUrl, setCurrentLogoUrl] = useState("");
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);
  const displayedLogoUrl = logoPreviewUrl || (logoLoadFailed ? "" : currentLogoUrl);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [logoFile]);

  useEffect(() => {
    setLogoLoadFailed(false);
  }, [logoPreviewUrl, currentLogoUrl]);

  useEffect(() => {
    let mounted = true;

    async function loadBusiness() {
      if (!business) return;
      setLoading(true);
      setError("");
      setSuccess("");

      try {
        const data = await getBusinessSettings(business);
        if (!mounted) return;
        const nextForm = toFormState(data);
        setForm(nextForm);
        const loadedModules = {
          has_hotel: data.has_hotel !== false,
          has_restaurant: data.has_restaurant !== false,
          has_pool: data.has_pool !== false,
          has_services: data.has_services !== false,
          has_moment: data.has_moment !== false,
        };
        setModules(loadedModules);
        setSavedModules(loadedModules);
        setLoyaltyEnabled(data.loyalty_enabled);
        setLoyaltyEarnAmount(String(data.loyalty_earn_amount));
        setLoyaltyRedeemValue(String(data.loyalty_redeem_value));
        setLoyaltyCapPercent(String(data.loyalty_redemption_cap_percent));
        setCurrentLogoUrl(resolveLogoUrl(data));
        setLogoFile(null);
      } catch (e) {
        if (mounted) setError(getErrorMessage(e));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadBusiness();
    return () => {
      mounted = false;
    };
  }, [business]);

  function setField<K extends keyof BusinessFormState>(
    key: K,
    value: BusinessFormState[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const validationMessage = validateForm(form);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setSaving(true);
    try {
      const updated = await updateBusinessSettings(business, {
        name: form.name.trim(),
        legal_name: form.legalName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        website: form.website.trim(),
        tax_number: form.taxNumber.trim(),
        currency: form.currency.trim(),
        exchange_rate_direction: form.exchangeRateDirection,
        exchange_rate_value: Number(form.exchangeRateValue || "1"),
        timezone: form.timezone.trim(),
        invoice_footer: form.invoiceFooter.trim(),
        business_type: form.businessType,
        has_hotel: moduleAllowedForType("has_hotel", form.businessType) ? modules.has_hotel : false,
        has_restaurant: moduleAllowedForType("has_restaurant", form.businessType) ? modules.has_restaurant : false,
        has_pool: moduleAllowedForType("has_pool", form.businessType) ? modules.has_pool : false,
        has_services: moduleAllowedForType("has_services", form.businessType) ? modules.has_services : false,
        has_moment: moduleAllowedForType("has_moment", form.businessType) ? modules.has_moment : false,
        loyalty_enabled: loyaltyEnabled,
        loyalty_earn_amount: Number(loyaltyEarnAmount || "100"),
        loyalty_redeem_value: Number(loyaltyRedeemValue || "1"),
        loyalty_redemption_cap_percent: Number(loyaltyCapPercent || "50"),
        address: {
          line1: form.line1.trim(),
          line2: form.line2.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          zip: form.zip.trim(),
          country: form.country.trim(),
        },
        logoFile,
      });

      const nextForm = toFormState(updated);
      setForm(nextForm);
      const updatedModules = {
        has_hotel: updated.has_hotel !== false,
        has_restaurant: updated.has_restaurant !== false,
        has_pool: updated.has_pool !== false,
        has_services: updated.has_services !== false,
        has_moment: updated.has_moment !== false,
      };
      setModules(updatedModules);
      setSavedModules(updatedModules);
      setLoyaltyEnabled(updated.loyalty_enabled);
      setLoyaltyEarnAmount(String(updated.loyalty_earn_amount));
      setLoyaltyRedeemValue(String(updated.loyalty_redeem_value));
      setLoyaltyCapPercent(String(updated.loyalty_redemption_cap_percent));
      setCurrentLogoUrl(resolveLogoUrl(updated));
      setLogoFile(null);

      const modulesChanged =
        updatedModules.has_hotel !== savedModules.has_hotel ||
        updatedModules.has_restaurant !== savedModules.has_restaurant ||
        updatedModules.has_pool !== savedModules.has_pool ||
        updatedModules.has_services !== savedModules.has_services ||
        updatedModules.has_moment !== savedModules.has_moment;

      if (modulesChanged) {
        setSuccess("Modules mis a jour. Rechargement du menu...");
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setSuccess("Informations du business mises a jour.");
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const isSubmitDisabled = useMemo(
    () => loading || saving || !business,
    [loading, saving, business],
  );

  if (permLoading || !allowed) return null;

  return (
    <div className="space-y-6">
      <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">MY Business</h1>
            <p className="text-slate-500 mt-1">
              Modifie les informations du business actif.
            </p>
          </div>
          <Link
            href={business ? `/${business}/settings` : "/"}
            className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Retour Parametres
          </Link>
        </div>
      </section>

      <form
        onSubmit={onSubmit}
        className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5"
      >
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        {loading ? (
          <div className="py-6 text-center text-slate-500">
            Chargement des informations business...
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nom business *">
            <input
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </Field>

          <Field label="Raison sociale">
            <input
              value={form.legalName}
              onChange={(event) => setField("legalName", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </Field>

          <Field label="Email">
            <input
              value={form.email}
              onChange={(event) => setField("email", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </Field>

          <Field label="Telephone">
            <PhoneField value={form.phone} onChange={(value) => setField("phone", value)} />
          </Field>

          <Field label="Site web">
            <input
              value={form.website}
              onChange={(event) => setField("website", event.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </Field>

          <Field label="NIF / NINU / ID">
            <input
              value={form.taxNumber}
              onChange={(event) => setField("taxNumber", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </Field>

          <Field label="Devise">
            <select
              value={form.currency}
              onChange={(event) =>
                setField("currency", event.target.value.toUpperCase())
              }
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              {SUPPORTED_CURRENCIES.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.code} - {item.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Sens du taux">
            <select
              value={form.exchangeRateDirection}
              onChange={(event) => setField("exchangeRateDirection", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="usd_to_htg">USD vers HTG</option>
              <option value="htg_to_usd">HTG vers USD</option>
            </select>
          </Field>

          <Field label="Taux de change">
            <input
              type="number"
              min="0.000001"
              step="0.000001"
              value={form.exchangeRateValue}
              onChange={(event) => setField("exchangeRateValue", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <p className="mt-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              Ce taux s&apos;applique uniquement aux <strong>nouvelles</strong> transactions.
              Les enregistrements existants conservent le taux en vigueur au moment de leur creation.
            </p>
          </Field>

          <div className="md:col-span-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <div className="font-semibold">Taux actif HTG / USD</div>
            <div className="mt-1">
              {formatExchangeRateSummary({
                exchangeRateDirection: form.exchangeRateDirection,
                exchangeRateValue: Number(form.exchangeRateValue || "1"),
              })}
            </div>
            <div className="mt-1 text-xs text-blue-700">
              {buildCurrencyPolicyMessage(modules.has_hotel, modules.has_moment)}
            </div>
          </div>

          <Field label="Timezone">
            <input
              value={form.timezone}
              onChange={(event) => setField("timezone", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </Field>

          <div className="md:col-span-2">
            <Field label="Logo (logo_path)">
              <div className="space-y-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    setLogoFile(event.target.files?.[0] ?? null)
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />

                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                    {displayedLogoUrl ? (
                      <Image
                        src={displayedLogoUrl}
                        alt="Logo business"
                        width={56}
                        height={56}
                        className="h-full w-full object-cover"
                        unoptimized
                        onError={() => setLogoLoadFailed(true)}
                      />
                    ) : (
                      <span>{(form.name.trim().slice(0, 1) || "B").toUpperCase()}</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {logoFile
                      ? `Nouveau logo: ${logoFile.name}`
                      : currentLogoUrl
                        ? "Aucun nouveau logo choisi: le logo actuel sera conserve."
                        : "Aucun logo defini. Selectionne une image pour ajouter le logo."}
                  </div>
                </div>
              </div>
            </Field>
          </div>

          <div className="md:col-span-2">
            <div className="text-sm font-semibold text-slate-700 mb-1.5">Adresse</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                value={form.line1}
                onChange={(event) => setField("line1", event.target.value)}
                placeholder="Ligne 1"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <input
                value={form.line2}
                onChange={(event) => setField("line2", event.target.value)}
                placeholder="Ligne 2"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <input
                value={form.city}
                onChange={(event) => setField("city", event.target.value)}
                placeholder="Ville"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <input
                value={form.state}
                onChange={(event) => setField("state", event.target.value)}
                placeholder="Region / Etat"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <input
                value={form.zip}
                onChange={(event) => setField("zip", event.target.value)}
                placeholder="Code postal"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <input
                value={form.country}
                onChange={(event) => setField("country", event.target.value)}
                placeholder="Pays"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <Field label="Pied de facture">
              <textarea
                rows={4}
                value={form.invoiceFooter}
                onChange={(event) => setField("invoiceFooter", event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </Field>
          </div>

          <div className="md:col-span-2">
            <Field label="Type d'activite">
              <select
                value={form.businessType}
                onChange={(event) => setField("businessType", event.target.value as BusinessType)}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                {BUSINESS_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {BUSINESS_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="md:col-span-2">
            <div className="text-sm font-semibold text-slate-700 mb-3">Modules actifs</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MODULE_DEFINITIONS
                .filter(({ allowedTypes }) => (allowedTypes as readonly BusinessType[]).includes(form.businessType))
                .map(({ key, label, desc }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setModules((prev) => ({ ...prev, [key]: !prev[key] }))}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                    modules[key]
                      ? "border-indigo-200 bg-indigo-50"
                      : "border-slate-200 bg-slate-50 opacity-60"
                  }`}
                >
                  <div
                    className={`h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
                      modules[key] ? "bg-indigo-600" : "bg-slate-300"
                    } relative`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        modules[key] ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{label}</div>
                    <div className="text-xs text-slate-500">{desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="text-sm font-semibold text-slate-700 mb-3">Programme de fidelite</div>
            <button
              type="button"
              onClick={() => setLoyaltyEnabled((prev) => !prev)}
              className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                loyaltyEnabled ? "border-indigo-200 bg-indigo-50" : "border-slate-200 bg-slate-50 opacity-60"
              }`}
            >
              <div
                className={`h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
                  loyaltyEnabled ? "bg-indigo-600" : "bg-slate-300"
                } relative`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    loyaltyEnabled ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800">Activer les points de fidelite</div>
                <div className="text-xs text-slate-500">
                  Les clients gagnent des points a la caisse et peuvent les utiliser pour payer une partie de leurs achats.
                </div>
              </div>
            </button>

            {loyaltyEnabled ? (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Montant pour 1 point gagne">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={loyaltyEarnAmount}
                    onChange={(event) => setLoyaltyEarnAmount(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </Field>
                <Field label="Valeur d'1 point utilise">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={loyaltyRedeemValue}
                    onChange={(event) => setLoyaltyRedeemValue(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </Field>
                <Field label="Plafond de rachat (% du total)">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    value={loyaltyCapPercent}
                    onChange={(event) => setLoyaltyCapPercent(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </Field>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="inline-flex items-center justify-center rounded-xl brand-primary-btn px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Enregistrement..." : "Enregistrer les modifications"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
