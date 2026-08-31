export type AuthUser = {
  id?: number | string;
  name?: string;
  email?: string;
  email_verified_at?: string | null;
  avatar_path?: string | null;
  avatar_url?: string | null;
  locale?: string | null;
  [key: string]: unknown;
};

export type BusinessSummary = {
  id?: number | string;
  slug: string;
  name?: string;
  role?: string | null;
  pivot?: {
    role?: string | null;
    status?: string | null;
    permissions?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
};

export type RegistrationStartResponse = {
  message: string;
  email: string;
  expires_at?: string | null;
  debug_code?: string | null;
};

export type VerificationResponse = {
  message: string;
  token: string;
  user: AuthUser;
};

export type PasswordResetRequestResponse = {
  message: string;
};

export type MeResponse = {
  user: AuthUser | null;
  businesses?: BusinessSummary[];
  activeBusiness?: BusinessSummary | null;
  permissions?: string[];
};
