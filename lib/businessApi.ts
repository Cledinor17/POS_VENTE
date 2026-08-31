import { apiFetch } from "./api";
import type { BusinessSummary } from "./types/auth";

export async function getMyBusinesses(): Promise<{ data: BusinessSummary[] }> {
  return apiFetch<{ data: BusinessSummary[] }>("/api/app/businesses");
}

export type BusinessAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
};

export type CurrencyOption = {
  code: string;
  name: string;
};

export type BusinessSettings = {
  id: number | string;
  name: string;
  slug: string;
  legal_name: string;
  email: string;
  phone: string;
  website: string;
  tax_number: string;
  currency: string;
  exchange_rate_direction: string;
  exchange_rate_value: number;
  usd_to_htg_rate: number;
  htg_to_usd_rate: number;
  timezone: string;
  logo_path: string;
  logo_url: string;
  invoice_footer: string;
  business_type: BusinessType;
  has_hotel: boolean;
  has_restaurant: boolean;
  has_pool: boolean;
  has_services: boolean;
  has_moment: boolean;
  loyalty_enabled: boolean;
  loyalty_earn_amount: number;
  loyalty_redeem_value: number;
  loyalty_redemption_cap_percent: number;
  address: BusinessAddress;
};

export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: "HTG", name: "Gourde haitienne" },
  { code: "USD", name: "Dollar americain" },
];

