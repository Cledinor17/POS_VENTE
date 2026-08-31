"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { hasPermission } from "@/lib/businessAccess";
import type { BusinessPermission } from "@/lib/businessAccess";

/**
 * Redirects to /[business]/dashboard if the current user lacks the required permission.
 * Returns { allowed, loading } so the page can render a skeleton while auth loads.
 */
export function usePermissionGuard(permission: BusinessPermission): {
  allowed: boolean;
  loading: boolean;
} {
  const { permissions, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ business: string }>();
  const business = params?.business ?? "";

  const allowed = hasPermission(permissions, permission);

  useEffect(() => {
    if (loading) return;
    if (!allowed && business) {
      router.replace(`/${business}/dashboard`);
    }
  }, [loading, allowed, business, router]);

  return { allowed, loading };
}
