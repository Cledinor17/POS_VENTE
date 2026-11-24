"use client";

import { useId, useState, type ComponentType, type KeyboardEvent } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeftRight, BarChart3, CalendarDays, ClipboardList, Landmark, LoaderCircle, Package, Receipt, Store, Tags, Truck, Wallet, Warehouse, type LucideIcon } from "lucide-react";
import { useBusinessPermissions } from "@/lib/useBusinessPermissions";
import { hasPermission, type BusinessPermission } from "@/lib/businessAccess";
import type { ManagementPanelProps } from "./types";

function PanelLoading() {
  const t = useTranslations("settingsHub");
  return <p role="status" className="flex items-center gap-2 p-6 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />{t("loading")}</p>;
}

type Tab = { id: string; label: string; icon: LucideIcon; permissions: BusinessPermission | BusinessPermission[]; panel: ComponentType<ManagementPanelProps> };
const productTabs: Tab[] = [
  { id: "products", label: "product_catalog", icon: Package, permissions: ["catalog.read", "supplies.read", "supplies.manage", "products.create", "products.edit"], panel: dynamic<ManagementPanelProps>(() => import("./panels/ProductsPanel"), { loading: PanelLoading }) },
  { id: "categories", label: "categories", icon: Tags, permissions: ["supplies.read", "supplies.manage"], panel: dynamic<ManagementPanelProps>(() => import("./panels/CategoriesPanel"), { loading: PanelLoading }) },
  { id: "transfers", label: "stock_transfers", icon: ArrowLeftRight, permissions: "inventory.read", panel: dynamic<ManagementPanelProps>(() => import("./panels/StockTransfersPanel"), { loading: PanelLoading }) },
  { id: "inventory", label: "inventory", icon: Warehouse, permissions: "inventory.read", panel: dynamic<ManagementPanelProps>(() => import("./panels/InventoryPanel"), { loading: PanelLoading }) },
];
const supplierTabs: Tab[] = [
  { id: "suppliers", label: "suppliers", icon: Truck, permissions: "supplies.read", panel: dynamic<ManagementPanelProps>(() => import("./panels/SuppliersPanel"), { loading: PanelLoading }) },
  { id: "purchase_orders", label: "purchase_orders", icon: ClipboardList, permissions: "supplies.read", panel: dynamic<ManagementPanelProps>(() => import("./panels/PurchaseOrdersPanel"), { loading: PanelLoading }) },
];

const accountingTabs: Tab[] = [
  { id: "accounting", label: "accounting_journal", icon: ClipboardList, permissions: "accounting.read", panel: dynamic<ManagementPanelProps>(() => import("./panels/AccountingPanel"), { loading: PanelLoading }) },
  { id: "periods", label: "accounting_periods", icon: CalendarDays, permissions: "accounting.read", panel: dynamic<ManagementPanelProps>(() => import("./panels/AccountingPeriodsPanel"), { loading: PanelLoading }) },
  { id: "finance", label: "reports_finance", icon: BarChart3, permissions: "reports.read", panel: dynamic<ManagementPanelProps>(() => import("./panels/FinanceReportsPanel"), { loading: PanelLoading }) },
  { id: "bank", label: "bank_reconciliation", icon: Landmark, permissions: "accounting.read", panel: dynamic<ManagementPanelProps>(() => import("./panels/BankReconciliationPanel"), { loading: PanelLoading }) },
];
const reportTabs: Tab[] = [
  { id: "sales", label: "reports_sales", icon: Receipt, permissions: "reports.read", panel: dynamic<ManagementPanelProps>(() => import("./panels/SalesReportsPanel"), { loading: PanelLoading }) },
  { id: "stock", label: "reports_inventory", icon: Warehouse, permissions: "reports.read", panel: dynamic<ManagementPanelProps>(() => import("./panels/StockReportsPanel"), { loading: PanelLoading }) },
  { id: "departments", label: "reports_departments", icon: Store, permissions: "reports.read", panel: dynamic<ManagementPanelProps>(() => import("./panels/DepartmentReportsPanel"), { loading: PanelLoading }) },
  { id: "cash_sessions", label: "reports_cash_sessions", icon: Wallet, permissions: "reports.read", panel: dynamic<ManagementPanelProps>(() => import("./panels/CashSessionsReportsPanel"), { loading: PanelLoading }) },
  { id: "receivables", label: "reports_ar", icon: ClipboardList, permissions: "reports.read", panel: dynamic<ManagementPanelProps>(() => import("./panels/ReceivablesReportsPanel"), { loading: PanelLoading }) },
  { id: "finance", label: "reports_finance", icon: Landmark, permissions: "reports.read", panel: dynamic<ManagementPanelProps>(() => import("./panels/FinanceReportsPanel"), { loading: PanelLoading }) },
];
const sections = {
  products: { tabs: productTabs, title: "reference.product_catalog", icon: Package },
  suppliers: { tabs: supplierTabs, title: "reference.suppliers", icon: Truck },
  accounting: { tabs: accountingTabs, title: "reference.accounting", icon: Landmark },
  reports: { tabs: reportTabs, title: "reference.reports", icon: BarChart3 },
};
type ManagementSection = keyof typeof sections;

