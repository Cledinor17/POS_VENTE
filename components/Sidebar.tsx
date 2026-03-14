"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { logout } from "../lib/authApi";
import { getBusinessSettings } from "../lib/businessApi";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
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
} from "lucide-react";

type NavItem = {
  label: string;
  href: (b: string) => string;
  icon?: any;
  badge?: string;
  exact?: boolean;
  permissions?: BusinessPermission | BusinessPermission[];
};

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function normalizeHrefPath(href: string): string {
  return href.split(/[?#]/, 1)[0] || href;
}

function NavLink({ item, business }: { item: NavItem; business: string }) {
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

      <span className="font-medium">{item.label}</span>

      {item.badge ? (
        <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-[#f59e0b] text-white">
          {item.badge}
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
  icon: any;
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
  icon?: any;
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
const router = useRouter();
const { user, activeBusiness, businesses, permissions: fallbackPermissions, clear } = useAuth();

async function handleLogout() {
  try {
    await logout();
  } finally {
    clear();              // <-- important
    router.replace("/login");
  }
}
  const params = useParams<{ business: string }>();
  const pathname = usePathname();
  const business = params?.business || "";
  const [businessLogoUrl, setBusinessLogoUrl] = useState("");
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);

  const currentBusinessEntry = useMemo(
    () => businesses.find((item: any) => item?.slug === business) ?? activeBusiness ?? null,
    [activeBusiness, businesses, business],
  );
  const role =
    (currentBusinessEntry as any)?.pivot?.role ??
    (activeBusiness as any)?.pivot?.role ??
    (activeBusiness as any)?.role ??
    null;
  const currentPermissions = useMemo(() => {
    const scoped = (currentBusinessEntry as any)?.pivot?.permissions;
    if (Array.isArray(scoped)) {
      return scoped.filter((value: unknown): value is string => typeof value === "string");
    }
    return fallbackPermissions;
  }, [currentBusinessEntry, fallbackPermissions]);

  useEffect(() => {
    setLogoLoadFailed(false);

    if (!business) {
      setBusinessLogoUrl("");
      return;
    }

    let mounted = true;

    async function loadBusinessLogo() {
      try {
        const data = await getBusinessSettings(business);
        if (!mounted) return;

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

  // Menu POS (complet + groupÃ©)
  const dashboard: NavItem[] = [
    {
      label: "Tableau de bord",
      href: (b) => `/${b}/hotel/dashboard`,
      icon: LayoutDashboard,
      permissions: "dashboard.read",
    },
  ];

  const billing: NavItem[] = [
    {
      label: "Nouvelle vente (POS)",
      href: (b) => `/${b}/pos`,
      icon: ShoppingCart,
      badge: "Rapide",
      permissions: "billing.manage",
    },
    { label: "Tickets / Ventes", href: (b) => `/${b}/sales`, icon: Receipt, permissions: "billing.read" },
    { label: "Devis & proforma", href: (b) => `/${b}/documents`, icon: FileText, permissions: "billing.read" },
    { label: "Factures", href: (b) => `/${b}/invoices`, icon: Receipt, permissions: "billing.read" },
  ];

  const billingOrders: NavItem[] = [
    {
      label: "Commandes hotel",
      href: (b) => `/${b}/hotel/orders`,
      icon: Receipt,
      permissions: "hotel.orders.read",
    },
  ];

  const guests: NavItem[] = [
    { label: "Clients", href: (b) => `/${b}/customers`, icon: Users, permissions: "customers.read" },
  ];

  const staffAdmin: NavItem[] = [
    { label: "Utilisateurs", href: (b) => `/${b}/users`, icon: User, permissions: "users.read" },
    { label: "Employes", href: (b) => `/${b}/employees`, icon: Users, permissions: "users.read" },
  ];

  const businessAdmin: NavItem[] = [
    { label: "Mon entreprise", href: (b) => `/${b}/business`, icon: Building2, permissions: "business.read" },
    { label: "Parametres generaux", href: (b) => `/${b}/settings`, icon: Settings, permissions: "business.read" },
    { label: "Audit et securite", href: (b) => `/${b}/audit`, icon: ShieldCheck, permissions: "audit.read" },
  ];

  const expenseAdmin: NavItem[] = [
    {
      label: "Journal des depenses",
      href: (b) => `/${b}/expenses`,
      icon: Receipt,
      exact: true,
      permissions: "expenses.read",
    },
    {
      label: "Categories de depenses",
      href: (b) => `/${b}/expenses/categories`,
      icon: Layers,
      exact: true,
      permissions: "expenses.manage",
    },
  ];

  const financeAdmin: NavItem[] = [
    { label: "Comptabilite", href: (b) => `/${b}/accounting`, icon: Landmark, permissions: "accounting.read" },
    { label: "Periodes comptables", href: (b) => `/${b}/accounting/periods`, icon: CalendarDays, permissions: "accounting.read" },
  ];

  const reportsAdmin: NavItem[] = [
    { label: "Rapports de vente", href: (b) => `/${b}/reports/sales`, icon: BarChart3, permissions: "reports.read" },
    { label: "Rapports de stock", href: (b) => `/${b}/reports/inventory`, icon: BarChart3, permissions: "reports.read" },
    { label: "Creances clients (AR)", href: (b) => `/${b}/reports/ar`, icon: Receipt, permissions: "reports.read" },
    { label: "Bilan et resultat", href: (b) => `/${b}/reports/finance`, icon: Landmark, permissions: "reports.read" },
  ];

  const hotelRoomSetup: NavItem[] = [
    { label: "Planning", href: (b) => `/${b}/hotel/planning`, icon: CalendarDays, permissions: "room_setup.read" },
    { label: "Categories de chambres", href: (b) => `/${b}/hotel/categories`, icon: Layers, permissions: "room_setup.read" },
    { label: "Chambres", href: (b) => `/${b}/hotel/rooms`, icon: BedDouble, permissions: "room_setup.read" },
  ];

  const hotelOperations: NavItem[] = [
    { label: "Reservations", href: (b) => `/${b}/hotel/reservations`, icon: CalendarRange, permissions: "reservations.read" },
    { label: "Moments (2h)", href: (b) => `/${b}/hotel/moments`, icon: Clock3, permissions: "moments.read" },
    { label: "Housekeeping", href: (b) => `/${b}/hotel/housekeeping`, icon: Sparkles, permissions: "housekeeping.read" },
    { label: "Audit de nuit", href: (b) => `/${b}/hotel/night-audit`, icon: BarChart3, permissions: "reports.read" },
  ];

  const supplies: NavItem[] = [
    { label: "Accessoires", href: (b) => `/${b}/hotel/amenities`, icon: Sparkles, permissions: "supplies.read" },
    { label: "Necessaires", href: (b) => `/${b}/hotel/necessities`, icon: PackageOpen, permissions: "supplies.read" },
    { label: "Catalogue produits", href: (b) => `/${b}/products`, icon: Package, permissions: "supplies.read" },
    { label: "Categories", href: (b) => `/${b}/categories`, icon: Tags, permissions: "supplies.read" },
    { label: "Stock et inventaire", href: (b) => `/${b}/inventory`, icon: Warehouse, permissions: "inventory.read" },
    { label: "Fournisseurs", href: (b) => `/${b}/suppliers`, icon: Truck, permissions: "supplies.read" },
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

  const visibleDashboard = visibleItems(dashboard);
  const visibleBilling = visibleItems(billing);
  const visibleBillingOrders = visibleItems(billingOrders);
  const visibleGuests = visibleItems(guests);
  const visibleHotelOperations = visibleItems(hotelOperations);
  const visibleSupplies = visibleItems(supplies);
  const visibleStaffAdmin = visibleItems(staffAdmin);
  const visibleHotelRoomSetup = visibleItems(hotelRoomSetup);
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
            {businessLogoUrl && !logoLoadFailed ? (
              <img
                src={businessLogoUrl}
                alt={`Logo ${business ? business.toUpperCase() : "Business"}`}
                className="h-full w-full object-cover"
                onError={() => setLogoLoadFailed(true)}
              />
            ) : (
              <Store className="h-5 w-5" />
            )}
          </div>
          <div className="leading-tight">
            <div className="font-extrabold text-slate-900 text-base">
              {business ? business.toUpperCase() : "POS"}
            </div>
            <div className="text-xs text-slate-500">Bon retour ðŸ‘‹ On vend, on encaisse, on avance.</div>
          
  {/* ConnectÃ© en tant que
  <div className="font-semibold text-slate-900">
    {user?.name ?? "Utilisateur"}
  </div>
  {user?.email ? (
    <div className="text-xs text-slate-500 truncate">{user.email}</div>
  ) : null}
  {role ? (
    <div className="mt-1 inline-flex text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
      RÃ´le : {String(role)}
    </div>
  ) : null} */}

            
          </div>
          
        </div>
      </div>

      {/* Menu */}
      <div className="flex-1 overflow-y-auto py-3">
        <div className="px-2 space-y-3">
          {/* AccÃ¨s rapide */}
          {visibleDashboard.length > 0 ? (
            <div className="space-y-1 px-2">
              {visibleDashboard.map((it) => (
                <NavLink key={it.label} item={it} business={business} />
              ))}
            </div>
          ) : null}

          {visibleBilling.length > 0 || visibleBillingOrders.length > 0 ? (
            <Section
              title="Facturation (bar/piscine)"
              icon={Receipt}
              defaultOpen={isActiveGroup(billing) || isActiveGroup(billingOrders)}
            >
              {visibleBilling.map((it) => (
                <NavLink key={it.label} item={it} business={business} />
              ))}
              {visibleBillingOrders.length > 0 ? (
                <SubSection title="Commandes" icon={Receipt} defaultOpen={isActiveGroup(billingOrders)}>
                  {visibleBillingOrders.map((it) => (
                    <NavLink key={it.label} item={it} business={business} />
                  ))}
                </SubSection>
              ) : null}
            </Section>
          ) : null}

          {visibleGuests.length > 0 ? (
            <Section title="Clients" icon={Users} defaultOpen={isActiveGroup(guests)}>
              {visibleGuests.map((it) => (
                <NavLink key={it.label} item={it} business={business} />
              ))}
            </Section>
          ) : null}

          {visibleHotelOperations.length > 0 ? (
            <Section
              title="Reservations et services"
              icon={BedDouble}
              defaultOpen={isActiveGroup(hotelOperations)}
            >
              {visibleHotelOperations.map((it) => (
                <NavLink key={it.label} item={it} business={business} />
              ))}
            </Section>
          ) : null}

          {visibleSupplies.length > 0 ? (
            <Section title="Stocks et achats" icon={Package} defaultOpen={isActiveGroup(supplies)}>
              {visibleSupplies.map((it) => (
                <NavLink key={it.label} item={it} business={business} />
              ))}
            </Section>
          ) : null}

          {visibleStaffAdmin.length > 0 ||
          visibleHotelRoomSetup.length > 0 ||
          visibleBusinessAdmin.length > 0 ||
          visibleExpenseAdmin.length > 0 ||
          visibleFinanceAdmin.length > 0 ||
          visibleReportsAdmin.length > 0 ? (
            <Section
              title="Administration"
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
                <SubSection
                  title="Equipe"
                  icon={Users}
                  defaultOpen={isActiveGroup(staffAdmin)}
                >
                  {visibleStaffAdmin.map((it) => (
                    <NavLink key={it.label} item={it} business={business} />
                  ))}
                </SubSection>
              ) : null}
              {visibleHotelRoomSetup.length > 0 ? (
                <SubSection
                  title="Parametrage hotel"
                  icon={Layers}
                  defaultOpen={isActiveGroup(hotelRoomSetup)}
                >
                  {visibleHotelRoomSetup.map((it) => (
                    <NavLink key={it.label} item={it} business={business} />
                  ))}
                </SubSection>
              ) : null}
              {visibleBusinessAdmin.length > 0 ? (
                <SubSection
                  title="Entreprise"
                  icon={Building2}
                  defaultOpen={isActiveGroup(businessAdmin)}
                >
                  {visibleBusinessAdmin.map((it) => (
                    <NavLink key={it.label} item={it} business={business} />
                  ))}
                </SubSection>
              ) : null}
              {visibleExpenseAdmin.length > 0 || visibleFinanceAdmin.length > 0 ? (
                <SubSection
                  title="Finance"
                  icon={Landmark}
                  defaultOpen={isActiveGroup(expenseAdmin) || isActiveGroup(financeAdmin)}
                >
                  {visibleExpenseAdmin.length > 0 ? (
                    <SubSection
                      title="Depenses"
                      icon={Receipt}
                      defaultOpen={isActiveGroup(expenseAdmin)}
                    >
                      {visibleExpenseAdmin.map((it) => (
                        <NavLink key={it.label} item={it} business={business} />
                      ))}
                    </SubSection>
                  ) : null}
                  {visibleFinanceAdmin.map((it) => (
                    <NavLink key={it.label} item={it} business={business} />
                  ))}
                </SubSection>
              ) : null}
              {visibleReportsAdmin.length > 0 ? (
                <SubSection
                  title="Rapports"
                  icon={BarChart3}
                  defaultOpen={isActiveGroup(reportsAdmin)}
                >
                  {visibleReportsAdmin.map((it) => (
                    <NavLink key={it.label} item={it} business={business} />
                  ))}
                </SubSection>
              ) : null}
            </Section>
          ) : null}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 text-xs text-slate-500">
        <div className="flex items-center justify-between">
          <span>POS System</span>
          <span className="font-semibold text-[#0d63b8]">v1</span>
        </div>
      </div>
    </div>
  );
}
