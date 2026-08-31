import { apiFetch } from "./api";
import type { BusinessPermission } from "./businessAccess";

type Dict = Record<string, unknown>;

export type CustomRole = {
  id: string;
  name: string;
  slug: string;
  permissions: BusinessPermission[];
  createdAt: string | null;
};

export type CreateCustomRoleInput = {
  name: string;
  permissions: BusinessPermission[];
};

export type UpdateCustomRoleInput = Partial<CreateCustomRoleInput>;

function isObject(value: unknown): value is Dict {
  return typeof value === "object" && value !== null;
}

function toString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function basePath(business: string): string {
  return `/api/app/${encodeURIComponent(business)}/roles`;
}

function getCollection(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!isObject(raw)) return [];
  if (Array.isArray(raw.data)) return raw.data;
  return [];
}

function getResource(raw: unknown): unknown {
  if (!isObject(raw)) return raw;
  if (isObject(raw.data)) return raw.data;
  return raw;
}

function normalizeCustomRole(raw: unknown): CustomRole {
  const obj = isObject(raw) ? raw : {};
  return {
    id: toString(obj.id, ""),
    name: toString(obj.name, ""),
    slug: toString(obj.slug, ""),
    permissions: Array.isArray(obj.permissions)
      ? obj.permissions.filter((value): value is BusinessPermission => typeof value === "string")
      : [],
    createdAt: toString(obj.created_at ?? obj.createdAt, "") || null,
  };
}

export async function listCustomRoles(business: string): Promise<CustomRole[]> {
  const raw = await apiFetch<unknown>(basePath(business));
  return getCollection(raw).map(normalizeCustomRole);
}

export async function createCustomRole(business: string, input: CreateCustomRoleInput): Promise<CustomRole> {
  const raw = await apiFetch<unknown>(basePath(business), {
    method: "POST",
    json: { name: input.name, permissions: input.permissions },
  });
  return normalizeCustomRole(getResource(raw));
}

export async function updateCustomRole(
  business: string,
  roleId: string,
  input: UpdateCustomRoleInput,
): Promise<CustomRole> {
  const payload: Dict = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.permissions !== undefined) payload.permissions = input.permissions;

  const raw = await apiFetch<unknown>(`${basePath(business)}/${encodeURIComponent(roleId)}`, {
    method: "PATCH",
    json: payload,
  });
  return normalizeCustomRole(getResource(raw));
}

export async function deleteCustomRole(business: string, roleId: string): Promise<void> {
  await apiFetch<unknown>(`${basePath(business)}/${encodeURIComponent(roleId)}`, {
    method: "DELETE",
  });
}