export default function ManagementHub({ section, initialTab }: { section: ManagementSection; initialTab?: string }) {
  const { business = "" } = useParams<{ business: string }>();
  return <ManagementTabs key={`${business}:${section}:${initialTab ?? "default"}`} business={business} section={section} initialTab={initialTab} />;
}

function ManagementTabs({ business, section, initialTab }: { business: string; section: ManagementSection; initialTab?: string }) {
  const t = useTranslations("nav");
  const status = useTranslations("settingsHub");
  const reports = useTranslations("reportHub");
  const accounting = useTranslations("accountingHub");
  const locale = useLocale();
  const { permissions, loading } = useBusinessPermissions(business);
  const [selected, setSelected] = useState(initialTab ?? section);
  const [visited, setVisited] = useState<string[]>([]);
  const id = useId();
  const configuration = sections[section];
  const isReports = section === "reports";
  const isAccounting = section === "accounting";
  const visibleTabs = loading ? [] : configuration.tabs.filter(tab => hasPermission(permissions, tab.permissions));
  const activeTab = visibleTabs.find(tab => tab.id === selected) ?? visibleTabs[0];
  const title = t(configuration.title);
  const Icon = configuration.icon;

  function selectTab(next: string, focus = false) {
    if (!visibleTabs.some(tab => tab.id === next)) return;
    setVisited(previous => Array.from(new Set([...previous, ...(activeTab ? [activeTab.id] : []), next])));
    setSelected(next);
    if (focus) document.getElementById(`${id}-tab-${next}`)?.focus();
  }

  function keyboard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const direction = locale === "ar" ? -1 : 1;
    let next: number;
    switch (event.key) {
      case "ArrowRight": next = (index + direction + visibleTabs.length) % visibleTabs.length; break;
      case "ArrowLeft": next = (index - direction + visibleTabs.length) % visibleTabs.length; break;
      case "Home": next = 0; break;
      case "End": next = visibleTabs.length - 1; break;
      default: return;
    }
    event.preventDefault();
    selectTab(visibleTabs[next].id, true);
  }

  return <div className="space-y-5">
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h1 className="flex items-center gap-3 text-xl font-semibold text-slate-900"><Icon className="h-6 w-6 text-[#0d63b8]" aria-hidden="true" />{title}</h1>
      {isReports && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{reports("description")}</p>}
      {isAccounting && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{accounting("description")}</p>}
      {isReports && activeTab && <label className="mt-5 block space-y-2 border-t border-slate-100 pt-4 md:hidden">
        <span className="text-sm font-semibold text-slate-700">{reports("chooseReport")}</span>
        <select value={activeTab.id} onChange={event => selectTab(event.target.value)} aria-controls={`${id}-panel-${activeTab.id}`}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-[#0d63b8] focus:ring-2 focus:ring-blue-100">
          {visibleTabs.map(tab => <option key={tab.id} value={tab.id}>{t(tab.label)}</option>)}
        </select>
      </label>}
      {visibleTabs.length > 0 && <div role="tablist" aria-label={title} className={isReports
        ? "mt-5 hidden gap-2 border-t border-slate-100 pt-4 md:grid md:grid-cols-2 xl:grid-cols-3"
        : isAccounting
          ? "mt-5 grid grid-cols-1 gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2 xl:grid-cols-4"
          : "mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4"}>
        {visibleTabs.map((tab, index) => {
          const active = activeTab?.id === tab.id;
          const TabIcon = tab.icon;
          return <button key={tab.id} type="button" role="tab" id={`${id}-tab-${tab.id}`} aria-selected={active}
            aria-controls={`${id}-panel-${tab.id}`} tabIndex={active ? 0 : -1}
            onClick={() => selectTab(tab.id)} onKeyDown={event => keyboard(event, index)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d63b8] ${isReports || isAccounting ? "min-w-0 justify-start text-start" : ""} ${active ? "border-[#0a4d8f] bg-[#0a4d8f] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-[#0d63b8]"}`}>
            <TabIcon className="h-4 w-4 shrink-0" aria-hidden="true" />{t(tab.label)}
          </button>;
        })}
      </div>}
    </section>
    {!activeTab && (loading ? <PanelLoading /> : <p role="status" className="rounded-2xl border border-slate-100 bg-white p-6 text-slate-500">{status("noAccess")}</p>)}
    {visibleTabs.map(tab => {
      const active = activeTab?.id === tab.id;
      const Panel = tab.panel;
      return <section key={tab.id} role="tabpanel" id={`${id}-panel-${tab.id}`} aria-labelledby={`${id}-tab-${tab.id}`}
        hidden={!active} tabIndex={0} className="min-w-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d63b8]">
        {(active || visited.includes(tab.id)) && <Panel active={active} onSelectTab={next => selectTab(next, true)} />}
      </section>;
    })}
  </div>;
}
