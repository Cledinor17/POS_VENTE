"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import BranchSwitcher from "./BranchSwitcher";
import { RequireAuth } from "./RequireAuth";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { logout } from "../lib/authApi";
import { useAuth } from "../context/AuthContext";
import { useBranch } from "../context/BranchContext";
import CurrentUserDailyReportModal from "./CurrentUserDailyReportModal";
import { ChevronDown, Menu, ShoppingCart, X } from "lucide-react";
import { safeGetItem, safeSetItem } from "../lib/safeStorage";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "U";
}

export default function BusinessShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("shell");
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ business: string }>();
  const business = params?.business || "";

  const { user, clear } = useAuth();
  const { branches } = useBranch();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false);
  const [mobileAvatarLoadFailed, setMobileAvatarLoadFailed] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [desktopSidebarReady, setDesktopSidebarReady] = useState(false);
  const [posCartCount, setPosCartCount] = useState(0);
  const [mobileDailyReportOpen, setMobileDailyReportOpen] = useState(false);

  const title = useMemo(() => (business ? business.toUpperCase() : "POS"), [business]);
  const hasMultipleBranches = useMemo(
    () => branches.filter((item) => item.isActive).length > 1,
    [branches],
  );
  const isPosRoute = useMemo(
    () => Boolean(pathname && business && pathname.startsWith(`/${business}/pos`)),
    [business, pathname],
  );
  const userAvatarUrl = useMemo(() => {
    const absolute = typeof user?.avatar_url === "string" ? user.avatar_url.trim() : "";
    if (absolute) return absolute;

    const path = typeof user?.avatar_path === "string" ? user.avatar_path.trim() : "";
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;

    const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
    const normalized = path.replace(/^\/+/, "");
    const relative = normalized.startsWith("storage/") ? normalized : `storage/${normalized}`;
    return base ? `${base}/${relative}` : `/${relative}`;
  }, [user]);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      clear();                 // ✅ important
      router.replace("/login");
    }
  }

  // Ferme le drawer mobile quand on change de page
  useEffect(() => {
    setMobileOpen(false);
    setMobileProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    setMobileAvatarLoadFailed(false);
  }, [userAvatarUrl]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = safeGetItem("pos_desktop_sidebar_open");
    if (saved === "0") {
      setDesktopSidebarOpen(false);
    }
    setDesktopSidebarReady(true);
  }, []);

  useEffect(() => {
    if (!desktopSidebarReady || typeof window === "undefined") return;
    safeSetItem("pos_desktop_sidebar_open", desktopSidebarOpen ? "1" : "0");
  }, [desktopSidebarReady, desktopSidebarOpen]);

  useEffect(() => {
    if (typeof window === "undefined" || !business) return;
    const storageKey = `pos_cart_count:${business}`;

    const readCartCount = () => {
      const raw = safeGetItem(storageKey);
      const parsed = Number(raw ?? "0");
      const nextCount = Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
      setPosCartCount(nextCount);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) readCartCount();
    };

    const handleCartChanged = (event: Event) => {
      const custom = event as CustomEvent<{ business?: string; count?: number }>;
      if (custom.detail?.business && custom.detail.business !== business) return;
      const parsed = Number(custom.detail?.count ?? 0);
      const nextCount = Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
      setPosCartCount(nextCount);
    };

    readCartCount();
    window.addEventListener("storage", handleStorage);
    window.addEventListener("pos-cart-count-changed", handleCartChanged as EventListener);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("pos-cart-count-changed", handleCartChanged as EventListener);
    };
  }, [business]);

  function scrollToPosCart() {
    document
      .getElementById("pos-cart-section")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <RequireAuth>
      <div className="min-h-screen app-shell-bg">
        {/* Sidebar FIXE (desktop) */}
        <aside
          className={`${desktopSidebarOpen ? "hidden md:block" : "hidden md:hidden"} fixed left-0 top-0 z-30 h-screen w-72 app-sidebar-surface`}
        >
          <Sidebar />
        </aside>

        {/* Drawer (mobile) */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <div className="absolute left-0 top-0 h-full w-80 app-sidebar-surface shadow-xl">
              <div className="h-14 px-3 flex items-center justify-between">
                <div className="font-bold text-slate-900">{t("navigation")}</div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-2 rounded-xl transition-colors hover:bg-blue-50"
                  aria-label={t("close_menu")}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <Sidebar />

              <div className="p-3">
                <button
                  onClick={handleLogout}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl brand-primary-btn py-2.5 font-semibold"
                >
                  {t("logout_emoji")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Contenu : décalé à droite sur desktop */}
        <main className={desktopSidebarOpen ? "md:pl-72" : "md:pl-0"}>
          {/* Topbar desktop (sticky) */}
          <div className="hidden md:block sticky top-0 z-20 app-topbar-surface backdrop-blur">
            <Topbar
              business={business}
              title={title}
              userName={user?.name ?? t("default_user")}
              userEmail={user?.email ?? ""}
              userAvatarUrl={userAvatarUrl}
              showSidebarToggle
              isSidebarOpen={desktopSidebarOpen}
              onToggleSidebar={() => setDesktopSidebarOpen((prev) => !prev)}
              showCartShortcut={isPosRoute}
              cartCount={posCartCount}
              onCartClick={scrollToPosCart}
              onLogout={handleLogout}
            />
          </div>

          {/* Topbar mobile */}
          <header className="md:hidden sticky top-0 z-40 app-topbar-surface">
            <div className="h-14 px-3 flex items-center justify-between gap-2">
              <button
                onClick={() => setMobileOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white transition-colors hover:border-blue-200 hover:bg-orange-50"
                aria-label={t("open_menu")}
              >
                <Menu className="h-5 w-5" />
                <span className="text-sm font-semibold">{t("menu")}</span>
              </button>

              <div className="text-right leading-tight">
                <div className="text-sm font-bold text-slate-900">{title}</div>
                <div className="text-[11px] text-slate-500">
                  {user?.name ? t("greeting", { name: user.name }) : t("cashier_ready")}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isPosRoute ? (
                  <button
                    onClick={scrollToPosCart}
                    className="relative inline-flex items-center justify-center px-2 py-2 rounded-xl border border-slate-200 bg-white transition-colors hover:border-blue-200 hover:bg-orange-50"
                    aria-label={t("view_cart")}
                    title={t("view_cart")}
                  >
                    <ShoppingCart className="h-4 w-4 text-slate-700" />
                    <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold inline-flex items-center justify-center">
                      {posCartCount}
                    </span>
                  </button>
                ) : null}

                <div className="relative">
                  <button
                    onClick={() => setMobileProfileOpen((prev) => !prev)}
                    className="inline-flex items-center gap-2 px-2 py-2 rounded-xl border border-slate-200 bg-white transition-colors hover:border-blue-200 hover:bg-orange-50"
                    aria-label={t("open_profile")}
                  >
                    {userAvatarUrl && !mobileAvatarLoadFailed ? (
                      <Image
                        src={userAvatarUrl}
                        alt={`Avatar ${user?.name ?? t("default_user")}`}
                        width={28}
                        height={28}
                        className="h-7 w-7 rounded-full border border-slate-200 bg-white object-cover"
                        unoptimized
                        onError={() => setMobileAvatarLoadFailed(true)}
                      />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#0d63b8] to-[#f59e0b] text-white flex items-center justify-center text-[11px] font-bold">
                        {initials(user?.name ?? t("default_user"))}
                      </div>
                    )}

                    <span className="max-w-[84px] truncate text-xs font-semibold text-slate-700">
                      {user?.name ?? t("default_user")}
                    </span>

                    <ChevronDown
                      className={`h-4 w-4 text-slate-500 transition-transform ${
                        mobileProfileOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {mobileProfileOpen ? (
                    <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden z-50">
                      <div className="px-3 py-2.5 border-b border-slate-100">
                        <div className="text-sm font-semibold text-slate-900">
                          {user?.name ?? t("default_user")}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {user?.email ?? ""}
                        </div>
                      </div>

                      <div className="p-1.5 space-y-1">
                        <button
                          onClick={() => {
                            setMobileProfileOpen(false);
                            setMobileDailyReportOpen(true);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-orange-50 text-slate-700 text-sm font-semibold"
                        >
                          {t("my_daily_report")}
                        </button>

                        <button
                          onClick={() => {
                            setMobileProfileOpen(false);
                            void handleLogout();
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-50 text-red-600 text-sm font-semibold"
                        >
                          {t("logout")}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {hasMultipleBranches ? (
              <div className="border-t border-slate-100 px-3 py-2">
                <BranchSwitcher />
              </div>
            ) : null}
          </header>

          {/* Page */}
          <div className="min-h-screen p-4 md:p-6 overflow-y-auto">{children}</div>
        </main>

        {mobileDailyReportOpen ? (
          <CurrentUserDailyReportModal
            business={business}
            userName={user?.name ?? t("default_user")}
            variant="mobile"
            onClose={() => setMobileDailyReportOpen(false)}
          />
        ) : null}
      </div>
    </RequireAuth>
  );
}
