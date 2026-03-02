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

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("pos_token");
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (!token) localStorage.removeItem("pos_token");
  else localStorage.setItem("pos_token", token);
}

type FetchOptions = RequestInit & { json?: unknown; token?: string | null };

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const token = options.token ?? getToken();

  const headers: HeadersInit = {
    Accept: "application/json",
    ...(options.json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

  const headers: HeadersInit = {
    Accept: "*/*",
    ...(options.json ? { "Content-Type": "application/json" } : {}),
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
