import { apiFetch } from "./api";

type Dict = Record<string, unknown>;

export type ExpenseCategoryItem = {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  expensesCount: number;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ExpenseItem = {
  id: string;
  businessId: string;
  expenseCategoryId: string | null;
  amount: number;
  currency: string | null;
  expenseDate: string | null;
  purpose: string;
  justification: string | null;
  paymentMethod: string | null;
  reference: string | null;
  notes: string | null;
  attachmentPath: string | null;
  attachmentUrl: string | null;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  category: { id: string; name: string } | null;
  createdByUser: { id: string; name: string; email: string | null } | null;
};

export type ExpenseListResult = {
  items: ExpenseItem[];
  currentPage: number;
  perPage: number;
  total: number;
  lastPage: number;
};

export type CreateExpenseCategoryInput = {
  name: string;
  description?: string;
  isActive?: boolean;
};

export type UpdateExpenseCategoryInput = Partial<CreateExpenseCategoryInput>;

export type ListExpensesParams = {
  page?: number;
  perPage?: number;
  q?: string;
  categoryId?: string;
  from?: string;
  to?: string;
};

export type CreateExpenseInput = {
  expenseCategoryId: string;
  amount: number;
  currency?: string;
  expenseDate: string;
  purpose: string;
  justification?: string;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
  attachment?: File | null;
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

function toBool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "1" || normalized === "true") return true;
    if (normalized === "0" || normalized === "false") return false;
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
      Math.trunc(toNumber(source.current_page ?? source.currentPage, defaults.currentPage)),
    ),
    perPage: Math.max(
      1,
      Math.trunc(toNumber(source.per_page ?? source.perPage, defaults.perPage)),
    ),
    total: Math.max(0, Math.trunc(toNumber(source.total, defaults.total))),
    lastPage: Math.max(
      1,
      Math.trunc(toNumber(source.last_page ?? source.lastPage, defaults.lastPage)),
    ),
  };
}

function basePath(business: string): string {
  return `/api/app/${encodeURIComponent(business)}`;
}

function normalizeCategory(raw: unknown): ExpenseCategoryItem {
  const obj = isObject(raw) ? raw : {};
  return {
    id: toString(obj.id, ""),
    businessId: toString(obj.business_id ?? obj.businessId, ""),
    name: toString(obj.name, ""),
    description: toString(obj.description, "") || null,
    isActive: toBool(obj.is_active ?? obj.isActive, true),
    expensesCount: toNumber(obj.expenses_count ?? obj.expensesCount, 0),
    createdByUserId: toString(obj.created_by_user_id ?? obj.createdByUserId, "") || null,
    updatedByUserId: toString(obj.updated_by_user_id ?? obj.updatedByUserId, "") || null,
    createdAt: toString(obj.created_at ?? obj.createdAt, "") || null,
    updatedAt: toString(obj.updated_at ?? obj.updatedAt, "") || null,
  };
}

function normalizeExpense(raw: unknown): ExpenseItem {
  const obj = isObject(raw) ? raw : {};
  const categoryRaw = isObject(obj.category) ? obj.category : null;
  const createdByRaw = isObject(obj.created_by_user ?? obj.createdByUser)
    ? ((obj.created_by_user ?? obj.createdByUser) as Dict)
    : null;

  return {
    id: toString(obj.id, ""),
    businessId: toString(obj.business_id ?? obj.businessId, ""),
    expenseCategoryId: toString(obj.expense_category_id ?? obj.expenseCategoryId, "") || null,
    amount: toNumber(obj.amount, 0),
    currency: toString(obj.currency, "") || null,
    expenseDate: toString(obj.expense_date ?? obj.expenseDate, "") || null,
    purpose: toString(obj.purpose, ""),
    justification: toString(obj.justification, "") || null,
    paymentMethod: toString(obj.payment_method ?? obj.paymentMethod, "") || null,
    reference: toString(obj.reference, "") || null,
    notes: toString(obj.notes, "") || null,
    attachmentPath: toString(obj.attachment_path ?? obj.attachmentPath, "") || null,
    attachmentUrl: toString(obj.attachment_url ?? obj.attachmentUrl, "") || null,
    createdByUserId: toString(obj.created_by_user_id ?? obj.createdByUserId, "") || null,
    updatedByUserId: toString(obj.updated_by_user_id ?? obj.updatedByUserId, "") || null,
    createdAt: toString(obj.created_at ?? obj.createdAt, "") || null,
    updatedAt: toString(obj.updated_at ?? obj.updatedAt, "") || null,
    category: categoryRaw
      ? {
          id: toString(categoryRaw.id, ""),
          name: toString(categoryRaw.name, ""),
        }
      : null,
    createdByUser: createdByRaw
      ? {
          id: toString(createdByRaw.id, ""),
          name: toString(createdByRaw.name, ""),
          email: toString(createdByRaw.email, "") || null,
        }
      : null,
  };
}

