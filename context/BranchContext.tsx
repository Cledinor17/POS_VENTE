"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { branchStorageKey, setBranchId } from "../lib/api";
import { listMyBranches, type MyBranchItem } from "../lib/branchesApi";
import { safeGetItem, safeSetItem } from "../lib/safeStorage";

type BranchState = {
  branches: MyBranchItem[];
  currentBranch: MyBranchItem | null;
  loading: boolean;
  selectBranch: (branchId: string) => void;
  refresh: () => Promise<void>;
};

const BranchContext = createContext<BranchState | null>(null);

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const params = useParams<{ business: string }>();
  const business = params?.business ?? "";

  const [branches, setBranches] = useState<MyBranchItem[]>([]);
  const [currentBranch, setCurrentBranch] = useState<MyBranchItem | null>(null);
  const [loading, setLoading] = useState(true);

  const applySelection = useCallback(
    (list: MyBranchItem[], preferredId?: string) => {
      const active = list.filter((item) => item.isActive);
      const saved = preferredId ?? (business ? safeGetItem(branchStorageKey(business)) : null);
      const next =
        (saved ? active.find((item) => item.id === saved) : null) ??
        active.find((item) => item.isMain) ??
        active[0] ??
        null;

      setCurrentBranch(next);
      setBranchId(next ? next.id : null);
      if (business && next) safeSetItem(branchStorageKey(business), next.id);
    },
    [business],
  );

  const refresh = useCallback(async () => {
    if (!business) return;
    setLoading(true);
    try {
      const list = await listMyBranches(business);
      setBranches(list);
      applySelection(list);
    } catch {
      setBranches([]);
      setCurrentBranch(null);
      setBranchId(null);
    } finally {
      setLoading(false);
    }
  }, [business, applySelection]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business]);

  const selectBranch = useCallback(
    (branchId: string) => {
      applySelection(branches, branchId);
    },
    [branches, applySelection],
  );

  return (
    <BranchContext.Provider value={{ branches, currentBranch, loading, selectBranch, refresh }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error("useBranch must be used within BranchProvider");
  return ctx;
}
