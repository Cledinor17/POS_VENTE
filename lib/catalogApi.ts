import { apiFetch } from "./api";

export type Id = number | string;
export type ProductStatus = "active" | "draft" | "archived";
export type ProductType = "product" | "service";

export type CatalogCategory = {
  id: Id;
  name: string;
  description: string;
  productsCount: number;
  active: boolean;
};

export type CatalogProduct = {
  id: Id;
  sku: string;
  name: string;
  category: string;
  categoryId: Id | null;
  imagePath: string | null;
  type: ProductType;
  price: number;
  cost: number;
  stock: number;
  reorderLevel: number;
  unit: string;
  taxRate: number;
  barcode: string;
  description: string;
  soldCount: number;
  active: boolean;
  status: ProductStatus;
};

export type CreateCategoryInput = {
  name: string;
  description?: string;
  active?: boolean;
  isActive?: boolean;
};

export type UpdateCategoryInput = Partial<CreateCategoryInput>;

export type CreateProductInput = {
  name: string;
  sku: string;
  categoryId?: Id | null;
  category?: string;
  type: ProductType;
  barcode?: string;
  price: number;
  cost: number;
  stock: number;
  reorderLevel?: number;
  unit?: string;
  taxRate?: number;
  status: ProductStatus;
  description?: string;
  imageFile?: File | null;
};

export type UpdateProductInput = Partial<CreateProductInput> & {
  active?: boolean;
  isActive?: boolean;
};

type Dict = Record<string, unknown>;

function isObject(value: unknown): value is Dict {
  return typeof value === "object" && value !== null;
}

function extractCollection<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (!isObject(raw)) return [];

  const data = raw.data;
  if (Array.isArray(data)) return data as T[];

  if (isObject(data) && Array.isArray(data.data)) {
    return data.data as T[];
  }

  if (isObject(data)) {
    const dataRecord = data as Record<string, unknown>;
    if (Array.isArray(dataRecord.categories)) return dataRecord.categories as T[];
    if (Array.isArray(dataRecord.products)) return dataRecord.products as T[];
    if (Array.isArray(dataRecord.items)) return dataRecord.items as T[];
  }

  if (Array.isArray((raw as Record<string, unknown>).categories)) {
    return (raw as Record<string, unknown>).categories as T[];
  }

  if (Array.isArray((raw as Record<string, unknown>).products)) {
    return (raw as Record<string, unknown>).products as T[];
  }

  return [];
}

function extractResource<T>(raw: unknown): T {
  if (isObject(raw) && isObject(raw.data)) {
    return raw.data as T;
  }
  return raw as T;
}

function extractResourceByKeys<T>(raw: unknown, keys: string[]): T {
  const base = extractResource<unknown>(raw);
  if (!isObject(base)) return base as T;

  for (const key of keys) {
    const nested = base[key];
    if (isObject(nested)) return nested as T;
  }

  return base as T;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

function toString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "bigint") return value.toString();
  return fallback;
}

function toId(value: unknown): Id | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const trimmed = value.trim();
    return /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
  }
  return null;
}

function getStatus(value: unknown): ProductStatus {
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (lower === "active") return "active";
    if (lower === "draft" || lower === "pending") return "draft";
    return "archived";
  }
  if (value === true || value === 1) return "active";
  return "archived";
}

function getCategoryName(value: unknown): string {
  if (typeof value === "string") return value;
  if (isObject(value) && typeof value.name === "string") return value.name;
  return "";
}

function normalizeCategory(raw: unknown): CatalogCategory {
  const obj = isObject(raw) ? raw : {};
  const nested = isObject(obj.category) ? obj.category : null;

  const id =
    toId(obj.id) ??
    toId(obj.category_id) ??
    toId(obj.categoryId) ??
    toId(obj.uuid) ??
    toId(obj.slug) ??
    toId(nested?.id) ??
    `${Date.now()}-${Math.random()}`;
  const status = obj.status;
  const explicitActive = obj.active ?? obj.is_active ?? obj.isActive;

  let active = true;
  if (typeof explicitActive === "boolean") {
    active = explicitActive;
  } else if (typeof explicitActive === "number") {
    active = explicitActive === 1;
  } else if (typeof status === "string") {
    active = status.toLowerCase() === "active";
  }

  const productsCountCandidate =
    obj.products_count ??
    obj.productsCount ??
    obj.items_count ??
    (Array.isArray(obj.products) ? obj.products.length : 0);

  return {
    id,
    name: toString(obj.name, "Categorie"),
    description: toString(obj.description, ""),
    productsCount: toNumber(productsCountCandidate, 0),
    active,
  };
}

