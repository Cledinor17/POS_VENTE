"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Permission } from "@/lib/rbac";
import { menuGroups } from "@/lib/menu";

function canSee(permissions: Permission[], needed?: Permission) {
  if (!needed) return true;
  return permissions.includes(needed);
}

export default function Sidebar({
  brand,
  business,
  permissions,
  open,
  onClose,
}: {
  brand: string;
  business: string;
  permissions: Permission[];
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={[
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out",
        open ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0 lg:static lg:inset-0",
      ].join(" ")}
    >
      <div className="flex items-center justify-center h-20 border-b border-slate-100">
        <span className="text-2xl font-bold text-indigo-600">
          <i className="fa-solid fa-rocket mr-2" />
          {brand}
        </span>
      </div>

      <nav className="mt-6 px-4 space-y-2 overflow-y-auto h-[calc(100vh-80px)] pb-10">
        {menuGroups.map((group) => {
          const visibleItems = group.items.filter((it) => canSee(permissions, it.permission));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.title}>
              <p className="text-xs font-semibold text-slate-400 uppercase px-3 pt-4">
                {group.title}
              </p>

              <div className="mt-2 space-y-2">
                {visibleItems.map((item) => {
                  const href = item.href(business);
                  const active = pathname === href;

                  return (
                    <Link
                      key={item.label}
                      href={href}
                      onClick={onClose}
                      className={[
                        "flex items-center p-3 rounded-xl transition-all",
                        active
                          ? "text-indigo-600 bg-indigo-50 font-semibold"
                          : "text-slate-600 hover:bg-slate-50 hover:text-indigo-600",
                      ].join(" ")}
                    >
                      <i className={`${item.icon} w-6`} />
                      <span className="ml-1">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
