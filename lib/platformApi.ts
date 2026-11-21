import { apiFetch } from "./api";

export type PlatformBusiness = {
  id: number;
  name: string;
  slug: string;
  status: "active" | "suspended" | string;
  business_type: string;
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  timezone: string | null;
  has_hotel: boolean;
  has_restaurant: boolean;
  has_pool: boolean;
  has_services: boolean;
  has_moment: boolean;
  users_count: number;
  branches_count: number;
  owners: Array<{ id: number; name: string; email: string }>;
  suspension_reason: string | null;
  suspended_at: string | null;
  created_at: string | null;
};

export type PlatformSummary = {
  total: number;
  active: number;
  suspended: number;
  new_this_month: number;
  active_memberships: number;
};

export type PlatformEvent = {
  id: number;
  action: "updated" | "suspended" | "active";
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  actor_name: string | null;
  actor_email: string | null;
  created_at: string;
};

export type PlatformListResponse<T> = {
  data: T[];
  meta: { current_page: number; last_page: number; per_page?: number; total: number };
};

export type PlatformBusinessPatch = Partial<Pick<PlatformBusiness,
  "name" | "legal_name" | "email" | "phone" | "website" | "timezone" |
  "business_type" | "has_hotel" | "has_restaurant" | "has_pool" | "has_services" | "has_moment"
>>;

const prefix = "/api/platform";

export async function getPlatformSummary(): Promise<PlatformSummary> {
  const res = await apiFetch<{ data: PlatformSummary }>(`${prefix}/summary`, { cache: "no-store" });
  return res.data;
}

export async function listPlatformBusinesses(params: {
  search?: string;
  status?: "active" | "suspended" | "";
  page?: number;
} = {}): Promise<PlatformListResponse<PlatformBusiness>> {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.status) query.set("status", params.status);
  if (params.page) query.set("page", String(params.page));
  const suffix = query.size ? `?${query.toString()}` : "";
  return apiFetch<PlatformListResponse<PlatformBusiness>>(`${prefix}/businesses${suffix}`, { cache: "no-store" });
}

export async function getPlatformBusiness(id: number): Promise<PlatformBusiness> {
  const res = await apiFetch<{ data: PlatformBusiness }>(`${prefix}/businesses/${id}`, { cache: "no-store" });
  return res.data;
}

export async function patchPlatformBusiness(id: number, data: PlatformBusinessPatch): Promise<PlatformBusiness> {
  const res = await apiFetch<{ data: PlatformBusiness }>(`${prefix}/businesses/${id}`, {
    method: "PATCH", json: data,
  });
  return res.data;
}

export async function changePlatformBusinessStatus(id: number, operation: "suspend" | "reactivate", reason: string): Promise<PlatformBusiness> {
  const res = await apiFetch<{ data: PlatformBusiness }>(`${prefix}/businesses/${id}/${operation}`, {
    method: "POST", json: { reason },
  });
  return res.data;
}

export async function listPlatformBusinessEvents(id: number): Promise<PlatformListResponse<PlatformEvent>> {
  return apiFetch<PlatformListResponse<PlatformEvent>>(`${prefix}/businesses/${id}/events`, { cache: "no-store" });
}