function normalizeProduct(raw: unknown): CatalogProduct {
  const obj = isObject(raw) ? raw : {};
  const categoryName = getCategoryName(obj.category) || toString(obj.category_name, "");
  const categoryObject = isObject(obj.category) ? obj.category : null;
  const type = toString(obj.type, "product");
  const imagePath = toString(
    obj.image_path ?? obj.imagePath ?? obj.image_url ?? obj.imageUrl,
    ""
  );
  const status = getStatus(obj.status ?? obj.active ?? obj.is_active);
  const soldCount = toNumber(
    obj.sold_count ??
      obj.soldCount ??
      obj.sales_count ??
      obj.sale_count ??
      obj.times_sold ??
      obj.total_sold ??
      obj.total_quantity_sold ??
      obj.quantity_sold ??
      obj.sold_qty,
    0
  );
  const explicitActive = obj.is_active ?? obj.active;
  const active =
    typeof explicitActive === "boolean"
      ? explicitActive
      : typeof explicitActive === "number"
        ? explicitActive === 1
        : status === "active";

  return {
    id:
      toId(obj.id) ??
      toId(obj.product_id) ??
      toId(obj.productId) ??
      toId(obj.uuid) ??
      toId(obj.slug) ??
      `${Date.now()}-${Math.random()}`,
    sku: toString(obj.sku, toString(obj.code, "N/A")),
    name: toString(obj.name, "Produit"),
    category: categoryName || "Non classe",
    categoryId: toId(obj.category_id) ?? toId(obj.categoryId) ?? toId(categoryObject?.id) ?? null,
    imagePath: imagePath || null,
    type: type === "service" ? "service" : "product",
    price: toNumber(
      obj.price ?? obj.sale_price ?? obj.selling_price ?? obj.unit_price,
      0
    ),
    cost: toNumber(
      obj.cost ?? obj.cost_price ?? obj.purchase_price ?? obj.buying_price,
      0
    ),
    stock: toNumber(
      obj.stock ?? obj.stock_quantity ?? obj.quantity ?? obj.current_stock,
      0
    ),
    reorderLevel: toNumber(
      obj.reorder_level ?? obj.reorderLevel ?? obj.alert_quantity ?? obj.alert_stock,
      0
    ),
    unit: toString(obj.unit, "piece"),
    taxRate: toNumber(obj.tax_rate ?? obj.taxRate ?? obj.vat_rate, 0),
    barcode: toString(obj.barcode, ""),
    description: toString(obj.description, ""),
    soldCount,
    active,
    status,
  };
}

function businessBasePath(business: string): string {
  return `/api/app/${encodeURIComponent(business)}`;
}

function encodeId(id: Id): string {
  return encodeURIComponent(String(id));
}

function categoryPayload(input: CreateCategoryInput | UpdateCategoryInput): Dict {
  const payload: Dict = {};
  if (typeof input.name === "string") payload.name = input.name;
  if (typeof input.description === "string") payload.description = input.description;
  const activeValue =
    typeof input.isActive === "boolean"
      ? input.isActive
      : typeof input.active === "boolean"
        ? input.active
        : undefined;
  if (typeof activeValue === "boolean") {
    payload.is_active = activeValue;
  }
  return payload;
}

function productPayload(input: CreateProductInput | UpdateProductInput): Dict {
  const payload: Dict = {};
  const updateInput = input as UpdateProductInput;

  if (typeof input.name === "string") payload.name = input.name;
  if (typeof input.sku === "string") payload.sku = input.sku;
  if (typeof input.category === "string") payload.category = input.category;
  if (typeof input.type === "string") {
    payload.type = input.type;
    payload.product_type = input.type;
  }
  const activeValue =
    typeof updateInput.isActive === "boolean"
      ? updateInput.isActive
      : typeof updateInput.active === "boolean"
        ? updateInput.active
        : undefined;
  if (typeof activeValue === "boolean") {
    payload.is_active = activeValue;
    payload.active = activeValue;
    if (input.status === undefined) {
      payload.status = activeValue ? "active" : "inactive";
    }
  }
  if (input.categoryId !== undefined) payload.category_id = toId(input.categoryId) ?? input.categoryId;
  if (typeof input.barcode === "string") payload.barcode = input.barcode;
  if (typeof input.description === "string") payload.description = input.description;
  if (typeof input.unit === "string") payload.unit = input.unit;
  if (input.price !== undefined) {
    payload.price = input.price;
    payload.selling_price = input.price;
  }
  if (input.cost !== undefined) {
    payload.cost = input.cost;
    payload.cost_price = input.cost;
  }
  if (input.stock !== undefined) {
    payload.stock = input.stock;
    payload.stock_quantity = input.stock;
  }
  if (input.reorderLevel !== undefined) payload.reorder_level = input.reorderLevel;
  if (input.taxRate !== undefined) payload.tax_rate = input.taxRate;
  if (input.status !== undefined) payload.status = input.status;

  return payload;
}

