"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { getBusinessSettings } from "../lib/businessApi";
import { useAuth } from "../context/AuthContext";
import { useParams, usePathname } from "next/navigation";
import { hasPermission, type BusinessPermission } from "../lib/businessAccess";
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Package,
  Tags,
  Warehouse,
  Users,
  User,
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
  KeyRound,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  labelKey: string;
  href: (b: string) => string;
  icon?: LucideIcon;
  badgeKey?: string;
  exact?: boolean;
  permissions?: BusinessPermission | BusinessPermission[];
};

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function normalizeHrefPath(href: string): string {
  return href.split(/[?#]/, 1)[0] || href;
}

function NavLink({ item, business, label, badge }: { item: NavItem; business: string; label: string; badge?: string }) {
  const pathname = usePathname();
  const href = item.href(business);
  const hrefPath = normalizeHrefPath(href);
  const active = item.exact
    ? pathname === hrefPath
    : pathname === hrefPath || pathname?.startsWith(hrefPath + "/");

  const Icon = item.icon;

  return (
    <Link
      href={href}
      className={cx(
        "group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-all duration-200 hover:translate-x-0.5",
        active
          ? "bg-[#0a4d8f] text-white border-[#083a6d] shadow-md"
          : "border-transparent text-slate-700 hover:border-[#0a4d8f] hover:bg-[#0d63b8] hover:text-white hover:shadow-sm"
      )}
    >
      {Icon ? (
        <Icon
          className={cx(
            "h-4 w-4 transition-colors",
            active ? "text-white" : "text-slate-500 group-hover:text-orange-200"
          )}
        />
      ) : null}

      <span className="font-medium">{label}</span>

      {badge ? (
        <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-[#f59e0b] text-white">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function Section({
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
  const [interactiveOpen, setInteractiveOpen] = useState(false);
  const open = defaultOpen || interactiveOpen;

  return (
    <div
      className="group"
      onMouseEnter={() => setInteractiveOpen(true)}
      onMouseLeave={() => setInteractiveOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          if (defaultOpen) return;
          setInteractiveOpen((prev) => !prev);
        }}
        className="flex w-full items-center gap-2 px-2 py-2 text-xs font-semibold text-slate-500 transition-colors hover:text-[#0d63b8]"
      >
        <Icon className="h-4 w-4 text-slate-400 transition-colors group-hover:text-[#f59e0b]" />
        <span className="uppercase tracking-wide">{title}</span>
        <ChevronDown
          className={cx(
            "ml-auto h-4 w-4 text-slate-400 transition-transform duration-200 group-hover:text-[#0d63b8]",
            open && "rotate-180"
          )}
        />
      </button>
      <div
        className={cx(
          "grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-1 px-2 pb-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

function SubSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [interactiveOpen, setInteractiveOpen] = useState(false);
  const open = defaultOpen || interactiveOpen;

  return (
    <div
      className="group pl-2"
      onMouseEnter={() => setInteractiveOpen(true)}
      onMouseLeave={() => setInteractiveOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          if (defaultOpen) return;
          setInteractiveOpen((prev) => !prev);
        }}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:text-[#0d63b8]"
      >
        {Icon ? (
          <Icon className="h-4 w-4 text-slate-400 transition-colors group-hover:text-[#f59e0b]" />
        ) : null}
        <span>{title}</span>
        <ChevronDown
          className={cx(
            "ml-auto h-4 w-4 text-slate-400 transition-transform duration-200 group-hover:text-[#0d63b8]",
            open && "rotate-180"
          )}
        />
      </button>
      <div
        className={cx(
          "grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-1 space-y-1 pl-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const t = useTranslations("nav");
  const { activeBusiness, businesses, permissions: fallbackPermissions } = useAuth();
  const params = useParams<{ business: string }>();
  const pathname = usePathname();
  const business = params?.business || "";
  const [businessLogoUrl, setBusinessLogoUrl] = useState("");
  const [failedLogoUrl, setFailedLogoUrl] = useState("");
  const [modules, setModules] = useState({
    hotel: false,
    restaurant: false,
    pool: false,
    services: false,
    moment: false,
  });

  const currentBusinessEntry = useMemo(
    () => businesses.find((item) => item.slug === business) ?? activeBusiness ?? null,
    [activeBusiness, businesses, business],
  );
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
      if (!business) {
        setBusinessLogoUrl("");
        return;
      }

      try {
        const data = await getBusinessSettings(business);
        if (!mounted) return;

        setModules({
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
    return () => {
      mounted = false;
    };
  }, [business]);

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

  const staffAdmin: NavItem[] = [
    { labelKey: "users", href: (b) => `/${b}/users`, icon: User, permissions: "users.read" },
    { labelKey: "roles", href: (b) => `/${b}/roles`, icon: KeyRound, permissions: "users.manage" },
    { labelKey: "employees", href: (b) => `/${b}/employees`, icon: Users, permissions: "users.read" },
  ];

  const businessAdmin: NavItem[] = [
    { labelKey: "my_business", href: (b) => `/${b}/business`, icon: Building2, permissions: "business.read" },
    { labelKey: "general_settings", href: (b) => `/${b}/settings`, icon: Settings, permissions: "business.read" },
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
    { labelKey: "accounting", href: (b) => `/${b}/accounting`, icon: Landmark, permissions: "accounting.read" },
    { labelKey: "accounting_periods", href: (b) => `/${b}/accounting/periods`, icon: CalendarDays, permissions: "accounting.read" },
    { labelKey: "payroll", href: (b) => `/${b}/payroll`, icon: Wallet, permissions: "users.read" },
    { labelKey: "bank_reconciliation", href: (b) => `/${b}/bank`, icon: Landmark, permissions: "accounting.read" },
  ];

  const reportsAdmin: NavItem[] = [
    { labelKey: "reports_departments", href: (b) => `/${b}/reports/departments`, icon: BarChart3, permissions: "reports.read" },
    { labelKey: "reports_sales", href: (b) => `/${b}/reports/sales`, icon: BarChart3, permissions: "reports.read" },
    { labelKey: "reports_inventory", href: (b) => `/${b}/reports/inventory`, icon: BarChart3, permissions: "reports.read" },
    { labelKey: "reports_ar", href: (b) => `/${b}/reports/ar`, icon: Receipt, permissions: "reports.read" },
    { labelKey: "reports_finance", href: (b) => `/${b}/reports/finance`, icon: Landmark, permissions: "reports.read" },
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
    { labelKey: "product_catalog", href: (b) => `/${b}/products`, icon: Package, permissions: "supplies.read" },
    { labelKey: "categories", href: (b) => `/${b}/categories`, icon: Tags, permissions: "supplies.read" },
    { labelKey: "inventory", href: (b) => `/${b}/inventory`, icon: Warehouse, permissions: "inventory.read" },
    { labelKey: "suppliers", href: (b) => `/${b}/suppliers`, icon: Truck, permissions: "supplies.read" },
    { labelKey: "purchase_orders", href: (b) => `/${b}/purchase-orders`, icon: ClipboardList, permissions: "supplies.read" },
  ];

  function visibleItems(items: NavItem[]): NavItem[] {
    return items.filter((item) => hasPermission(currentPermissions, item.permissions));
  }

  function isActiveItem(item: NavItem): boolean {
    const hrefPath = normalizeHrefPath(item.href(business));
    if (item.exact) {
      return pathname === hrefPath;
    }
    return pathname === hrefPath || pathname?.startsWith(`${hrefPath}/`);
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
        label={t(it.labelKey)}
        badge={it.badgeKey ? t(it.badgeKey) : undefined}
      />
    ));
  }

  const visibleDashboard = visibleItems(dashboard);
  const visibleBilling = visibleItems(billing);
  const visibleBillingOrders = modules.hotel ? visibleItems(billingOrders) : [];
  const visibleGuests = visibleItems(guests);
  const visibleHotelOperations = modules.hotel
    ? visibleItems(
        hotelOperations.filter((it) => {
          if (it.href("x").includes("/moments")) return modules.moment;
          return true;
        })
      )
    : [];
  const visibleRestaurant = modules.restaurant ? visibleItems(restaurantItems) : [];
  const visiblePool = modules.pool ? visibleItems(poolItems) : [];
  const visibleServices = modules.services ? visibleItems(servicesItems) : [];
  const visibleSupplies = visibleItems(
    supplies.filter((it) => {
      const href = it.href("x");
      if (href.includes("/hotel/amenities") || href.includes("/hotel/necessities")) return modules.hotel;
      return true;
    })
  );
  const visibleStaffAdmin = visibleItems(staffAdmin);
  const visibleHotelRoomSetup = modules.hotel ? visibleItems(hotelRoomSetup) : [];
  const visibleBusinessAdmin = visibleItems(businessAdmin);
  const visibleExpenseAdmin = visibleItems(expenseAdmin);
  const visibleFinanceAdmin = visibleItems(financeAdmin);
  const visibleReportsAdmin = visibleItems(reportsAdmin);
  return (
    <div className="h-full flex flex-col">
      {/* Header sidebar */}
      <div className="px-4 py-4">
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
      <div className="flex-1 overflow-y-auto py-3">
        <div className="px-2 space-y-3">
          {visibleDashboard.length > 0 ? (
            <div className="space-y-1 px-2">{renderNavLinks(visibleDashboard)}</div>
          ) : null}

          {visibleBilling.length > 0 || visibleBillingOrders.length > 0 ? (
            <Section
              title={t("section_billing")}
              icon={Receipt}
              defaultOpen={isActiveGroup(billing) || isActiveGroup(billingOrders)}
            >
              {renderNavLinks(visibleBilling)}
              {visibleBillingOrders.length > 0 ? (
                <SubSection title={t("section_orders")} icon={Receipt} defaultOpen={isActiveGroup(billingOrders)}>
                  {renderNavLinks(visibleBillingOrders)}
                </SubSection>
              ) : null}
            </Section>
          ) : null}

          {visibleGuests.length > 0 ? (
            <Section title={t("section_customers")} icon={Users} defaultOpen={isActiveGroup(guests)}>
              {renderNavLinks(visibleGuests)}
            </Section>
          ) : null}

          {visibleHotelOperations.length > 0 ? (
            <Section
              title={t("section_reservations_services")}
              icon={BedDouble}
              defaultOpen={isActiveGroup(hotelOperations)}
            >
              {renderNavLinks(visibleHotelOperations)}
            </Section>
          ) : null}

          {visibleRestaurant.length > 0 ? (
            <Section
              title={t("section_restaurant")}
              icon={UtensilsCrossed}
              defaultOpen={isActiveGroup(restaurantItems)}
            >
              {renderNavLinks(visibleRestaurant)}
            </Section>
          ) : null}

          {visiblePool.length > 0 ? (
            <Section title={t("section_pool")} icon={Waves} defaultOpen={isActiveGroup(poolItems)}>
              {renderNavLinks(visiblePool)}
            </Section>
          ) : null}

          {visibleServices.length > 0 ? (
            <Section title={t("section_services")} icon={Sparkles} defaultOpen={isActiveGroup(servicesItems)}>
              {renderNavLinks(visibleServices)}
            </Section>
          ) : null}

          {visibleSupplies.length > 0 ? (
            <Section title={t("section_stock_purchases")} icon={Package} defaultOpen={isActiveGroup(supplies)}>
              {renderNavLinks(visibleSupplies)}
            </Section>
          ) : null}

          {visibleStaffAdmin.length > 0 ||
          visibleHotelRoomSetup.length > 0 ||
          visibleBusinessAdmin.length > 0 ||
          visibleExpenseAdmin.length > 0 ||
          visibleFinanceAdmin.length > 0 ||
          visibleReportsAdmin.length > 0 ? (
            <Section
              title={t("section_admin")}
              icon={Settings}
              defaultOpen={
                isActiveGroup(staffAdmin) ||
                isActiveGroup(hotelRoomSetup) ||
                isActiveGroup(businessAdmin) ||
                isActiveGroup(expenseAdmin) ||
                isActiveGroup(financeAdmin) ||
                isActiveGroup(reportsAdmin)
              }
            >
              {visibleStaffAdmin.length > 0 ? (
                <SubSection title={t("section_team")} icon={Users} defaultOpen={isActiveGroup(staffAdmin)}>
                  {renderNavLinks(visibleStaffAdmin)}
                </SubSection>
              ) : null}
              {visibleHotelRoomSetup.length > 0 ? (
                <SubSection title={t("section_hotel_setup")} icon={Layers} defaultOpen={isActiveGroup(hotelRoomSetup)}>
                  {renderNavLinks(visibleHotelRoomSetup)}
                </SubSection>
              ) : null}
              {visibleBusinessAdmin.length > 0 ? (
                <SubSection title={t("section_company")} icon={Building2} defaultOpen={isActiveGroup(businessAdmin)}>
                  {renderNavLinks(visibleBusinessAdmin)}
                </SubSection>
              ) : null}
              {visibleExpenseAdmin.length > 0 || visibleFinanceAdmin.length > 0 ? (
                <SubSection
                  title={t("section_finance")}
                  icon={Landmark}
                  defaultOpen={isActiveGroup(expenseAdmin) || isActiveGroup(financeAdmin)}
                >
                  {visibleExpenseAdmin.length > 0 ? (
                    <SubSection title={t("section_expenses")} icon={Receipt} defaultOpen={isActiveGroup(expenseAdmin)}>
                      {renderNavLinks(visibleExpenseAdmin)}
                    </SubSection>
                  ) : null}
                  {renderNavLinks(visibleFinanceAdmin)}
                </SubSection>
              ) : null}
              {visibleReportsAdmin.length > 0 ? (
                <SubSection title={t("section_reports")} icon={BarChart3} defaultOpen={isActiveGroup(reportsAdmin)}>
                  {renderNavLinks(visibleReportsAdmin)}
                </SubSection>
              ) : null}
            </Section>
          ) : null}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 text-xs text-slate-500">
        <div className="flex items-center justify-between">
          <span>{t("footer_brand")}</span>
          <span className="font-semibold text-[#0d63b8]">v1</span>
        </div>
      </div>
    </div>
  );
}
