import type { BusinessSummary, MeResponse } from "./types/auth";
import { ApiError } from "./api";
import { safeGetItem, safeRemoveItem, safeSetItem } from "./safeStorage";

// Temporary offline continuity, NOT a server-authorized session or ledger.
// Every queued sale is still validated against live permissions and cash/stock
// when the API returns. Snapshots expire after a typical 12-hour shift.
const MAX_AGE_MS = 12 * 60 * 60 * 1000;
const AUTH_KEY = "pos_offline_identity_v1";

type Snapshot<T> = { savedAt: number; value: T };

export function isNetworkUnavailable(error: unknown): boolean {
  // An API denial (401, 403, 422, etc.) must never be treated as offline.
  if (error instanceof ApiError) return false;
  return error instanceof TypeError ||
    (typeof navigator !== "undefined" && navigator.onLine === false);
}

export function rememberOfflineValue<T>(key: string, value: T): void {
  safeSetItem(key, JSON.stringify({ savedAt: Date.now(), value } satisfies Snapshot<T>));
}

export function readOfflineValue<T>(key: string): T | null {
  const raw = safeGetItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Snapshot<T>>;
    if (typeof parsed.savedAt !== "number" || parsed.savedAt > Date.now() ||
      Date.now() - parsed.savedAt > MAX_AGE_MS || parsed.value == null) {
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

export function removeOfflineValue(key: string): void {
  safeRemoveItem(key);
}

function minimalBusiness(business: BusinessSummary | null | undefined): BusinessSummary | null {
  if (!business || typeof business.slug !== "string") return null;
  return {
    id: business.id,
    slug: business.slug,
    name: business.name,
    status: business.status,
    pivot: {
      role: business.pivot?.role,
      status: business.pivot?.status,
      permissions: business.pivot?.permissions,
    },
  };
}

export function rememberOfflineIdentity(data: MeResponse): void {
  if (!data.user?.id) return;
  const user = data.user;
  rememberOfflineValue<MeResponse>(AUTH_KEY, {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
      locale: user.locale,
    },
    businesses: (data.businesses ?? [])
      .map(minimalBusiness)
      .filter((item): item is BusinessSummary => item !== null),
    activeBusiness: minimalBusiness(data.activeBusiness),
    permissions: data.permissions ?? [],
  });
}

export function readOfflineIdentity(): MeResponse | null {
  const identity = readOfflineValue<MeResponse>(AUTH_KEY);
  return identity?.user?.id && Array.isArray(identity.businesses) ? identity : null;
}

export function clearOfflineIdentity(): void {
  removeOfflineValue(AUTH_KEY);
}

// Cache keys are scoped to the authenticated cashier, business and branch.
// No credentials, approval passwords, or auth tokens are stored here.
export function offlineScopeKey(
  kind: "branches" | "cash-session" | "pos-settings",
  business: string,
  userId: string | number,
  branchId?: string
): string {
  return ["pos_offline_v1", kind, encodeURIComponent(business),
    encodeURIComponent(String(userId)), branchId ? encodeURIComponent(branchId) : ""].join(":");
}
