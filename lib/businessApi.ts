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
  timezone: string;
  logo_path: string;
  logo_url: string;
  invoice_footer: string;
  address: BusinessAddress;
};

type BusinessSettingsPayload = Partial<BusinessSettings> & {
  address?: BusinessAddress;
  logoFile?: File | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeCurrencies(raw: unknown): CurrencyOption[] {
  if (!raw || typeof raw !== "object") return [];
  const record = raw as Record<string, unknown>;
  const data = Array.isArray(record.data) ? record.data : [];

  const items: CurrencyOption[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const code = asString(obj.code).trim().toUpperCase();
    const name = asString(obj.name).trim();
    if (!code || !name) continue;
    items.push({ code, name });
  }

  return items;
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
    timezone: asString(obj.timezone),
    logo_path: asString(obj.logo_path),
    logo_url: asString(obj.logo_url),
    invoice_footer: asString(obj.invoice_footer),
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

function buildBusinessFormData(payload: BusinessSettingsPayload): FormData {
  const formData = new FormData();
  const address = payload.address ?? {};

  const scalarKeys: Array<keyof BusinessSettingsPayload> = [
    "name",
    "legal_name",
    "email",
    "phone",
    "website",
    "tax_number",
    "currency",
    "timezone",
    "invoice_footer",
  ];

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

export async function getOnlineCurrencies(): Promise<CurrencyOption[]> {
  const raw = await apiFetch<unknown>("/api/currencies");
  return normalizeCurrencies(raw);
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
