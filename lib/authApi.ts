import { apiFetch, getToken, setToken } from "./api";
import type {
  AuthUser,
  LoginResponse,
  MeResponse,
  RegistrationStartResponse,
  VerificationResponse,
} from "./types/auth";

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

export async function registerAccount(input: {
  name: string;
  email: string;
  password: string;
  passwordConfirmation: string;
}): Promise<RegistrationStartResponse> {
  return apiFetch<RegistrationStartResponse>("/api/auth/register", {
    method: "POST",
    json: {
      name: input.name,
      email: input.email,
      password: input.password,
      password_confirmation: input.passwordConfirmation,
    },
  });
}

export async function verifyRegistration(input: { email: string; code: string }): Promise<AuthUser> {
  const res = await apiFetch<VerificationResponse>("/api/auth/verify-registration", {
    method: "POST",
    json: {
      email: input.email,
      code: input.code,
    },
  });

  if (!res.token || !res.user) {
    throw new Error("Reponse de validation invalide.");
  }

  setToken(res.token);
  return res.user;
}

export async function resendVerificationCode(email: string): Promise<RegistrationStartResponse> {
  return apiFetch<RegistrationStartResponse>("/api/auth/resend-verification-code", {
    method: "POST",
    json: { email },
  });
}

export async function me(): Promise<MeResponse> {
  const raw = await apiFetch<any>("/api/me");
  const payload = raw?.data ?? raw;
  const user = payload?.user ?? payload ?? null;
  const businesses = Array.isArray(payload?.businesses) ? payload.businesses : [];
  const activeBusiness =
    payload?.activeBusiness ??
    businesses.find((b: any) => b?.pivot?.status === "active") ??
    businesses[0] ??
    null;

  const permissions = Array.isArray(payload?.permissions)
    ? payload.permissions.filter((value: unknown): value is string => typeof value === "string")
    : Array.isArray(activeBusiness?.pivot?.permissions)
      ? activeBusiness.pivot.permissions.filter((value: unknown): value is string => typeof value === "string")
      : [];

  return { user, businesses, activeBusiness, permissions };
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
