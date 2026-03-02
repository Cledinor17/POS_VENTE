import { apiFetch, apiFetchBlob } from "./api";

type Dict = Record<string, unknown>;

export type DocumentListParams = {
  page?: number;
  perPage?: number;
  status?: string;
  type?: "quote" | "proforma";
  from?: string;
  to?: string;
};

export type DocumentListResult<TItem> = {
  items: TItem[];
  currentPage: number;
  perPage: number;
  total: number;
  lastPage: number;
};

export type SalesDocumentItem = {
  id: string;
  number: string;
  type: "quote" | "proforma";
  status: string;
  customerName: string;
  issueDate: string | null;
  expiryDate: string | null;
  total: number;
  currency: string;
  itemsCount: number;
  createdAt: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  convertedInvoiceId: string | null;
  convertedInvoiceNumber: string | null;
  convertedInvoiceStatus: string | null;
  convertedInvoiceAmountPaid: number;
  convertedInvoiceBalanceDue: number;
  convertedInvoiceCurrency: string | null;
};

export type ProformaItem = {
  id: string;
  number: string;
  status: string;
  customerName: string;
  issueDate: string | null;
  expiryDate: string | null;
  total: number;
  currency: string;
  itemsCount: number;
  createdAt: string | null;
};

export type InvoiceItem = {
  id: string;
  number: string;
  status: string;
  customerName: string;
  issueDate: string | null;
  dueDate: string | null;
  total: number;
  amountPaid: number;
  balanceDue: number;
  currency: string;
  itemsCount: number;
  paymentsCount: number;
  createdAt: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  voidedBy: string | null;
  voidedByName: string | null;
  voidedByEmail: string | null;
};

export type CreateSalesDocumentItemInput = {
  productId?: string;
  name: string;
  sku?: string;
  description?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  taxRate?: number;
};

export type CreateSalesDocumentInput = {
  type: "quote" | "proforma";
  status?: string;
  customerId?: string;
  issueDate?: string;
  expiryDate?: string;
  currency?: string;
  reference?: string;
  title?: string;
  notes?: string;
  items: CreateSalesDocumentItemInput[];
};

export type ConvertedInvoice = {
  id: string;
  number: string;
  status: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
  currency: string;
};

export type InvoicePaymentMethod =
  | "cash"
  | "card"
  | "bank"
  | "moncash"
  | "cheque"
  | "other";

export type ConvertDocumentToInvoiceInput = {
  discountType?: "" | "percent" | "fixed";
  discountValue?: number;
  payment?: {
    amount: number;
    method?: InvoicePaymentMethod;
    paidAt?: string;
    reference?: string;
    notes?: string;
  };
};

export type AddInvoicePaymentInput = {
  amount: number;
  method?: InvoicePaymentMethod;
  paidAt?: string;
  reference?: string;
  notes?: string;
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
    currentPage: Math.max(
      1,
      Math.trunc(
        toNumber(
          source.current_page ?? source.currentPage,
          defaults.currentPage,
        ),
      ),
    ),
    perPage: Math.max(
      1,
      Math.trunc(toNumber(source.per_page ?? source.perPage, defaults.perPage)),
    ),
    total: Math.max(0, Math.trunc(toNumber(source.total, defaults.total))),
    lastPage: Math.max(
      1,
      Math.trunc(
        toNumber(source.last_page ?? source.lastPage, defaults.lastPage),
      ),
    ),
  };
}

function buildPath(
  business: string,
  resource: string,
  params: DocumentListParams = {},
): string {
  const qp = new URLSearchParams();
  if (params.page && params.page > 0) qp.set("page", String(params.page));
  if (params.perPage && params.perPage > 0)
    qp.set("per_page", String(params.perPage));
  if (params.status && params.status.trim().length > 0)
    qp.set("status", params.status.trim());
  if (params.type && params.type.trim().length > 0)
    qp.set("type", params.type.trim());
  if (params.from && params.from.trim().length > 0)
    qp.set("from", params.from.trim());
  if (params.to && params.to.trim().length > 0) qp.set("to", params.to.trim());
  const query = qp.toString();
  const base = `/api/app/${encodeURIComponent(business)}/${resource}`;
  return query ? `${base}?${query}` : base;
}

function customerNameFrom(obj: Dict): string {
  if (isObject(obj.customer))
    return toString(obj.customer.name, "") || "Client comptoir";
  return (
    toString(obj.customer_name ?? obj.customerName, "") || "Client comptoir"
  );
}

