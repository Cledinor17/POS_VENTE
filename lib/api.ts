import { getStoredLocale } from "./locale";
import { safeGetItem, safeRemoveItem, safeSetItem } from "./safeStorage";

export class ApiError<TBody = unknown> extends Error {
  status: number;
  body: TBody;
  constructor(status: number, body: TBody) {
    super(getErrorMessage(body, status));
    this.status = status;
    this.body = body;
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type ErrorLike = { message?: unknown };

type ValidationErrorLike = ErrorLike & {
  errors?: unknown;
};

function getValidationMessage(errors: unknown): string | null {
  if (!errors || typeof errors !== "object") return null;

  const entries = Object.entries(errors as Record<string, unknown>);
  const messages: string[] = [];

  for (const [, value] of entries) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && item.trim().length > 0) {
          messages.push(item);
        }
      }
    } else if (typeof value === "string" && value.trim().length > 0) {
      messages.push(value);
    }
  }

  if (messages.length === 0) return null;
  return messages.join(" | ");
}

function getErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const maybeError = body as ValidationErrorLike;
    const validation = getValidationMessage(maybeError.errors);
    if (validation) return validation;
    if (typeof maybeError.message === "string" && maybeError.message.length > 0) {
      return maybeError.message;
    }
  }
  return `API Error ${status}`;
}

// Falls back to an in-memory token when localStorage is unavailable (Safari
// Private Browsing, strict cookie settings, ...), so the session still works
// for the current tab even though it won't survive a page reload.
let memoryToken: string | null = null;

export function getToken(): string | null {
  return safeGetItem("pos_token") ?? memoryToken;
}

export function setToken(token: string | null) {
  memoryToken = token;
  if (!token) safeRemoveItem("pos_token");
  else safeSetItem("pos_token", token);
}

// The currently active branch, sent as X-Branch-Id on every request so the
// backend's SetBranch middleware knows which branch to scope stock/cash/
// sales to. BranchContext is the sole writer (it owns validating the
// selection against the live branch list); this is just the live pointer
// apiFetch reads, same pattern as the token above — a plain module needs it
// outside of React.
let memoryBranchId: string | null = null;

export function getBranchId(): string | null {
  return memoryBranchId;
}

export function setBranchId(branchId: string | null) {
  memoryBranchId = branchId;
}

export function branchStorageKey(business: string): string {
  return `pos_branch:${business}`;
}

// BranchContext's own fetch-and-validate round trip only resolves after
// mount, which would otherwise leave a window on every page load where
// requests go out with no branch header (silently defaulting to Main
// server-side). Falling back to the last business-scoped choice straight
// from storage — synchronously, no context needed — closes that window for
// returning visitors; BranchContext overwrites the in-memory pointer once
// it has confirmed the stored id is still a branch they can access.
function resolveBranchId(path: string): string | null {
  if (memoryBranchId) return memoryBranchId;

  const match = path.match(/\/api\/app\/([^/?]+)/);
  if (!match) return null;

  return safeGetItem(branchStorageKey(decodeURIComponent(match[1])));
}

type FetchOptions = RequestInit & { json?: unknown; token?: string | null };

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const token = options.token ?? getToken();
  const branchId = resolveBranchId(path);

  const headers: HeadersInit = {
    Accept: "application/json",
    "X-Locale": getStoredLocale(),
    ...(options.json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(branchId ? { "X-Branch-Id": branchId } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(url, {
    ...options,
    headers,
    body: options.json ? JSON.stringify(options.json) : options.body,
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const body: unknown = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export async function apiFetchBlob(path: string, options: FetchOptions = {}): Promise<Blob> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const token = options.token ?? getToken();
  const branchId = resolveBranchId(path);

  const headers: HeadersInit = {
    Accept: "*/*",
    "X-Locale": getStoredLocale(),
    ...(options.json ? { "Content-Type": "application/json" } : {}),
    ...(branchId ? { "X-Branch-Id": branchId } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(url, {
    ...options,
    headers,
    body: options.json ? JSON.stringify(options.json) : options.body,
  });

  if (!res.ok) {
    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const body: unknown = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);
    throw new ApiError(res.status, body);
  }

  return res.blob();
}
