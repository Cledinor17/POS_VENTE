import { ApiError, apiFetch } from "./api";

type Dict = Record<string, unknown>;

export type CouponDiscountType = "percent" | "fixed";

export type CouponItem = {
  id: string;
  code: string;
  name: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  minPurchaseAmount: number | null;
  maxUses: number | null;
  maxUsesPerCustomer: number | null;
  usedCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string | null;
};

export type CouponInput = {
  code: string;
  name?: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  minPurchaseAmount?: number | null;
  maxUses?: number | null;
  maxUsesPerCustomer?: number | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  isActive?: boolean;
};

export type CouponValidationResult =
  | { valid: true; coupon: CouponItem; discountAmount: number }
  | { valid: false; message: string };

function isObject(value: unknown): value is Dict {
  return typeof value === "object" && value !== null;
}

function toString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
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

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = toNumber(value, NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function basePath(business: string): string {
  return `/api/app/${encodeURIComponent(business)}/coupons`;
}

function getCollection(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!isObject(raw)) return [];
  if (Array.isArray(raw.data)) return raw.data;
  return [];
}

function normalizeCoupon(raw: unknown): CouponItem {
  const obj = isObject(raw) ? raw : {};
  const discountType = toString(obj.discount_type, "percent");

  return {
    id: toString(obj.id, ""),
    code: toString(obj.code, ""),
    name: toString(obj.name, "") || null,
    discountType: discountType === "fixed" ? "fixed" : "percent",
    discountValue: toNumber(obj.discount_value, 0),
    minPurchaseAmount: toNumberOrNull(obj.min_purchase_amount),
    maxUses: toNumberOrNull(obj.max_uses),
    maxUsesPerCustomer: toNumberOrNull(obj.max_uses_per_customer),
    usedCount: toNumber(obj.used_count, 0),
    startsAt: toString(obj.starts_at, "") || null,
    expiresAt: toString(obj.expires_at, "") || null,
    isActive: obj.is_active !== false,
    createdAt: toString(obj.created_at, "") || null,
  };
}

function toPayload(input: Partial<CouponInput>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (input.code !== undefined) payload.code = input.code;
  if (input.name !== undefined) payload.name = input.name;
  if (input.discountType !== undefined) payload.discount_type = input.discountType;
  if (input.discountValue !== undefined) payload.discount_value = input.discountValue;
  if (input.minPurchaseAmount !== undefined) payload.min_purchase_amount = input.minPurchaseAmount;
  if (input.maxUses !== undefined) payload.max_uses = input.maxUses;
  if (input.maxUsesPerCustomer !== undefined) payload.max_uses_per_customer = input.maxUsesPerCustomer;
  if (input.startsAt !== undefined) payload.starts_at = input.startsAt;
  if (input.expiresAt !== undefined) payload.expires_at = input.expiresAt;
  if (input.isActive !== undefined) payload.is_active = input.isActive;
  return payload;
}

export async function listCoupons(business: string): Promise<CouponItem[]> {
  const raw = await apiFetch<unknown>(basePath(business));
  return getCollection(raw).map(normalizeCoupon);
}

export async function createCoupon(business: string, input: CouponInput): Promise<CouponItem> {
  const raw = await apiFetch<unknown>(basePath(business), {
    method: "POST",
    json: toPayload(input),
  });
  return normalizeCoupon(raw);
}

export async function updateCoupon(
  business: string,
  couponId: string,
  input: Partial<CouponInput>
): Promise<CouponItem> {
  const raw = await apiFetch<unknown>(`${basePath(business)}/${encodeURIComponent(couponId)}`, {
    method: "PUT",
    json: toPayload(input),
  });
  return normalizeCoupon(raw);
}

export async function deleteCoupon(business: string, couponId: string): Promise<void> {
  await apiFetch<unknown>(`${basePath(business)}/${encodeURIComponent(couponId)}`, {
    method: "DELETE",
  });
}

export async function validateCoupon(
  business: string,
  input: { code: string; subtotal: number; customerId?: string | number | null }
): Promise<CouponValidationResult> {
  try {
    const raw = await apiFetch<Dict>(`${basePath(business)}/validate`, {
      method: "POST",
      json: {
        code: input.code,
        subtotal: input.subtotal,
        customer_id: input.customerId ?? null,
      },
    });

    return {
      valid: true,
      coupon: normalizeCoupon(raw.coupon),
      discountAmount: toNumber(raw.discount_amount, 0),
    };
  } catch (error) {
    if (error instanceof ApiError) {
      return { valid: false, message: error.message };
    }
    return { valid: false, message: "Impossible de valider ce code promo." };
  }
}
