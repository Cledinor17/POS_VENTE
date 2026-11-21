"use client";

import { useId, useState, type ComponentType, type KeyboardEvent } from "react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import {
  Building2, DatabaseBackup, KeyRound, LoaderCircle,
  Printer, Settings, ShieldCheck, Smartphone, Store, Tag, Users,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { hasPermission, type BusinessPermission } from "@/lib/businessAccess";
import { useBusinessPermissions } from "@/lib/useBusinessPermissions";
import type { SettingsPanelProps } from "./types";

function PanelLoading() {
  const t = useTranslations("settingsHub");
  return <p role="status" className="flex items-center gap-2 p-6 text-sm text-slate-500">
    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />{t("loading")}
  </p>;
}

const tabs: {
  id: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  permission?: BusinessPermission;
  platformOnly?: boolean;
  panel: ComponentType<SettingsPanelProps>;
}[] = [
  { id: "business", icon: Building2, permission: "business.read", panel: dynamic<SettingsPanelProps>(() => import("./panels/BusinessSettingsPanel"), { loading: PanelLoading }) },
  { id: "branches", icon: Store, permission: "business.read", panel: dynamic<SettingsPanelProps>(() => import("./panels/BranchesSettingsPanel"), { loading: PanelLoading }) },
  { id: "users", icon: Users, permission: "users.read", panel: dynamic<SettingsPanelProps>(() => import("./panels/UsersSettingsPanel"), { loading: PanelLoading }) },
  { id: "roles", icon: KeyRound, permission: "users.manage", panel: dynamic<SettingsPanelProps>(() => import("./panels/RolesSettingsPanel"), { loading: PanelLoading }) },
  { id: "printers", icon: Printer, permission: "billing.read", panel: dynamic<SettingsPanelProps>(() => import("./panels/PrintersSettingsPanel"), { loading: PanelLoading }) },
  { id: "coupons", icon: Tag, permission: "business.read", panel: dynamic<SettingsPanelProps>(() => import("./panels/CouponsSettingsPanel"), { loading: PanelLoading }) },
  { id: "audit", icon: ShieldCheck, permission: "audit.read", panel: dynamic<SettingsPanelProps>(() => import("./panels/AuditSettingsPanel"), { loading: PanelLoading }) },
  { id: "backup", icon: DatabaseBackup, permission: "business.manage", panel: dynamic<SettingsPanelProps>(() => import("./panels/BackupSettingsPanel"), { loading: PanelLoading }) },
  { id: "mobile", icon: Smartphone, platformOnly: true, panel: dynamic<SettingsPanelProps>(() => import("./panels/MobileSettingsPanel"), { loading: PanelLoading }) },
];

export default function BusinessSettingsHub({ business }: { business: string }) {
  const t = useTranslations("settingsHub");
  const locale = useLocale();
  const { user } = useAuth();
  const { permissions, currentBusinessEntry, loading } = useBusinessPermissions(business);
  const businessName = (currentBusinessEntry?.slug === business ? currentBusinessEntry.name?.trim() : "")
    || business || t("title");
  const id = useId();
  const [selected, setSelected] = useState("business");
  const [visited, setVisited] = useState<string[]>([]);
  const visibleTabs = tabs.filter(tab => tab.platformOnly
    ? user?.is_platform_admin === true
    : Boolean(user) && Boolean(tab.permission && hasPermission(permissions, tab.permission)));
  const activeTab = visibleTabs.find(tab => tab.id === selected) ?? visibleTabs[0];

  function selectTab(next: string, focus = false) {
    if (!visibleTabs.some(tab => tab.id === next)) return;
    setVisited(previous => Array.from(new Set([...previous, ...(activeTab ? [activeTab.id] : []), next])));
    setSelected(next);
    if (focus) document.getElementById(`${id}-tab-${next}`)?.focus();
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const direction = locale === "ar" ? -1 : 1;
    let nextIndex: number;
    switch (event.key) {
      case "ArrowRight": nextIndex = (index + direction + visibleTabs.length) % visibleTabs.length; break;
      case "ArrowLeft": nextIndex = (index - direction + visibleTabs.length) % visibleTabs.length; break;
      case "Home": nextIndex = 0; break;
      case "End": nextIndex = visibleTabs.length - 1; break;
      default: return;
    }
    event.preventDefault();
    selectTab(visibleTabs[nextIndex].id, true);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0d63b8]">
            <Settings className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold text-slate-900">{businessName}</h1>
            <p className="mt-1 text-sm text-slate-500">{t("description")}</p>
          </div>
        </div>
        {visibleTabs.length > 0 && <div role="tablist" aria-label={t("tabsLabel")}
          className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {visibleTabs.map((tab, index) => {
            const Icon = tab.icon;
            const active = activeTab?.id === tab.id;
            return <button key={tab.id} type="button" role="tab" id={`${id}-tab-${tab.id}`}
              aria-selected={active} aria-controls={`${id}-panel-${tab.id}`} tabIndex={active ? 0 : -1}
              onClick={() => selectTab(tab.id)} onKeyDown={event => onTabKeyDown(event, index)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d63b8] ${active
                ? "border-[#0d63b8] bg-[#0d63b8] text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-[#0d63b8]"}`}>
              <Icon className="h-4 w-4 shrink-0" aria-hidden={true} />{t(`tabs.${tab.id}`)}
            </button>;
          })}
        </div>}
      </section>

      {!activeTab && (loading ? <PanelLoading /> : <p role="status" className="rounded-2xl border border-slate-100 bg-white p-6 text-slate-500">{t("noAccess")}</p>)}

      {visibleTabs.map(tab => {
        const active = activeTab?.id === tab.id;
        const Panel = tab.panel;
        return <section key={tab.id} id={`${id}-panel-${tab.id}`} role="tabpanel"
          aria-labelledby={`${id}-tab-${tab.id}`} hidden={!active} tabIndex={0}
          className="min-w-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d63b8]">
          {/* Keep visited panels mounted so switching tabs does not discard drafts. */}
          {(active || visited.includes(tab.id)) && <Panel embedded active={active}
            onOpenRoles={visibleTabs.some(item => item.id === "roles") ? () => selectTab("roles", true) : undefined} />}
        </section>;
      })}
    </div>
  );
}
