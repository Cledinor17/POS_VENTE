"use client";

import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { normalizeBusinessPermissions, type BusinessPermission } from "@/lib/businessAccess";

export function useBusinessPermissions(businessSlug: string) {
  const { businesses, activeBusiness, permissions: fallbackPermissions, loading } = useAuth();

  const currentBusinessEntry = useMemo(
    () => businesses.find((item) => item.slug === businessSlug) ?? activeBusiness ?? null,
    [activeBusiness, businesses, businessSlug],
  );

  const permissions = useMemo<BusinessPermission[]>(() => {
    const scoped = currentBusinessEntry?.pivot?.permissions;
    if (Array.isArray(scoped)) {
      return normalizeBusinessPermissions(scoped.filter((value: unknown): value is string => typeof value === "string"));
    }

    return normalizeBusinessPermissions(fallbackPermissions);
  }, [currentBusinessEntry, fallbackPermissions]);

  return {
    loading,
    currentBusinessEntry,
    permissions,
  };
}
