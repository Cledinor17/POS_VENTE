"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { getBusinessSettings, getPosSettings } from "../lib/businessApi";
import { useAuth } from "../context/AuthContext";
import { useParams, usePathname } from "next/navigation";
import { hasPermission, type BusinessPermission } from "../lib/businessAccess";
import {
  ArrowLeftRight,
  DatabaseBackup,
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Package,
  Tags,
  Warehouse,
  Users,
  Truck,
  FileText,
  Landmark,
  BarChart3,
  CalendarDays,
  Settings,
  ShieldCheck,
  ChevronDown,
  Store,
  Building2,
  BedDouble,
  CalendarRange,
  Clock3,
  Sparkles,
  PackageOpen,
  Layers,
  UtensilsCrossed,
  Waves,
  ClipboardList,
  RotateCcw,
  Wallet,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  labelKey: string;
  href: (b: string) => string;
  icon?: LucideIcon;
  emoji?: string;
  badgeKey?: string;
  exact?: boolean;
  activePaths?: (b: string) => string[];
  permissions?: BusinessPermission | BusinessPermission[];
};

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function normalizeHrefPath(href: string): string {
  return href.split(/[?#]/, 1)[0] || href;
}

function matchesNavItem(item: NavItem, business: string, pathname: string | null): boolean {
  const paths = [item.href(business), ...(item.activePaths?.(business) ?? [])].map(normalizeHrefPath);
  return paths.some(path => pathname === path || (!item.exact && Boolean(pathname?.startsWith(`${path}/`))));
}

function NavLink({ item, business, label, badge }: { item: NavItem; business: string; label: string; badge?: string }) {
  const pathname = usePathname();
  const href = item.href(business);
  const active = matchesNavItem(item, business, pathname);

  const Icon = item.icon;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "group flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-all duration-200 hover:translate-x-0.5",
        active
          ? "bg-[#0a4d8f] text-white border-[#083a6d] shadow-md"
          : "border-transparent text-slate-700 hover:border-[#0a4d8f] hover:bg-[#0d63b8] hover:text-white hover:shadow-sm"
      )}
    >
      {item.emoji ? (
        <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center text-lg leading-none">
          {item.emoji}
        </span>
      ) : Icon ? (
        <Icon
          className={cx(
            "h-4 w-4 shrink-0 transition-colors",
            active ? "text-white" : "text-slate-500 group-hover:text-orange-200"
          )}
        />
      ) : null}

      <span className="min-w-0 break-words font-medium">{label}</span>

      {badge ? (
        <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-[#f59e0b] text-white">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function CollapsibleNavMenu({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sm text-slate-700 transition-colors hover:border-[#0a4d8f] hover:bg-[#0d63b8] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d63b8]"
      >
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-orange-200" />
        <span className="font-medium">{title}</span>
        <ChevronDown aria-hidden="true" className={cx("ml-auto h-4 w-4 transition-transform duration-200", open && "rotate-180")} />
      </button>
      <div id={panelId} hidden={!open} className="ml-5 mt-0.5 space-y-0.5 border-l border-slate-200 pl-2">
        {children}
      </div>
    </div>
  );
}


export default function Sidebar() {
  const t = useTranslations("nav");
  const { user, activeBusiness, businesses, permissions: fallbackPermissions } = useAuth();
  const params = useParams<{ business: string }>();
  const pathname = usePathname();
  const business = params?.business || "";
  const [businessLogoUrl, setBusinessLogoUrl] = useState("");
  const [failedLogoUrl, setFailedLogoUrl] = useState("");
  const [modules, setModules] = useState({
    businessSlug: "",
    businessType: "",
    hotel: false,
    restaurant: false,
    pool: false,
    services: false,
    moment: false,
  });

  const [dollarPurchaseEnabled, setDollarPurchaseEnabled] = useState(false);
  const currentBusinessEntry = useMemo(
    () => businesses.find((item) => item.slug === business) ?? activeBusiness ?? null,
    [activeBusiness, businesses, business],
  );
  const businessName = (currentBusinessEntry?.slug === business ? currentBusinessEntry.name?.trim() : "")
    || business || t("general_settings");
  const currentPermissions = useMemo(() => {
    const scoped = currentBusinessEntry?.pivot?.permissions;
    if (Array.isArray(scoped)) {
      return scoped.filter((value: unknown): value is string => typeof value === "string");
    }
    return fallbackPermissions;
  }, [currentBusinessEntry, fallbackPermissions]);

  useEffect(() => {
    let mounted = true;

    async function loadBusinessLogo() {
      setDollarPurchaseEnabled(false);
      if (!business) {
        setBusinessLogoUrl("");
        return;
      }

      try {
        const data = await (hasPermission(currentPermissions, "business.read") ? getBusinessSettings(business) : getPosSettings(business));
        if (!mounted) return;

        setDollarPurchaseEnabled(data.dollar_purchase_enabled);
        setModules({
          businessSlug: business,
          businessType: data.business_type,
          hotel: data.has_hotel !== false,
          restaurant: data.has_restaurant !== false,
          pool: data.has_pool !== false,
          services: data.has_services !== false,
          moment: data.has_moment !== false,
        });

        const raw = (data.logo_url || data.logo_path || "").trim();
        if (!raw) {
          setBusinessLogoUrl("");
          return;
        }

        if (
          raw.startsWith("http://") ||
          raw.startsWith("https://") ||
          raw.startsWith("data:") ||
          raw.startsWith("blob:")
        ) {
          setBusinessLogoUrl(raw);
          return;
        }

        const normalized = raw.replace(/^\/+/, "");
        const relative = normalized.startsWith("storage/")
          ? normalized
          : `storage/${normalized}`;
        const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
        setBusinessLogoUrl(base ? `${base}/${relative}` : `/${relative}`);
      } catch {
        if (mounted) setBusinessLogoUrl("");
      }
    }

    void loadBusinessLogo();
    window.addEventListener("business-settings-changed", loadBusinessLogo);
    return () => {
      mounted = false;
      window.removeEventListener("business-settings-changed", loadBusinessLogo);
    };
  }, [business, currentPermissions]);

  const dashboard: NavItem[] = [
    {
      labelKey: "dashboard",
      href: (b) => `/${b}/dashboard`,
      icon: LayoutDashboard,
      permissions: "dashboard.read",
    },
  ];

  const billing: NavItem[] = [
    {
      labelKey: "pos_new_sale",
      href: (b) => `/${b}/pos`,
      icon: ShoppingCart,
      badgeKey: "pos_badge",
      permissions: "billing.manage",
    },
    ...(dollarPurchaseEnabled ? [{ labelKey: "dollar_purchases", href: (b: string) => `/${b}/pos/dollar-purchases`, icon: ArrowLeftRight, permissions: "billing.manage" as BusinessPermission }] : []),
    { labelKey: "tickets_sales", href: (b) => `/${b}/sales`, icon: Receipt, permissions: "billing.read" },
    { labelKey: "returns", href: (b) => `/${b}/returns`, icon: RotateCcw, permissions: ["billing.manage", "billing.refund"] },
    { labelKey: "quotes_proforma", href: (b) => `/${b}/documents`, icon: FileText, permissions: "billing.read" },
    { labelKey: "invoices", href: (b) => `/${b}/invoices`, icon: Receipt, permissions: "billing.read" },
    { labelKey: "recurring_invoices", href: (b) => `/${b}/invoices/recurring`, icon: Receipt, permissions: "billing.read" },
  ];

  const billingOrders: NavItem[] = [
    {
      labelKey: "hotel_orders",
      href: (b) => `/${b}/hotel/orders`,
      icon: Receipt,
      permissions: "hotel.orders.read",
    },
  ];

  const guests: NavItem[] = [
    { labelKey: "customers", href: (b) => `/${b}/customers`, icon: Users, permissions: "customers.read" },
  ];

  const businessAdmin: NavItem[] = [
    { labelKey: "my_business", href: (b) => `/${b}/business`, icon: Building2, permissions: "business.read" },
    { labelKey: "branches", href: (b) => `/${b}/settings/branches`, icon: Store, permissions: "business.read" },
    { labelKey: "general_settings", href: (b) => `/${b}/settings`, icon: Settings, permissions: "business.read" },
    { labelKey: "data_backup", href: (b) => `/${b}/settings/backup`, icon: DatabaseBackup, permissions: "business.manage" },
    { labelKey: "audit_security", href: (b) => `/${b}/audit`, icon: ShieldCheck, permissions: "audit.read" },
  ];

  const expenseAdmin: NavItem[] = [
    {
      labelKey: "expenses_journal",
      href: (b) => `/${b}/expenses`,
      icon: Receipt,
      exact: true,
      permissions: "expenses.read",
    },
    {
      labelKey: "expenses_categories",
      href: (b) => `/${b}/expenses/categories`,
      icon: Layers,
      exact: true,
      permissions: "expenses.manage",
    },
  ];

  const financeAdmin: NavItem[] = [
    { labelKey: "accounting", href: (b) => `/${b}/accounting`, activePaths: (b) => [`/${b}/bank`], icon: Landmark, permissions: "accounting.read" },
    { labelKey: "accounting_periods", href: (b) => `/${b}/accounting/periods`, icon: CalendarDays, permissions: "accounting.read" },
    { labelKey: "payroll", href: (b) => `/${b}/payroll`, icon: Wallet, permissions: "users.read" },
    { labelKey: "bank_reconciliation", href: (b) => `/${b}/bank`, icon: Landmark, permissions: "accounting.read" },
  ];

  const hotelRoomSetup: NavItem[] = [
    { labelKey: "hotel_planning", href: (b) => `/${b}/hotel/planning`, icon: CalendarDays, permissions: "room_setup.read" },
    { labelKey: "hotel_room_categories", href: (b) => `/${b}/hotel/categories`, icon: Layers, permissions: "room_setup.read" },
    { labelKey: "hotel_rooms", href: (b) => `/${b}/hotel/rooms`, icon: BedDouble, permissions: "room_setup.read" },
  ];

  const hotelOperations: NavItem[] = [
    { labelKey: "hotel_dashboard", href: (b) => `/${b}/hotel/dashboard`, icon: LayoutDashboard, permissions: "dashboard.read" },
    { labelKey: "hotel_reservations", href: (b) => `/${b}/hotel/reservations`, icon: CalendarRange, permissions: "reservations.read" },
    { labelKey: "hotel_moments", href: (b) => `/${b}/hotel/moments`, icon: Clock3, permissions: "moments.read" },
    { labelKey: "hotel_housekeeping", href: (b) => `/${b}/hotel/housekeeping`, icon: Sparkles, permissions: "housekeeping.read" },
    { labelKey: "hotel_night_audit", href: (b) => `/${b}/hotel/night-audit`, icon: BarChart3, permissions: "reports.read" },
  ];

  const restaurantItems: NavItem[] = [
    { labelKey: "restaurant_tables", href: (b) => `/${b}/restaurant/tables`, icon: UtensilsCrossed, permissions: "restaurant.read" },
    { labelKey: "restaurant_orders", href: (b) => `/${b}/restaurant/orders`, icon: Receipt, permissions: "restaurant.read" },
  ];

  const poolItems: NavItem[] = [
    { labelKey: "pool", href: (b) => `/${b}/pool`, icon: Waves, permissions: "pool.read" },
  ];

  const servicesItems: NavItem[] = [
    { labelKey: "services", href: (b) => `/${b}/services`, icon: Sparkles, permissions: "services.read" },
  ];

  const supplies: NavItem[] = [
    { labelKey: "amenities", href: (b) => `/${b}/hotel/amenities`, icon: Sparkles, permissions: "supplies.read" },
    { labelKey: "necessities", href: (b) => `/${b}/hotel/necessities`, icon: PackageOpen, permissions: "supplies.read" },
    { labelKey: "product_catalog", href: (b) => `/${b}/products`, activePaths: (b) => [`/${b}/categories`, `/${b}/inventory`], icon: Package, permissions: ["catalog.read", "supplies.read", "supplies.manage", "products.create", "products.edit", "inventory.read"] },
    { labelKey: "categories", href: (b) => `/${b}/categories`, icon: Tags, permissions: "supplies.read" },
    { labelKey: "inventory", href: (b) => `/${b}/inventory`, icon: Warehouse, permissions: "inventory.read" },
    { labelKey: "stock_transfers", href: (b) => `/${b}/inventory/transfers`, icon: ArrowLeftRight, permissions: "inventory.read" },
    { labelKey: "suppliers", href: (b) => `/${b}/suppliers`, activePaths: (b) => [`/${b}/purchase-orders`], icon: Truck, permissions: "supplies.read" },
    { labelKey: "purchase_orders", href: (b) => `/${b}/purchase-orders`, icon: ClipboardList, permissions: "supplies.read" },
  ];

  function visibleItems(items: NavItem[]): NavItem[] {
    return items.filter((item) => hasPermission(currentPermissions, item.permissions));
  }

  function isActiveItem(item: NavItem): boolean {
    return matchesNavItem(item, business, pathname);
  }

  function isActiveGroup(items: NavItem[]): boolean {
    return visibleItems(items).some(isActiveItem);
  }

  function renderNavLinks(items: NavItem[]) {
    return items.map((it) => (
      <NavLink
        key={it.labelKey}
        item={it}
        business={business}
        label={it.labelKey === "general_settings" ? businessName : t(it.labelKey)}
        badge={it.badgeKey ? t(it.badgeKey) : undefined}
      />
    ));
  }

  const hasCurrentModules = modules.businessSlug === business;
  const isHotelBusiness = hasCurrentModules && modules.businessType === "hotel";
  const hasHotelModule = isHotelBusiness && modules.hotel;
  const visibleDashboard = visibleItems(dashboard);
  const visibleBillingOrders = hasHotelModule ? visibleItems(billingOrders) : [];
  const visibleGuests = visibleItems(guests);
  const visibleHotelOperations = hasHotelModule
    ? visibleItems(
        hotelOperations.filter((it) => {
          if (it.href("x").includes("/moments")) return modules.moment;
          return true;
        })
      )
    : [];
  const visibleRestaurant = hasCurrentModules && modules.restaurant ? visibleItems(restaurantItems) : [];
  const visibleQuickOrders = hasCurrentModules && ["restaurant", "hotel", "bar_cafe"].includes(modules.businessType)
    ? ["restaurant_orders", "restaurant_tables"]
        .flatMap((key) => visibleRestaurant.filter((item) => item.labelKey === key))
        .map((item) => ({ ...item, labelKey: item.labelKey === "restaurant_orders" ? "section_orders" : item.labelKey }))
    : [];
  const visiblePool = isHotelBusiness && modules.pool
    ? visibleItems(poolItems)
    : [];
  const visibleServices = hasCurrentModules && modules.services ? visibleItems(servicesItems) : [];
  const visibleSupplies = visibleItems(
    supplies.filter((it) => {
      const href = it.href("x");
      if (href.includes("/hotel/amenities") || href.includes("/hotel/necessities")) return hasHotelModule;
      return true;
    })
  );
  const visibleHotelRoomSetup = hasHotelModule ? visibleItems(hotelRoomSetup) : [];
  const visibleBusinessAdmin = visibleItems(businessAdmin);
  const visibleExpenseAdmin = visibleItems(expenseAdmin);
  const visibleHotelServices: NavItem[] = isHotelBusiness ? [
    ...visibleHotelOperations,
    ...visibleHotelRoomSetup,
    ...visibleBillingOrders,
    ...visibleSupplies.filter((item) => item.href("x").includes("/hotel/")),
    ...(visibleQuickOrders.length > 0 ? [] : visibleRestaurant),
    ...visibleServices,
  ] : [];

  // Reuse the existing routes, permission requirements and enabled modules.
  const referenceSources = [
    ...dashboard, ...billing, ...guests, ...supplies, ...financeAdmin, ...businessAdmin, ...visibleServices,
    { labelKey: "reports", href: (b: string) => `/${b}/reports`, icon: BarChart3, permissions: "reports.read" as BusinessPermission },
  ];
  const referenceGroups = [
    { titleKey: "primary", items: [["dashboard", "📊"], ["pos_new_sale", "💵"], ["tickets_sales", "🧾"], ["quotes_proforma", "📄"]] },
    { titleKey: "management", items: [["product_catalog", "📦"], ["customers", "🎁"], ["suppliers", "🚚"], ...(!isHotelBusiness && visibleServices.length > 0 ? [["services", "✨"]] : [])] },
    { titleKey: "hotel_services", items: [] },
    { titleKey: "finance", items: [["accounting", "📒"], ["payroll", "👥"], ["reports", "📈"]] },
    { titleKey: "system", items: [["general_settings", "⚙️"]] },
  ].map(group => ({
    titleKey: group.titleKey,
    items: group.titleKey === "hotel_services" ? visibleHotelServices : group.items.flatMap(([sourceKey, emoji]) => {
      const source = referenceSources.find(item => item.labelKey === sourceKey);
      if (!source) return [];
      return visibleItems([{
        ...source,
        labelKey: `reference.${sourceKey}`,
        emoji,
        badgeKey: undefined,
        exact: sourceKey === "pos_new_sale" ? true : source.exact,
      }]);
    }),
  }));

  const generalSettingsItems = visibleBusinessAdmin
    .filter((item) => item.labelKey === "general_settings")
    .map((item) => ({ ...item, exact: true }));
  // Match exact destinations: the reports overview does not replace individual reports.
  const representedPaths = new Set([
    ...referenceGroups.filter((group) => group.titleKey !== "system").flatMap((group) => group.items),
    ...visibleQuickOrders,
    ...visiblePool,
    ...visibleExpenseAdmin,
    ...generalSettingsItems,
  ].map((item) => normalizeHrefPath(item.href(business))));
  // These destinations are now tabs in their respective business sections.
  for (const path of ["categories", "inventory", "inventory/transfers", "purchase-orders", "bank"]) {
    representedPaths.add(`/${business}/${path}`);
  }
  const settingsGroups = [
    { titleKey: "dashboard", icon: LayoutDashboard, items: visibleDashboard },
    { titleKey: "section_customers", icon: Users, items: visibleGuests },
    { titleKey: "section_reservations_services", icon: BedDouble, items: visibleHotelOperations },
    { titleKey: "section_restaurant", icon: UtensilsCrossed, items: visibleRestaurant },
    { titleKey: "section_pool", icon: Waves, items: visiblePool },
    { titleKey: "section_services", icon: Sparkles, items: visibleServices },
    { titleKey: "section_stock_purchases", icon: Package, items: visibleSupplies },
    { titleKey: "section_hotel_setup", icon: Layers, items: visibleHotelRoomSetup },
  ].map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      const path = normalizeHrefPath(item.href(business));
      if (representedPaths.has(path)) return false;
      representedPaths.add(path);
      return true;
    }),
  })).filter((group) => group.items.length > 0);
  const settingsItems = [...generalSettingsItems, ...settingsGroups.flatMap((group) => group.items)];
  const visibleReferenceGroups = referenceGroups.filter((group) => group.titleKey === "system"
    ? settingsItems.length > 0
    : group.items.length > 0
      || (group.titleKey === "primary" && (visibleQuickOrders.length > 0 || visiblePool.length > 0))
      || (group.titleKey === "management" && visibleExpenseAdmin.length > 0));

  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* Header sidebar */}
      <div className="shrink-0 border-b border-slate-200/70 px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-2xl overflow-hidden bg-gradient-to-br from-[#0d63b8] to-[#f59e0b] text-white flex items-center justify-center shadow-sm">
            {businessLogoUrl && failedLogoUrl !== businessLogoUrl ? (
              <Image
                src={businessLogoUrl}
                alt={`Logo ${business ? business.toUpperCase() : "Business"}`}
                width={40}
                height={40}
                className="h-full w-full object-cover"
                unoptimized
                onError={() => setFailedLogoUrl(businessLogoUrl)}
              />
            ) : (
              <Store className="h-5 w-5" />
            )}
          </div>
          <div className="leading-tight">
            <div className="font-extrabold text-slate-900 text-base">
              {business ? business.toUpperCase() : "POS"}
            </div>
            <div className="text-xs text-slate-500">{t("tagline")}</div>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="min-h-0 flex-1 overflow-y-auto py-3">
        {user?.is_platform_admin === true ? (
          <div className="px-4 pb-3">
            <Link href="/platform/dashboard" className="flex items-center gap-2 rounded-xl bg-[#0a4d8f] px-3 py-3 text-sm font-semibold text-white hover:bg-[#083a6d]">
              <ShieldCheck className="h-4 w-4" /> Super Admin NovaGest
            </Link>
          </div>
        ) : null}
        {visibleReferenceGroups.length > 0 ? (
          <nav aria-label={t("reference.quick_navigation")} className="space-y-3 px-4 pb-4">
            {visibleReferenceGroups.map(group => (
              <section key={group.titleKey}>
                <h2 className="px-3 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  {t(`reference.${group.titleKey}`)}
                </h2>
                {group.titleKey === "hotel_services" ? (
                  <CollapsibleNavMenu key={business} title={t("reference.hotel")} icon={BedDouble} defaultOpen={isActiveGroup(group.items)}>
                    {renderNavLinks(group.items)}
                  </CollapsibleNavMenu>
                ) : group.titleKey === "system" ? (
                  <CollapsibleNavMenu key={business} title={t("reference.general_settings")} icon={Settings} defaultOpen={isActiveGroup(settingsItems)}>
                    {renderNavLinks(generalSettingsItems)}
                    {settingsGroups.map((settingsGroup) => (
                      <CollapsibleNavMenu key={settingsGroup.titleKey} title={t(settingsGroup.titleKey)} icon={settingsGroup.icon} defaultOpen={isActiveGroup(settingsGroup.items)}>
                        {renderNavLinks(settingsGroup.items)}
                      </CollapsibleNavMenu>
                    ))}
                  </CollapsibleNavMenu>
                ) : (
                  <div className="space-y-0.5">
                    {renderNavLinks(group.items)}
                    {group.titleKey === "management" && visibleExpenseAdmin.length > 0 ? (
                      <CollapsibleNavMenu key={business} title={t("section_expenses")} icon={Receipt} defaultOpen={isActiveGroup(visibleExpenseAdmin)}>
                        {renderNavLinks(visibleExpenseAdmin)}
                      </CollapsibleNavMenu>
                    ) : null}
                    {group.titleKey === "primary" && visibleQuickOrders.length > 0 ? (
                      <CollapsibleNavMenu key={business} title={t("section_orders")} icon={ClipboardList} defaultOpen={isActiveGroup(visibleQuickOrders)}>
                        {renderNavLinks(visibleQuickOrders)}
                      </CollapsibleNavMenu>
                    ) : null}
                    {group.titleKey === "primary" ? renderNavLinks(visiblePool) : null}
                  </div>
                )}
              </section>
            ))}
          </nav>
        ) : null}

      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-slate-200/70 p-3 text-xs text-slate-500">
        <div className="flex items-center justify-between">
          <span>{t("footer_brand")}</span>
          <span className="font-semibold text-[#0d63b8]">v1</span>
        </div>
      </div>
    </div>
  );
}
