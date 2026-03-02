"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { RequireAuth } from "./RequireAuth";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { logout } from "../lib/authApi";
import { useAuth } from "../context/AuthContext";
import { ChevronDown, Menu, ShoppingCart, X } from "lucide-react";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "U";
}

export default function BusinessShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ business: string }>();
  const business = params?.business || "";

  const { user, clear } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false);
  const [mobileAvatarLoadFailed, setMobileAvatarLoadFailed] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [desktopSidebarReady, setDesktopSidebarReady] = useState(false);
  const [posCartCount, setPosCartCount] = useState(0);

  const title = useMemo(() => (business ? business.toUpperCase() : "POS"), [business]);
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
    const saved = window.localStorage.getItem("pos_desktop_sidebar_open");
    if (saved === "0") {
      setDesktopSidebarOpen(false);
    }
    setDesktopSidebarReady(true);
  }, []);

  useEffect(() => {
    if (!desktopSidebarReady || typeof window === "undefined") return;
    window.localStorage.setItem("pos_desktop_sidebar_open", desktopSidebarOpen ? "1" : "0");
  }, [desktopSidebarReady, desktopSidebarOpen]);

  useEffect(() => {
    if (typeof window === "undefined" || !business) return;
    const storageKey = `pos_cart_count:${business}`;

    const readCartCount = () => {
      const raw = window.localStorage.getItem(storageKey);
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
                <div className="font-bold text-slate-900">Navigation</div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-2 rounded-xl transition-colors hover:bg-blue-50"
                  aria-label="Fermer le menu"
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
                  🚪 Déconnexion
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
              userName={user?.name ?? "Utilisateur"}
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
            <div className="h-14 px-3 flex items-center justify-between">
              <button
                onClick={() => setMobileOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white transition-colors hover:border-blue-200 hover:bg-orange-50"
                aria-label="Ouvrir le menu"
              >
                <Menu className="h-5 w-5" />
                <span className="text-sm font-semibold">Menu</span>
              </button>

              <div className="text-right leading-tight">
                <div className="text-sm font-bold text-slate-900">{title}</div>
                <div className="text-[11px] text-slate-500">
                  {user?.name ? `👋 ${user.name}` : "Caisse prête ✅"}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isPosRoute ? (
                  <button
                    onClick={scrollToPosCart}
                    className="relative inline-flex items-center justify-center px-2 py-2 rounded-xl border border-slate-200 bg-white transition-colors hover:border-blue-200 hover:bg-orange-50"
                    aria-label="Voir le panier"
                    title="Voir le panier"
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
                    aria-label="Ouvrir le profil"
                  >
                    {userAvatarUrl && !mobileAvatarLoadFailed ? (
                      <img
                        src={userAvatarUrl}
                        alt={`Avatar ${user?.name ?? "Utilisateur"}`}
                        className="h-7 w-7 rounded-full border border-slate-200 bg-white object-cover"
                        onError={() => setMobileAvatarLoadFailed(true)}
                      />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#0d63b8] to-[#f59e0b] text-white flex items-center justify-center text-[11px] font-bold">
                        {initials(user?.name ?? "Utilisateur")}
                      </div>
                    )}

                    <span className="max-w-[84px] truncate text-xs font-semibold text-slate-700">
                      {user?.name ?? "Utilisateur"}
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
                          {user?.name ?? "Utilisateur"}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {user?.email ?? ""}
                        </div>
                      </div>

                      <div className="p-1.5 space-y-1">
                        <button
                          onClick={() => {
                            setMobileProfileOpen(false);
                            void handleLogout();
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-50 text-red-600 text-sm font-semibold"
                        >
                          Déconnexion
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </header>

          {/* Page */}
          <div className="min-h-screen p-4 md:p-6 overflow-y-auto">{children}</div>
        </main>
      </div>
    </RequireAuth>
  );
}
