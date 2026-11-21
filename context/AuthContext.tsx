"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { me } from "../lib/authApi";
import { ApiError, getToken, setToken } from "../lib/api";
import { getStoredLocale, isSupportedLocale, setStoredLocale } from "../lib/locale";
import type { AuthUser, BusinessSummary, MeResponse } from "@/lib/types/auth";
import { clearOfflineIdentity, isNetworkUnavailable, readOfflineIdentity, rememberOfflineIdentity } from "@/lib/offlineAccess";

type AuthState = {
  user: AuthUser | null;
  businesses: BusinessSummary[];
  activeBusiness: BusinessSummary | null;
  permissions: string[];
  loading: boolean;
  refresh: () => Promise<MeResponse | null>;
  clear: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [activeBusiness, setActiveBusiness] = useState<BusinessSummary | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<MeResponse | null> => {
    const token = getToken();

    // Si tu utilises un token (localStorage), on garde ce check.
    // Si tu es en Sanctum cookie-based, enlève ce bloc et appelle me() directement.
    if (!token) {
      clearOfflineIdentity();
      setUser(null);
      setBusinesses([]);
      setActiveBusiness(null);
      setPermissions([]);
      setLoading(false);
      return null;
    }

    setLoading(true);
    try {
      const data: MeResponse = await me(); // GET /api/me
      rememberOfflineIdentity(data);
      setUser(data.user ?? null);
      setBusinesses(data.businesses ?? []);
      setActiveBusiness(data.activeBusiness ?? null);
      setPermissions(data.permissions ?? []);

      const savedLocale = data.user?.locale;
      if (isSupportedLocale(savedLocale) && savedLocale !== getStoredLocale()) {
        setStoredLocale(savedLocale);
        window.dispatchEvent(new CustomEvent("pos-locale-changed", { detail: savedLocale }));
      }

      return data;
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        setToken(null);
        clearOfflineIdentity();
        setUser(null);
        setBusinesses([]);
        setActiveBusiness(null);
        setPermissions([]);
      } else if (isNetworkUnavailable(e)) {
        // A previously verified cashier can reload the visited POS shell
        // during a short outage. Server authorization resumes on reconnect.
        const cached = readOfflineIdentity();
        if (cached) {
          setUser(cached.user ?? null);
          setBusinesses(cached.businesses ?? []);
          setActiveBusiness(cached.activeBusiness ?? null);
          setPermissions(cached.permissions ?? []);
          return cached;
        }
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setToken(null);
    clearOfflineIdentity();
    setUser(null);
    setBusinesses([]);
    setActiveBusiness(null);
    setPermissions([]);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, businesses, activeBusiness, permissions, loading, refresh, clear }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
