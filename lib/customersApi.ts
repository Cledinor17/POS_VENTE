import { apiFetch } from "./api";

type Dict = Record<string, unknown>;

export type CustomerAddress = {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
};

export type CustomerItem = {
  id: string;
  code: string | null;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  billingAddress: CustomerAddress | null;
  shippingAddress: CustomerAddress | null;
  taxNumber: string | null;
  currency: string | null;
  notes: string | null;
  isActive: boolean;
  paymentTermsDays: number | null;
  creditLimit: number | null;
  identityDocumentPath: string | null;
  identityDocumentUrl: string | null;
  identityDocumentType: string | null;
  identityDocumentNumber: string | null;
  createdAt: string | null;
};

export type CustomerListParams = {
  page?: number;
  perPage?: number;
  q?: string;
  isActive?: boolean;
};

export type CustomerListResult = {
  items: CustomerItem[];
  currentPage: number;
  perPage: number;
  total: number;
  lastPage: number;
};

export type CreateCustomerInput = {
  code?: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  billingAddress?: Partial<CustomerAddress>;
  shippingAddress?: Partial<CustomerAddress>;
  taxNumber?: string;
  currency?: string;
  notes?: string;
  isActive?: boolean;
  paymentTermsDays?: number;
  creditLimit?: number;
  identityDocumentFile?: File | null;
  identityDocumentType?: string;
  identityDocumentNumber?: string;
};

export type UpdateCustomerInput = Partial<CreateCustomerInput>;

export type CustomerIdentityDocumentFields = {
  lastName: string;
  firstName: string;
  address: string;
  documentType: string;
  documentNumber: string;
};

function isObject(value: unknown): value is Dict {
  return typeof value === "object" && value !== null;
}

function toString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "bigint") return value.toString();
  return fallback;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

function toBool(value: unknown, fallback = true): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "1" || normalized === "true") return true;
    if (normalized === "0" || normalized === "false") return false;
  }
  return fallback;
}

function normalizeAddress(value: unknown): CustomerAddress | null {
  if (!isObject(value)) return null;
  return {
    line1: toString(value.line1, "") || null,
    line2: toString(value.line2, "") || null,
    city: toString(value.city, "") || null,
    state: toString(value.state, "") || null,
    zip: toString(value.zip, "") || null,
    country: toString(value.country, "") || null,
  };
}

function hasAddressValue(value: Partial<CustomerAddress> | undefined): boolean {
  if (!value) return false;
  return ["line1", "line2", "city", "state", "zip", "country"].some((key) => {
    const field = value[key as keyof CustomerAddress];
    return typeof field === "string" && field.trim().length > 0;
  });
}

function basePath(business: string): string {
  return `/api/app/${encodeURIComponent(business)}/customers`;
}

function getCollection(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!isObject(raw)) return [];
  if (Array.isArray(raw.data)) return raw.data;
  if (isObject(raw.data) && Array.isArray(raw.data.data)) return raw.data.data;
  return [];
}

function getMeta(raw: unknown, itemCount: number) {
  const defaults = {
    currentPage: 1,
    perPage: itemCount || 20,
    total: itemCount,
    lastPage: 1,
  };

  if (!isObject(raw)) return defaults;

  const source = isObject(raw.meta) ? raw.meta : raw;
  return {
    currentPage: Math.max(1, Math.trunc(toNumber(source.current_page ?? source.currentPage, defaults.currentPage))),
    perPage: Math.max(1, Math.trunc(toNumber(source.per_page ?? source.perPage, defaults.perPage))),
    total: Math.max(0, Math.trunc(toNumber(source.total, defaults.total))),
    lastPage: Math.max(1, Math.trunc(toNumber(source.last_page ?? source.lastPage, defaults.lastPage))),
  };
}