function normalizeSalesDocument(raw: unknown): SalesDocumentItem {
  const obj = isObject(raw) ? raw : {};
  const typeRaw = toString(obj.type, "quote").toLowerCase();
  const type = typeRaw === "proforma" ? "proforma" : "quote";
  const creator = isObject(obj.creator) ? obj.creator : {};
  const convertedInvoice = isObject(
    obj.converted_invoice ?? obj.convertedInvoice,
  )
    ? ((obj.converted_invoice ?? obj.convertedInvoice) as Dict)
    : {};

  return {
    id: toString(obj.id, ""),
    number: toString(obj.number, ""),
    type,
    status: toString(obj.status, "draft"),
    customerName: customerNameFrom(obj),
    issueDate: toString(obj.issue_date, "") || null,
    expiryDate: toString(obj.expiry_date, "") || null,
    total: toNumber(obj.total, 0),
    currency: toString(obj.currency, "USD"),
    itemsCount: Math.max(
      0,
      Math.trunc(toNumber(obj.items_count ?? obj.itemsCount, 0)),
    ),
    createdAt: toString(obj.created_at, "") || null,
    createdBy: toString(obj.created_by ?? obj.createdBy, "") || null,
    createdByName:
      toString(creator.name ?? obj.created_by_name ?? obj.createdByName, "") ||
      null,
    createdByEmail:
      toString(
        creator.email ?? obj.created_by_email ?? obj.createdByEmail,
        "",
      ) || null,
    convertedInvoiceId:
      toString(
        obj.converted_invoice_id ??
          obj.convertedInvoiceId ??
          convertedInvoice.id,
        "",
      ) || null,
    convertedInvoiceNumber:
      toString(
        convertedInvoice.number ??
          obj.converted_invoice_number ??
          obj.convertedInvoiceNumber,
        "",
      ) || null,
    convertedInvoiceStatus:
      toString(
        convertedInvoice.status ??
          obj.converted_invoice_status ??
          obj.convertedInvoiceStatus,
        "",
      ) || null,
    convertedInvoiceAmountPaid: toNumber(
      convertedInvoice.amount_paid ??
        convertedInvoice.amountPaid ??
        obj.converted_invoice_amount_paid ??
        obj.convertedInvoiceAmountPaid,
      0,
    ),
    convertedInvoiceBalanceDue: toNumber(
      convertedInvoice.balance_due ??
        convertedInvoice.balanceDue ??
        obj.converted_invoice_balance_due ??
        obj.convertedInvoiceBalanceDue,
      0,
    ),
    convertedInvoiceCurrency:
      toString(
        convertedInvoice.currency ??
          obj.converted_invoice_currency ??
          obj.convertedInvoiceCurrency,
        "",
      ) || null,
  };
}

function normalizeProforma(raw: unknown): ProformaItem {
  const obj = isObject(raw) ? raw : {};
  return {
    id: toString(obj.id, ""),
    number: toString(obj.number, ""),
    status: toString(obj.status, "draft"),
    customerName: customerNameFrom(obj),
    issueDate: toString(obj.issue_date, "") || null,
    expiryDate: toString(obj.expiry_date, "") || null,
    total: toNumber(obj.total, 0),
    currency: toString(obj.currency, "USD"),
    itemsCount: Math.max(
      0,
      Math.trunc(toNumber(obj.items_count ?? obj.itemsCount, 0)),
    ),
    createdAt: toString(obj.created_at, "") || null,
  };
}

function normalizeInvoice(raw: unknown): InvoiceItem {
  const obj = isObject(raw) ? raw : {};
  const creator = isObject(obj.creator) ? obj.creator : {};
  const voidedByUser = isObject(obj.voided_by_user) ? obj.voided_by_user : {};
  return {
    id: toString(obj.id, ""),
    number: toString(obj.number, ""),
    status: toString(obj.status, "issued"),
    customerName: customerNameFrom(obj),
    issueDate: toString(obj.issue_date, "") || null,
    dueDate: toString(obj.due_date, "") || null,
    total: toNumber(obj.total, 0),
    amountPaid: toNumber(obj.amount_paid ?? obj.amountPaid, 0),
    balanceDue: toNumber(obj.balance_due ?? obj.balanceDue, 0),
    currency: toString(obj.currency, "USD"),
    itemsCount: Math.max(
      0,
      Math.trunc(toNumber(obj.items_count ?? obj.itemsCount, 0)),
    ),
    paymentsCount: Math.max(
      0,
      Math.trunc(toNumber(obj.payments_count ?? obj.paymentsCount, 0)),
    ),
    createdAt: toString(obj.created_at, "") || null,
    createdBy: toString(obj.created_by ?? obj.createdBy, "") || null,
    createdByName:
      toString(creator.name ?? obj.created_by_name ?? obj.createdByName, "") ||
      null,
    createdByEmail:
      toString(
        creator.email ?? obj.created_by_email ?? obj.createdByEmail,
        "",
      ) || null,
    voidedBy: toString(obj.voided_by ?? obj.voidedBy, "") || null,
    voidedByName:
      toString(
        voidedByUser.name ?? obj.voided_by_name ?? obj.voidedByName,
        "",
      ) || null,
    voidedByEmail:
      toString(
        voidedByUser.email ?? obj.voided_by_email ?? obj.voidedByEmail,
        "",
      ) || null,
  };
}

