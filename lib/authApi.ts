import { apiFetch, getToken, setToken } from "./api";
import type { AuthUser, LoginResponse, MeResponse } from "./types/auth";

type LoginApiResponse = Partial<LoginResponse> & {
  access_token?: string;
  data?: Partial<LoginResponse> & {
    access_token?: string;
  };
};

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await apiFetch<LoginApiResponse>("/api/auth/login", {
    method: "POST",
    json: { email, password },
  });

  const token = res.token ?? res.access_token ?? res.data?.token ?? res.data?.access_token ?? null;
  const user = res.user ?? res.data?.user ?? null;

  if (!token || !user) {
    throw new Error("Reponse login invalide: token/user introuvable.");
  }

  setToken(token);
  return user;
}

export async function me(): Promise<MeResponse> {
  const raw = await apiFetch<any>("/api/me");

  // Certains backends renvoient {data: ...}
  const user = (raw?.data ?? raw);

  const businesses = Array.isArray(user?.businesses) ? user.businesses : [];
  const activeBusiness =
    businesses.find((b: any) => b?.pivot?.status === "active") ??
    businesses[0] ??
    null;

  return { user, businesses, activeBusiness };
}

export async function logout(): Promise<void> {
  await apiFetch<unknown>("/api/auth/logout", { method: "POST" });
  setToken(null);
}

export async function updatePassword(current_password: string, password: string, password_confirmation: string) {
  return apiFetch("/api/me/password", {
    method: "POST",
    json: { current_password, password, password_confirmation },
  });
}

export async function updateAvatar(file: File) {
  const token = getToken();
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "";

  const fd = new FormData();
  fd.append("avatar", file);

  const res = await fetch(`${base}/api/me/avatar`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || "Upload avatar echoue");
  }
  return res.json().catch(() => ({}));
}