export const BUSINESS_TYPES = [
  "hotel", "restaurant", "bar_cafe", "retail", "hardware_store", "pharmacy",
  "supermarket", "salon_beauty", "garage", "real_estate", "clinic", "school",
  "fashion", "electronics", "professional_services", "other",
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

type BusinessMultipartPayload = {
  name?: string;
  slug?: string;
  legal_name?: string;
  email?: string;
  phone?: string;
  website?: string;
  tax_number?: string;
  currency?: string;
  exchange_rate_direction?: string;
  exchange_rate_value?: number;
  timezone?: string;
  invoice_footer?: string;
  business_type?: BusinessType;
  has_hotel?: boolean;
  has_restaurant?: boolean;
  has_pool?: boolean;
  has_services?: boolean;
  has_moment?: boolean;
  loyalty_enabled?: boolean;
  loyalty_earn_amount?: number;
  loyalty_redeem_value?: number;
  loyalty_redemption_cap_percent?: number;
  address?: BusinessAddress;
  logoFile?: File | null;
};

type BusinessSettingsPayload = BusinessMultipartPayload;

export type CreateBusinessInput = BusinessMultipartPayload & {
  name: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeBusiness(raw: unknown): BusinessSettings {
  const obj = asRecord(raw);
  const addressObj = asRecord(obj.address);

  return {
    id: (obj.id as number | string) ?? "",
    name: asString(obj.name),
    slug: asString(obj.slug),
    legal_name: asString(obj.legal_name),
    email: asString(obj.email),
    phone: asString(obj.phone),
    website: asString(obj.website),
    tax_number: asString(obj.tax_number),
    currency: asString(obj.currency),
    exchange_rate_direction: asString(obj.exchange_rate_direction, "usd_to_htg"),
    exchange_rate_value: Number(obj.exchange_rate_value ?? 1) || 1,
    usd_to_htg_rate: Number(obj.usd_to_htg_rate ?? obj.exchange_rate_value ?? 1) || 1,
    htg_to_usd_rate: Number(obj.htg_to_usd_rate ?? 1) || 1,
    timezone: asString(obj.timezone),
    logo_path: asString(obj.logo_path),
    logo_url: asString(obj.logo_url),
    invoice_footer: asString(obj.invoice_footer),
    business_type: (BUSINESS_TYPES as readonly string[]).includes(asString(obj.business_type))
      ? (obj.business_type as BusinessType)
      : "hotel",
    has_hotel: obj.has_hotel !== false,
    has_restaurant: obj.has_restaurant !== false,
    has_pool: obj.has_pool !== false,
    has_services: obj.has_services !== false,
    has_moment: obj.has_moment !== false,
    loyalty_enabled: obj.loyalty_enabled === true,
    loyalty_earn_amount: Number(obj.loyalty_earn_amount ?? 100) || 100,
    loyalty_redeem_value: Number(obj.loyalty_redeem_value ?? 1) || 1,
    loyalty_redemption_cap_percent: Number(obj.loyalty_redemption_cap_percent ?? 50) || 50,
    address: {
      line1: asString(addressObj.line1),
      line2: asString(addressObj.line2),
      city: asString(addressObj.city),
      state: asString(addressObj.state),
      zip: asString(addressObj.zip),
      country: asString(addressObj.country),
    },
  };
}

function buildBusinessFormData(payload: BusinessMultipartPayload): FormData {
  const formData = new FormData();
  const address = payload.address ?? {};

  const scalarKeys: Array<keyof BusinessSettingsPayload> = [
    "name",
    "slug",
    "legal_name",
    "email",
    "phone",
    "website",
    "tax_number",
    "currency",
    "exchange_rate_direction",
    "exchange_rate_value",
    "timezone",
    "invoice_footer",
    "business_type",
    "loyalty_earn_amount",
    "loyalty_redeem_value",
    "loyalty_redemption_cap_percent",
  ];

  const boolKeys: Array<
    "has_hotel" | "has_restaurant" | "has_pool" | "has_services" | "has_moment" | "loyalty_enabled"
  > = ["has_hotel", "has_restaurant", "has_pool", "has_services", "has_moment", "loyalty_enabled"];
  for (const key of boolKeys) {
    if (payload[key] !== undefined) {
      formData.append(key, payload[key] ? "1" : "0");
    }
  }

  for (const key of scalarKeys) {
    const value = payload[key];
    if (value === undefined) continue;
    formData.append(String(key), String(value));
  }

  const addressKeys: Array<keyof BusinessAddress> = [
    "line1",
    "line2",
    "city",
    "state",
    "zip",
    "country",
  ];

  for (const key of addressKeys) {
    const value = address[key];
    if (value === undefined) continue;
    formData.append(`address[${String(key)}]`, String(value));
  }

  if (payload.logoFile instanceof File) {
    formData.append("logo", payload.logoFile);
  }

  return formData;
}

export async function getBusinessSettings(business: string): Promise<BusinessSettings> {
  const raw = await apiFetch<unknown>(`/api/app/${encodeURIComponent(business)}/business`);
  const payload = asRecord(raw);
  return normalizeBusiness(payload.data ?? payload);
}

export async function createBusiness(payload: CreateBusinessInput): Promise<BusinessSettings> {
  const { logoFile, ...jsonPayload } = payload;
  const raw = logoFile instanceof File
    ? await apiFetch<unknown>("/api/app/businesses", {
        method: "POST",
        body: buildBusinessFormData(payload),
      })
    : await apiFetch<unknown>("/api/app/businesses", {
        method: "POST",
        json: jsonPayload,
      });
  const body = asRecord(raw);
  return normalizeBusiness(body.data ?? body);
}

export async function updateBusinessSettings(
  business: string,
  payload: BusinessSettingsPayload
): Promise<BusinessSettings> {
  const url = `/api/app/${encodeURIComponent(business)}/business`;
  const { logoFile, ...jsonPayload } = payload;
  let raw: unknown;

  if (logoFile instanceof File) {
    // PHP/Laravel parse reliably uploaded files with POST multipart + _method override.
    const formData = buildBusinessFormData(payload);
    formData.append("_method", "PATCH");
    raw = await apiFetch<unknown>(url, {
      method: "POST",
      body: formData,
    });
  } else {
    raw = await apiFetch<unknown>(url, {
      method: "PATCH",
      json: jsonPayload,
    });
  }

  const body = asRecord(raw);
  return normalizeBusiness(body.data ?? body);
}