async function listResource<T>(
  business: string,
  resource: string,
  params: DocumentListParams,
  map: (value: unknown) => T,
): Promise<DocumentListResult<T>> {
  const raw = await apiFetch<unknown>(buildPath(business, resource, params));
  const items = getCollection(raw).map(map);
  const meta = getMeta(raw, items.length);

  return {
    items,
    currentPage: meta.currentPage,
    perPage: meta.perPage,
    total: meta.total,
    lastPage: meta.lastPage,
  };
}

function toCreatePayload(
  input: CreateSalesDocumentInput,
): Record<string, unknown> {
  return {
    type: input.type,
    status: input.status ?? "draft",
    customer_id:
      typeof input.customerId === "string" &&
      /^\d+$/.test(input.customerId.trim())
        ? Number(input.customerId.trim())
        : null,
    issue_date: input.issueDate ?? null,
    expiry_date: input.expiryDate ?? null,
    currency: input.currency ?? "USD",
    reference: input.reference ?? null,
    title: input.title ?? null,
    notes: input.notes ?? null,
    items: input.items.map((item) => ({
      product_id:
        typeof item.productId === "string" &&
        /^\d+$/.test(item.productId.trim())
          ? Number(item.productId.trim())
          : null,
      name: item.name,
      sku: item.sku ?? null,
      description: item.description ?? null,
      quantity: item.quantity,
      unit: item.unit ?? null,
      unit_price: item.unitPrice,
      tax_rate: item.taxRate ?? 0,
    })),
  };
}

export async function listSalesDocuments(
  business: string,
  params: DocumentListParams = {},
): Promise<DocumentListResult<SalesDocumentItem>> {
  return listResource(business, "documents", params, normalizeSalesDocument);
}

export async function createSalesDocument(
  business: string,
  input: CreateSalesDocumentInput,
): Promise<SalesDocumentItem> {
  const raw = await apiFetch<unknown>(
    `/api/app/${encodeURIComponent(business)}/documents`,
    {
      method: "POST",
      json: toCreatePayload(input),
    },
  );
  return normalizeSalesDocument(raw);
}

function normalizeConvertedInvoice(raw: unknown): ConvertedInvoice {
  const obj = isObject(raw) ? raw : {};
  return {
    id: toString(obj.id, ""),
    number: toString(obj.number, ""),
    status: toString(obj.status, "issued"),
    total: toNumber(obj.total, 0),
    amountPaid: toNumber(obj.amount_paid ?? obj.amountPaid, 0),
    balanceDue: toNumber(obj.balance_due ?? obj.balanceDue, 0),
    currency: toString(obj.currency, "USD"),
  };
}

export async function convertSalesDocumentToInvoice(
  business: string,
  documentId: string,
  input?: ConvertDocumentToInvoiceInput,
): Promise<ConvertedInvoice> {
  const payload: Record<string, unknown> = {};

  if (input?.discountType) {
    payload.discount_type = input.discountType;
    payload.discount_value = input.discountValue ?? 0;
  }

  if (input?.payment && input.payment.amount > 0) {
    payload.payment = {
      amount: input.payment.amount,
      method: input.payment.method ?? "cash",
      paid_at: input.payment.paidAt ?? null,
      reference: input.payment.reference ?? null,
      notes: input.payment.notes ?? null,
    };
  }

  const raw = await apiFetch<unknown>(
    `/api/app/${encodeURIComponent(business)}/documents/${encodeURIComponent(documentId)}/convert-to-invoice`,
    {
      method: "POST",
      json: Object.keys(payload).length > 0 ? payload : undefined,
    },
  );
  return normalizeConvertedInvoice(raw);
}

export async function fetchSalesDocumentPdf(
  business: string,
  documentId: string,
): Promise<Blob> {
  return apiFetchBlob(
    `/api/app/${encodeURIComponent(business)}/documents/${encodeURIComponent(documentId)}/pdf`,
  );
}

export async function fetchInvoicePdf(
  business: string,
  invoiceId: string,
): Promise<Blob> {
  return apiFetchBlob(
    `/api/app/${encodeURIComponent(business)}/invoices/${encodeURIComponent(invoiceId)}/pdf`,
  );
}

export async function listProformas(
  business: string,
  params: DocumentListParams = {},
): Promise<DocumentListResult<ProformaItem>> {
  return listResource(business, "proformas", params, normalizeProforma);
}

export async function listInvoices(
  business: string,
  params: DocumentListParams = {},
): Promise<DocumentListResult<InvoiceItem>> {
  return listResource(business, "invoices", params, normalizeInvoice);
}

export async function addInvoicePayment(
  business: string,
  invoiceId: string,
  input: AddInvoicePaymentInput,
): Promise<InvoiceItem> {
  const raw = await apiFetch<unknown>(
    `/api/app/${encodeURIComponent(business)}/invoices/${encodeURIComponent(invoiceId)}/payments`,
    {
      method: "POST",
      json: {
        amount: input.amount,
        method: input.method ?? "cash",
        paid_at: input.paidAt ?? null,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
      },
    },
  );

  return normalizeInvoice(raw);
}