function normalizeCustomer(raw: unknown): CustomerItem {
  const obj = isObject(raw) ? raw : {};
  return {
    id: toString(obj.id, ""),
    code: toString(obj.code, "") || null,
    name: toString(obj.name, "Client"),
    companyName: toString(obj.company_name ?? obj.companyName, "") || null,
    email: toString(obj.email, "") || null,
    phone: toString(obj.phone, "") || null,
    billingAddress: normalizeAddress(obj.billing_address ?? obj.billingAddress),
    shippingAddress: normalizeAddress(obj.shipping_address ?? obj.shippingAddress),
    taxNumber: toString(obj.tax_number ?? obj.taxNumber, "") || null,
    currency: toString(obj.currency, "") || null,
    notes: toString(obj.notes, "") || null,
    isActive: toBool(obj.is_active ?? obj.isActive, true),
    paymentTermsDays: Number.isFinite(toNumber(obj.payment_terms_days ?? obj.paymentTermsDays, NaN))
      ? toNumber(obj.payment_terms_days ?? obj.paymentTermsDays, 0)
      : null,
    creditLimit: Number.isFinite(toNumber(obj.credit_limit ?? obj.creditLimit, NaN))
      ? toNumber(obj.credit_limit ?? obj.creditLimit, 0)
      : null,
    identityDocumentPath: toString(obj.identity_document_path ?? obj.identityDocumentPath, "") || null,
    identityDocumentUrl: toString(obj.identity_document_url ?? obj.identityDocumentUrl, "") || null,
    identityDocumentType: toString(obj.identity_document_type ?? obj.identityDocumentType, "") || null,
    identityDocumentNumber: toString(obj.identity_document_number ?? obj.identityDocumentNumber, "") || null,
    createdAt: toString(obj.created_at ?? obj.createdAt, "") || null,
  };
}

function toCreatePayload(input: CreateCustomerInput): Record<string, unknown> {
  return {
    code: input.code ?? null,
    name: input.name,
    company_name: input.companyName ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    billing_address: hasAddressValue(input.billingAddress) ? input.billingAddress : null,
    shipping_address: hasAddressValue(input.shippingAddress) ? input.shippingAddress : null,
    tax_number: input.taxNumber ?? null,
    currency: input.currency ?? null,
    notes: input.notes ?? null,
    is_active: typeof input.isActive === "boolean" ? input.isActive : true,
    payment_terms_days: input.paymentTermsDays ?? null,
    credit_limit: input.creditLimit ?? null,
    identity_document_type: input.identityDocumentType ?? null,
    identity_document_number: input.identityDocumentNumber ?? null,
  };
}

function toUpdatePayload(input: UpdateCustomerInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if ("code" in input) payload.code = input.code ?? null;
  if ("name" in input) payload.name = input.name;
  if ("companyName" in input) payload.company_name = input.companyName ?? null;
  if ("email" in input) payload.email = input.email ?? null;
  if ("phone" in input) payload.phone = input.phone ?? null;
  if ("billingAddress" in input) payload.billing_address = hasAddressValue(input.billingAddress) ? input.billingAddress : null;
  if ("shippingAddress" in input) payload.shipping_address = hasAddressValue(input.shippingAddress) ? input.shippingAddress : null;
  if ("taxNumber" in input) payload.tax_number = input.taxNumber ?? null;
  if ("currency" in input) payload.currency = input.currency ?? null;
  if ("notes" in input) payload.notes = input.notes ?? null;
  if ("paymentTermsDays" in input) payload.payment_terms_days = input.paymentTermsDays ?? null;
  if ("creditLimit" in input) payload.credit_limit = input.creditLimit ?? null;
  if ("identityDocumentType" in input) payload.identity_document_type = input.identityDocumentType ?? null;
  if ("identityDocumentNumber" in input) payload.identity_document_number = input.identityDocumentNumber ?? null;
  if ("isActive" in input && typeof input.isActive === "boolean") payload.is_active = input.isActive;

  return payload;
}

function hasIdentityDocumentFile(input: CreateCustomerInput | UpdateCustomerInput): boolean {
  return typeof File !== "undefined" && input.identityDocumentFile instanceof File;
}