export async function listExpenseCategories(
  business: string,
  params: { includeInactive?: boolean } = {},
): Promise<ExpenseCategoryItem[]> {
  const qp = new URLSearchParams();
  if (params.includeInactive) qp.set("include_inactive", "1");
  const query = qp.toString();
  const path = query
    ? `${basePath(business)}/expense-categories?${query}`
    : `${basePath(business)}/expense-categories`;
  const raw = await apiFetch<unknown>(path);
  return getCollection(raw).map(normalizeCategory);
}

export async function createExpenseCategory(
  business: string,
  input: CreateExpenseCategoryInput,
): Promise<ExpenseCategoryItem> {
  const raw = await apiFetch<unknown>(`${basePath(business)}/expense-categories`, {
    method: "POST",
    json: {
      name: input.name,
      description: input.description ?? null,
      is_active: input.isActive ?? true,
    },
  });
  return normalizeCategory(raw);
}

export async function updateExpenseCategory(
  business: string,
  categoryId: string,
  input: UpdateExpenseCategoryInput,
): Promise<ExpenseCategoryItem> {
  const raw = await apiFetch<unknown>(
    `${basePath(business)}/expense-categories/${encodeURIComponent(categoryId)}`,
    {
      method: "PUT",
      json: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
      },
    },
  );
  return normalizeCategory(raw);
}

export async function listExpenses(
  business: string,
  params: ListExpensesParams = {},
): Promise<ExpenseListResult> {
  const qp = new URLSearchParams();
  if (params.page && params.page > 0) qp.set("page", String(params.page));
  if (params.perPage && params.perPage > 0) qp.set("per_page", String(params.perPage));
  if (params.q && params.q.trim().length > 0) qp.set("q", params.q.trim());
  if (params.categoryId && params.categoryId.trim().length > 0) qp.set("category_id", params.categoryId.trim());
  if (params.from && params.from.trim().length > 0) qp.set("from", params.from.trim());
  if (params.to && params.to.trim().length > 0) qp.set("to", params.to.trim());

  const query = qp.toString();
  const path = query ? `${basePath(business)}/expenses?${query}` : `${basePath(business)}/expenses`;
  const raw = await apiFetch<unknown>(path);
  const items = getCollection(raw).map(normalizeExpense);
  const meta = getMeta(raw, items.length);

  return {
    items,
    currentPage: meta.currentPage,
    perPage: meta.perPage,
    total: meta.total,
    lastPage: meta.lastPage,
  };
}

export async function createExpense(
  business: string,
  input: CreateExpenseInput,
): Promise<ExpenseItem> {
  const formData = new FormData();
  formData.set("expense_category_id", input.expenseCategoryId);
  formData.set("amount", String(input.amount));
  formData.set("expense_date", input.expenseDate);
  formData.set("purpose", input.purpose);

  if (input.currency && input.currency.trim().length > 0) {
    formData.set("currency", input.currency.trim());
  }
  if (input.justification && input.justification.trim().length > 0) {
    formData.set("justification", input.justification.trim());
  }
  if (input.paymentMethod && input.paymentMethod.trim().length > 0) {
    formData.set("payment_method", input.paymentMethod.trim());
  }
  if (input.reference && input.reference.trim().length > 0) {
    formData.set("reference", input.reference.trim());
  }
  if (input.notes && input.notes.trim().length > 0) {
    formData.set("notes", input.notes.trim());
  }
  if (input.attachment) {
    formData.set("attachment", input.attachment);
  }

  const raw = await apiFetch<unknown>(`${basePath(business)}/expenses`, {
    method: "POST",
    body: formData,
  });
  return normalizeExpense(raw);
}
