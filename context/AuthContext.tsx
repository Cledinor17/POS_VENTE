"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { me } from "../lib/authApi";
import { ApiError, getToken, setToken } from "../lib/api";
import type { AuthUser, BusinessSummary, MeResponse } from "@/lib/types/auth";

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
      setUser(data.user ?? null);
      setBusinesses(data.businesses ?? []);
      setActiveBusiness(data.activeBusiness ?? null);
      setPermissions(data.permissions ?? []);
      return data;
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        setToken(null);
        setUser(null);
        setBusinesses([]);
        setActiveBusiness(null);
        setPermissions([]);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setToken(null);
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