function buildCustomerFormData(input: CreateCustomerInput | UpdateCustomerInput): FormData {
  const formData = new FormData();
  const payload = "name" in input && input.name !== undefined ? toCreatePayload(input as CreateCustomerInput) : toUpdatePayload(input);

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    if (key === "billing_address" || key === "shipping_address") {
      const address = value as Partial<CustomerAddress> | null;
      if (!address) continue;
      for (const [addressKey, addressValue] of Object.entries(address)) {
        if (addressValue === undefined || addressValue === null || String(addressValue).trim() === "") continue;
        formData.append(`${key}[${addressKey}]`, String(addressValue));
      }
      continue;
    }

    if (value === null) {
      formData.append(key, "");
      continue;
    }

    formData.append(key, String(value));
  }

  if (hasIdentityDocumentFile(input)) {
    formData.append("identity_document", input.identityDocumentFile as File);
  }

  return formData;
}

export async function listCustomers(
  business: string,
  params: CustomerListParams = {}
): Promise<CustomerListResult> {
  const qp = new URLSearchParams();
  if (params.page && params.page > 0) qp.set("page", String(params.page));
  if (params.perPage && params.perPage > 0) qp.set("per_page", String(params.perPage));
  if (params.q && params.q.trim().length > 0) qp.set("q", params.q.trim());
  if (typeof params.isActive === "boolean") qp.set("is_active", params.isActive ? "1" : "0");

  const query = qp.toString();
  const path = query ? `${basePath(business)}?${query}` : basePath(business);
  const raw = await apiFetch<unknown>(path);
  const items = getCollection(raw).map(normalizeCustomer);
  const meta = getMeta(raw, items.length);

  return {
    items,
    currentPage: meta.currentPage,
    perPage: meta.perPage,
    total: meta.total,
    lastPage: meta.lastPage,
  };
}

export async function createCustomer(
  business: string,
  input: CreateCustomerInput
): Promise<CustomerItem> {
  const raw = hasIdentityDocumentFile(input)
    ? await apiFetch<unknown>(basePath(business), {
        method: "POST",
        body: buildCustomerFormData(input),
      })
    : await apiFetch<unknown>(basePath(business), {
        method: "POST",
        json: toCreatePayload(input),
      });
  return normalizeCustomer(raw);
}

export async function extractCustomerIdentityDocument(
  business: string,
  file: File
): Promise<CustomerIdentityDocumentFields> {
  const formData = new FormData();
  formData.append("identity_document", file);

  const raw = await apiFetch<unknown>(`${basePath(business)}/extract-identity-document`, {
    method: "POST",
    body: formData,
  });
  const root = isObject(raw) ? raw : {};
  const fields = isObject(root.fields) ? root.fields : {};

  return {
    lastName: toString(fields.last_name ?? fields.lastName),
    firstName: toString(fields.first_name ?? fields.firstName),
    address: toString(fields.address),
    documentType: toString(fields.document_type ?? fields.documentType),
    documentNumber: toString(fields.document_number ?? fields.documentNumber),
  };
}

export async function updateCustomer(
  business: string,
  customerId: string,
  input: UpdateCustomerInput
): Promise<CustomerItem> {
  const path = `${basePath(business)}/${encodeURIComponent(customerId)}`;
  const raw = hasIdentityDocumentFile(input)
    ? await apiFetch<unknown>(path, {
        method: "POST",
        body: (() => {
          const formData = buildCustomerFormData(input);
          formData.append("_method", "PUT");
          return formData;
        })(),
      })
    : await apiFetch<unknown>(path, {
        method: "PUT",
        json: toUpdatePayload(input),
      });
  return normalizeCustomer(raw);
}

export async function deleteCustomer(business: string, customerId: string): Promise<void> {
  await apiFetch<unknown>(`${basePath(business)}/${encodeURIComponent(customerId)}`, {
    method: "DELETE",
  });
}
