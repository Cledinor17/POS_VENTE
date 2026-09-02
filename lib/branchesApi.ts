import { apiFetch } from "./api";

type Dict = Record<string, unknown>;

export type BranchItem = {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  address: Record<string, unknown> | null;
  phone: string | null;
  isMain: boolean;
  isActive: boolean;
  createdAt: string | null;
};

export type BranchInput = {
  name: string;
  slug: string;
  code?: string | null;
  address?: Record<string, unknown> | null;
  phone?: string | null;
  isActive?: boolean;
  // Seeds the new branch's catalogue from an existing one (create only).
  copyProductsFromBranchId?: string | null;
};

function isObject(value: unknown): value is Dict {
  return typeof value === "object" && value !== null;
}

function toString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function basePath(business: string): string {
  return `/api/app/${encodeURIComponent(business)}/branches`;
}

function getCollection(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!isObject(raw)) return [];
  if (Array.isArray(raw.data)) return raw.data;
  return [];
}

function normalizeBranch(raw: unknown): BranchItem {
  const obj = isObject(raw) ? raw : {};

  return {
    id: toString(obj.id, ""),
    name: toString(obj.name, "Succursale"),
    slug: toString(obj.slug, ""),
    code: toString(obj.code, "") || null,
    address: isObject(obj.address) ? obj.address : null,
    phone: toString(obj.phone, "") || null,
    isMain: Boolean(obj.is_main),
    isActive: Boolean(obj.is_active),
    createdAt: toString(obj.created_at, "") || null,
  };
}

function toPayload(input: Partial<BranchInput>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.slug !== undefined) payload.slug = input.slug;
  if (input.code !== undefined) payload.code = input.code;
  if (input.address !== undefined) payload.address = input.address;
  if (input.phone !== undefined) payload.phone = input.phone;
  if (input.isActive !== undefined) payload.is_active = input.isActive;
  if (input.copyProductsFromBranchId) {
    payload.copy_products_from_branch_id = Number(input.copyProductsFromBranchId);
  }
  return payload;
}

export async function listBranches(business: string): Promise<BranchItem[]> {
  const raw = await apiFetch<unknown>(basePath(business));
  return getCollection(raw).map(normalizeBranch);
}

export async function createBranch(business: string, input: BranchInput): Promise<BranchItem> {
  const raw = await apiFetch<unknown>(basePath(business), {
    method: "POST",
    json: toPayload(input),
  });
  return normalizeBranch(raw);
}

export async function updateBranch(
  business: string,
  branchId: string,
  input: Partial<BranchInput>
): Promise<BranchItem> {
  const raw = await apiFetch<unknown>(`${basePath(business)}/${encodeURIComponent(branchId)}`, {
    method: "PUT",
    json: toPayload(input),
  });
  return normalizeBranch(raw);
}

// Minimal shape returned by /branches/mine — just enough for the active-
// branch switcher and the staff branch-assignment picker. Unlike
// listBranches(), this only requires business membership (no read_business
// ability), and is scoped server-side to the branches the caller can
// actually operate in.
export type MyBranchItem = {
  id: string;
  name: string;
  slug: string;
  isMain: boolean;
  isActive: boolean;
};

function normalizeMyBranch(raw: unknown): MyBranchItem {
  const obj = isObject(raw) ? raw : {};

  return {
    id: toString(obj.id, ""),
    name: toString(obj.name, "Succursale"),
    slug: toString(obj.slug, ""),
    isMain: Boolean(obj.is_main),
    isActive: Boolean(obj.is_active),
  };
}

export async function listMyBranches(business: string): Promise<MyBranchItem[]> {
  const raw = await apiFetch<unknown>(`${basePath(business)}/mine`);
  return getCollection(raw).map(normalizeMyBranch);
}
