"use client";

import { useMemo } from "react";
import { PERMISSION_GROUPS, PERMISSION_HINTS, PERMISSION_LABELS, type BusinessPermission } from "@/lib/businessAccess";

function permissionTone(permission: BusinessPermission): {
  badge: string;
  className: string;
} {
  if (permission.endsWith(".read")) {
    return {
      badge: "Lecture",
      className: "bg-sky-50 text-sky-700 border-sky-200",
    };
  }

  if (permission.endsWith(".create")) {
    return {
      badge: "Ajout",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }

  if (permission.endsWith(".edit")) {
    return {
      badge: "Modification",
      className: "bg-violet-50 text-violet-700 border-violet-200",
    };
  }

  if (
    permission === "billing.discount" ||
    permission === "billing.refund" ||
    permission === "billing.void"
  ) {
    return {
      badge: "Sensible",
      className: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }

  return {
    badge: "Controle",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  };
}

export default function PermissionChecklist({
  selected,
  onToggle,
  allowedPermissions,
}: {
  selected: BusinessPermission[];
  onToggle: (permission: BusinessPermission) => void;
  allowedPermissions: BusinessPermission[];
}) {
  const allowed = useMemo(() => new Set(allowedPermissions), [allowedPermissions]);
  const active = useMemo(() => new Set(selected), [selected]);

  return (
    <div className="space-y-4">
      {PERMISSION_GROUPS.map((group) => {
        const visiblePermissions = group.permissions.filter((permission) => allowed.has(permission));
        if (visiblePermissions.length === 0) return null;

        return (
          <div key={group.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-slate-900">{group.title}</h3>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {visiblePermissions.map((permission) => (
                <label
                  key={permission}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3"
                >
                  <input
                    type="checkbox"
                    checked={active.has(permission)}
                    onChange={() => onToggle(permission)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">
                        {PERMISSION_LABELS[permission]}
                      </span>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                          permissionTone(permission).className
                        }`}
                      >
                        {permissionTone(permission).badge}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      {PERMISSION_HINTS[permission]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
