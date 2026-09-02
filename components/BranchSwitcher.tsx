"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Store } from "lucide-react";
import { useBranch } from "@/context/BranchContext";

export default function BranchSwitcher() {
  const { branches, currentBranch, loading, selectBranch } = useBranch();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const activeBranches = branches.filter((item) => item.isActive);
  if (loading || activeBranches.length <= 1) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-blue-200 hover:bg-orange-50"
        title="Changer de succursale"
      >
        <Store className="h-4 w-4 text-slate-500" />
        <span className="max-w-[140px] truncate">{currentBranch?.name ?? "Succursale"}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="absolute left-0 mt-2 w-64 rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden z-50">
          <div className="px-4 py-2.5 border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Succursales
          </div>
          <div className="max-h-72 overflow-y-auto p-1.5">
            {activeBranches.map((branch) => {
              const selected = branch.id === currentBranch?.id;
              return (
                <button
                  key={branch.id}
                  type="button"
                  onClick={() => {
                    if (selected) {
                      setOpen(false);
                      return;
                    }
                    selectBranch(branch.id);
                    setOpen(false);
                    // Pages fetch their data keyed off the business slug in
                    // the URL, not the active branch, so nothing re-fetches
                    // on its own — a reload is the simplest way to guarantee
                    // every screen reflects the newly selected branch.
                    window.location.reload();
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                    selected ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate">
                    {branch.name}
                    {branch.isMain ? <span className="ml-1.5 text-xs text-slate-400">(Principale)</span> : null}
                  </span>
                  {selected ? <Check className="h-4 w-4 shrink-0" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
