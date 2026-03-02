"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { logout } from "../lib/authApi";
import { getBusinessSettings } from "../lib/businessApi";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { useParams, usePathname } from "next/navigation";
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
} from "lucide-react";

type NavItem = { label: string; href: (b: string) => string; icon?: any; badge?: string };

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function NavLink({ item, business }: { item: NavItem; business: string }) {
  const pathname = usePathname();
  const href = item.href(business);
  const active = pathname === href || pathname?.startsWith(href + "/");

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
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);

  return (
    <details
      className="group"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="list-none cursor-pointer select-none flex items-center gap-2 px-2 py-2 text-xs font-semibold text-slate-500 transition-colors hover:text-[#0d63b8]">
        <Icon className="h-4 w-4 text-slate-400 transition-colors group-hover:text-[#f59e0b]" />
        <span className="uppercase tracking-wide">{title}</span>
        <ChevronDown className="ml-auto h-4 w-4 text-slate-400 transition group-open:rotate-180 group-hover:text-[#0d63b8]" />
      </summary>
      <div className="space-y-1 px-2 pb-2">{children}</div>
    </details>
  );
}

export default function Sidebar() {
const router = useRouter();
const { user, activeBusiness, clear } = useAuth();

// rôle (pivot.role) si dispo
const role =
  (activeBusiness as any)?.pivot?.role ??
  (activeBusiness as any)?.role ??
  null;

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

  // Menu POS (complet + groupé)
  const dashboard: NavItem[] = [
    { label: "Tableau de bord", href: (b) => `/${b}/dashboard`, icon: LayoutDashboard },
  ];

  const sales: NavItem[] = [
    { label: "Nouvelle vente (POS)", href: (b) => `/${b}/pos`, icon: ShoppingCart, badge: "Rapide" },
    { label: "Tickets / Ventes", href: (b) => `/${b}/sales`, icon: Receipt },
  ];

  const products: NavItem[] = [
    { label: "Catalogue produits", href: (b) => `/${b}/products`, icon: Package },
    { label: "Catégories", href: (b) => `/${b}/categories`, icon: Tags },
    { label: "Stock & Inventaire", href: (b) => `/${b}/inventory`, icon: Warehouse },
  ];

  const people: NavItem[] = [
    { label: "Clients", href: (b) => `/${b}/customers`, icon: Users },
    { label: "Fournisseurs", href: (b) => `/${b}/suppliers`, icon: Truck },
  ];

  const docs: NavItem[] = [
    { label: "Devis / Documents", href: (b) => `/${b}/documents`, icon: FileText },
    { label: "Factures", href: (b) => `/${b}/invoices`, icon: Receipt },
  ];

  const finance: NavItem[] = [
    { label: "Comptabilité", href: (b) => `/${b}/accounting`, icon: Landmark },
    { label: "Périodes comptables", href: (b) => `/${b}/accounting/periods`, icon: CalendarDays },
  ];

  const reports: NavItem[] = [
    { label: "Rapports ventes", href: (b) => `/${b}/reports/sales`, icon: BarChart3 },
    { label: "Rapports stock", href: (b) => `/${b}/reports/inventory`, icon: Warehouse },
    { label: "Créances clients (AR)", href: (b) => `/${b}/reports/ar`, icon: Receipt },
    { label: "Bilan & Résultat", href: (b) => `/${b}/reports/finance`, icon: Landmark },
  ];

  const admin: NavItem[] = [
    { label: "MY Business", href: (b) => `/${b}/business`, icon: Building2 },
    { label: "Utilisateurs", href: (b) => `/${b}/users`, icon: Users },
    { label: "Employes", href: (b) => `/${b}/employees`, icon: User },
    { label: "Parametres", href: (b) => `/${b}/settings`, icon: Settings },
    { label: "Audit & Sécurité", href: (b) => `/${b}/audit`, icon: ShieldCheck },
  ];

  function isActiveItem(item: NavItem): boolean {
    const href = item.href(business);
    return pathname === href || pathname?.startsWith(`${href}/`);
  }

  function isActiveGroup(items: NavItem[]): boolean {
    return items.some(isActiveItem);
  }

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
            <div className="text-xs text-slate-500">Bon retour 👋 On vend, on encaisse, on avance.</div>
          
  {/* Connecté en tant que
  <div className="font-semibold text-slate-900">
    {user?.name ?? "Utilisateur"}
  </div>
  {user?.email ? (
    <div className="text-xs text-slate-500 truncate">{user.email}</div>
  ) : null}
  {role ? (
    <div className="mt-1 inline-flex text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
      Rôle : {String(role)}
    </div>
  ) : null} */}

            
          </div>
          
        </div>
      </div>

      {/* Menu */}
      <div className="flex-1 overflow-y-auto py-3">
        <div className="px-2 space-y-3">
          {/* Accès rapide */}
          <div className="space-y-1 px-2">
            {dashboard.map((it) => (
              <NavLink key={it.label} item={it} business={business} />
            ))}
          </div>

          <Section title="Ventes" icon={ShoppingCart} defaultOpen={isActiveGroup(sales)}>
            {sales.map((it) => (
              <NavLink key={it.label} item={it} business={business} />
            ))}
          </Section>

          <Section title="Produits" icon={Package} defaultOpen={isActiveGroup(products)}>
            {products.map((it) => (
              <NavLink key={it.label} item={it} business={business} />
            ))}
          </Section>

          <Section
            title="Clients & Fournisseurs"
            icon={Users}
            defaultOpen={isActiveGroup(people)}
          >
            {people.map((it) => (
              <NavLink key={it.label} item={it} business={business} />
            ))}
          </Section>

          <Section title="Documents" icon={FileText} defaultOpen={isActiveGroup(docs)}>
            {docs.map((it) => (
              <NavLink key={it.label} item={it} business={business} />
            ))}
          </Section>

          <Section title="Finance" icon={Landmark} defaultOpen={isActiveGroup(finance)}>
            {finance.map((it) => (
              <NavLink key={it.label} item={it} business={business} />
            ))}
          </Section>

          <Section title="Rapports" icon={BarChart3} defaultOpen={isActiveGroup(reports)}>
            {reports.map((it) => (
              <NavLink key={it.label} item={it} business={business} />
            ))}
          </Section>

          <Section title="Administration" icon={Settings} defaultOpen={isActiveGroup(admin)}>
            {admin.map((it) => (
              <NavLink key={it.label} item={it} business={business} />
            ))}
          </Section>
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

