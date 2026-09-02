"use client";

import { useBranch } from "@/context/BranchContext";

/**
 * Chooses which branches sell a product. Renders nothing when the business
 * has a single branch — there is no decision to make, and the server
 * defaults to the active branch on its own.
 */
export default function BranchAssignmentPicker({
  selected,
  onChange,
  disabled = false,
}: {
  selected: string[];
  onChange: (branchIds: string[]) => void;
  disabled?: boolean;
}) {
  const { branches } = useBranch();
  const active = branches.filter((item) => item.isActive);

  if (active.length <= 1) return null;

  const allSelected = active.every((branch) => selected.includes(branch.id));

  function toggle(branchId: string) {
    onChange(
      selected.includes(branchId)
        ? selected.filter((item) => item !== branchId)
        : [...selected, branchId],
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">Succursales qui vendent ce produit</div>
          <div className="mt-0.5 text-xs text-slate-500">
            Le produit n&apos;apparait que dans les succursales cochees. Le stock reste compte
            separement pour chacune.
          </div>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(allSelected ? [] : active.map((branch) => branch.id))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {allSelected ? "Tout decocher" : "Toutes les succursales"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {active.map((branch) => {
          const checked = selected.includes(branch.id);
          return (
            <label
              key={branch.id}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                checked
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700 font-semibold"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => toggle(branch.id)}
              />
              {branch.name}
              {branch.isMain ? <span className="text-xs text-slate-400">(Principale)</span> : null}
            </label>
          );
        })}
      </div>

      {selected.length === 0 ? (
        <div className="mt-2 text-xs font-medium text-amber-700">
          Aucune succursale cochee : le produit ne sera visible nulle part.
        </div>
      ) : null}
    </div>
  );
}