function payloadToFormData(payload: Dict): FormData {
  const formData = new FormData();

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "boolean") {
      formData.append(key, value ? "1" : "0");
      continue;
    }
    formData.append(key, String(value));
  }

  return formData;
}

export async function getCategories(business: string): Promise<CatalogCategory[]> {
  const raw = await apiFetch<unknown>(`${businessBasePath(business)}/categories`);
  return extractCollection<unknown>(raw).map(normalizeCategory);
}

export async function createCategory(
  business: string,
  input: CreateCategoryInput
): Promise<CatalogCategory> {
  const raw = await apiFetch<unknown>(`${businessBasePath(business)}/categories`, {
    method: "POST",
    json: categoryPayload(input),
  });
  return normalizeCategory(extractResourceByKeys<unknown>(raw, ["category"]));
}

export async function getCategory(business: string, categoryId: Id): Promise<CatalogCategory> {
  const raw = await apiFetch<unknown>(`${businessBasePath(business)}/categories/${encodeId(categoryId)}`);
  return normalizeCategory(extractResourceByKeys<unknown>(raw, ["category"]));
}

export async function updateCategory(
  business: string,
  categoryId: Id,
  input: UpdateCategoryInput
): Promise<CatalogCategory> {
  const raw = await apiFetch<unknown>(`${businessBasePath(business)}/categories/${encodeId(categoryId)}`, {
    method: "PATCH",
    json: categoryPayload(input),
  });
  return normalizeCategory(extractResourceByKeys<unknown>(raw, ["category"]));
}

export async function deleteCategory(business: string, categoryId: Id): Promise<void> {
  await apiFetch<unknown>(`${businessBasePath(business)}/categories/${encodeId(categoryId)}`, {
    method: "DELETE",
  });
}

export async function getProducts(
  business: string,
  options: { all?: boolean; perPage?: number } = {}
): Promise<CatalogProduct[]> {
  const qp = new URLSearchParams();
  if (options.all) qp.set("all", "1");
  if (options.perPage && options.perPage > 0) qp.set("per_page", String(options.perPage));

  const query = qp.toString();
  const path = query.length > 0
    ? `${businessBasePath(business)}/products?${query}`
    : `${businessBasePath(business)}/products`;

  const raw = await apiFetch<unknown>(path);
  return extractCollection<unknown>(raw).map(normalizeProduct);
}

export async function createProduct(
  business: string,
  input: CreateProductInput
): Promise<CatalogProduct> {
  const payload = productPayload(input);
  let raw: unknown;

  if (input.imageFile instanceof File) {
    const formData = payloadToFormData(payload);
    formData.append("image", input.imageFile);
    raw = await apiFetch<unknown>(`${businessBasePath(business)}/products`, {
      method: "POST",
      body: formData,
    });
  } else {
    raw = await apiFetch<unknown>(`${businessBasePath(business)}/products`, {
      method: "POST",
      json: payload,
    });
  }

  return normalizeProduct(extractResourceByKeys<unknown>(raw, ["product"]));
}

export async function getProduct(business: string, productId: Id): Promise<CatalogProduct> {
  const raw = await apiFetch<unknown>(`${businessBasePath(business)}/products/${encodeId(productId)}`);
  return normalizeProduct(extractResourceByKeys<unknown>(raw, ["product"]));
}

export async function updateProduct(
  business: string,
  productId: Id,
  input: UpdateProductInput
): Promise<CatalogProduct> {
  const payload = productPayload(input);
  let raw: unknown;

  if (input.imageFile instanceof File) {
    const formData = payloadToFormData(payload);
    formData.append("image", input.imageFile);
    raw = await apiFetch<unknown>(`${businessBasePath(business)}/products/${encodeId(productId)}`, {
      method: "PATCH",
      body: formData,
    });
  } else {
    raw = await apiFetch<unknown>(`${businessBasePath(business)}/products/${encodeId(productId)}`, {
      method: "PATCH",
      json: payload,
    });
  }

  return normalizeProduct(extractResourceByKeys<unknown>(raw, ["product"]));
}

export async function deleteProduct(business: string, productId: Id): Promise<void> {
  await apiFetch<unknown>(`${businessBasePath(business)}/products/${encodeId(productId)}`, {
    method: "DELETE",
  });
}
