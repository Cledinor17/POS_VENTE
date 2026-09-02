"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "../context/AuthContext";
import { useAppLocale } from "../context/LocaleContext";
import { updatePassword, updateAvatar } from "../lib/authApi";
import { getErrorMessage } from "../lib/errors";
import type { Locale } from "../lib/locale";
import BranchSwitcher from "./BranchSwitcher";
import CurrentUserDailyReportModal from "./CurrentUserDailyReportModal";
import LoginActivityModal from "./LoginActivityModal";
import NotificationBell from "./NotificationBell";
import { PanelLeftClose, PanelLeftOpen, ShoppingCart } from "lucide-react";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase()).join("") || "U";
}

const LANGUAGE_OPTIONS: Array<{ value: Locale; label: string }> = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
  { value: "ht", label: "Kreyòl ayisyen" },
  { value: "es", label: "Español" },
  { value: "zh", label: "中文" },
  { value: "ar", label: "العربية" },
];

export default function Topbar({
  business,
  title,
  userName,
  userEmail,
  userAvatarUrl,
  showSidebarToggle = false,
  isSidebarOpen = true,
  onToggleSidebar,
  showCartShortcut = false,
  cartCount = 0,
  onCartClick,
  onLogout,
}: {
  business: string;
  title: string;
  userName: string;
  userEmail: string;
  userAvatarUrl?: string;
  showSidebarToggle?: boolean;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  showCartShortcut?: boolean;
  cartCount?: number;
  onCartClick?: () => void;
  onLogout: () => void;
}) {
  const t = useTranslations("topbar");
  const router = useRouter();
  const { refresh, activeBusiness } = useAuth();

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);

  const [pwOpen, setPwOpen] = useState(false);
  const [avOpen, setAvOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [dailyReportOpen, setDailyReportOpen] = useState(false);
  const [loginActivityOpen, setLoginActivityOpen] = useState(false);

  const role = useMemo(() => {
    const r = activeBusiness?.pivot?.role ?? activeBusiness?.role ?? null;
    return r ? String(r) : "";
  }, [activeBusiness]);
  const profileAvatarUrl = userAvatarUrl || "";
  const showProfilePhoto = Boolean(profileAvatarUrl) && failedAvatarUrl !== profileAvatarUrl;

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    // Page de recherche (à créer quand tu veux)
    router.push(`/${business}/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <div className="h-16 px-6 flex items-center gap-4">
      {showSidebarToggle && onToggleSidebar ? (
        <button
          onClick={onToggleSidebar}
          className="inline-flex items-center justify-center p-2 rounded-xl border border-slate-200 bg-white transition-colors hover:border-blue-200 hover:bg-orange-50"
          aria-label={isSidebarOpen ? t("hide_menu") : t("show_menu")}
          title={isSidebarOpen ? t("hide_menu") : t("show_menu")}
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="h-4 w-4 text-slate-700" />
          ) : (
            <PanelLeftOpen className="h-4 w-4 text-slate-700" />
          )}
        </button>
      ) : null}

      <div className="min-w-[180px]">
        <div className="text-xs text-slate-500">{t("business_label")}</div>
        <div className="font-extrabold text-slate-900">{title}</div>
      </div>

      <BranchSwitcher />

      {/* Search */}
      <form onSubmit={onSearchSubmit} className="flex-1">
        <div className="relative">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search_placeholder")}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 outline-none transition focus:border-[#0d63b8] focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </form>

      {showCartShortcut ? (
        <button
          onClick={onCartClick}
          className="relative inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-orange-50"
          aria-label={t("view_cart")}
          title={t("view_cart")}
        >
          <ShoppingCart className="h-4 w-4 text-slate-700" />
          <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold inline-flex items-center justify-center">
            {cartCount}
          </span>
        </button>
      ) : null}

      <NotificationBell business={business} />

      {/* Profile */}
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-orange-50"
        >
          {showProfilePhoto ? (
            <Image
              src={profileAvatarUrl}
              alt={`Avatar ${userName}`}
              width={36}
              height={36}
              className="h-9 w-9 rounded-full border border-slate-200 bg-white object-cover"
              unoptimized
              onError={() => setFailedAvatarUrl(profileAvatarUrl)}
            />
          ) : (
            <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-[#0d63b8] to-[#f59e0b] text-white flex items-center justify-center font-bold">
              {initials(userName)}
            </div>
          )}
          <div className="text-left leading-tight hidden lg:block">
            <div className="text-sm font-bold text-slate-900">{userName}</div>
            <div className="text-[11px] text-slate-500 truncate max-w-[220px]">
              {role ? t("role_label", { role }) : userEmail}
            </div>
          </div>
          <span className="text-slate-500">▾</span>
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden z-50">
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="font-semibold text-slate-900">{userName}</div>
              <div className="text-xs text-slate-500 truncate">{userEmail}</div>
              {role ? <div className="text-xs text-[#0d63b8] font-semibold mt-1">{t("role_label", { role })}</div> : null}
            </div>

            <div className="p-2 space-y-1">
              <button
                onClick={() => {
                  setOpen(false);
                  setDailyReportOpen(true);
                }}
                className="w-full text-left px-3 py-2 rounded-xl transition-colors hover:bg-orange-50"
              >
                {t("my_daily_report")}
              </button>

              <button
                onClick={() => {
                  setOpen(false);
                  setAvOpen(true);
                }}
                className="w-full text-left px-3 py-2 rounded-xl transition-colors hover:bg-orange-50"
              >
                {t("update_avatar")}
              </button>

              <button
                onClick={() => {
                  setOpen(false);
                  setPwOpen(true);
                }}
                className="w-full text-left px-3 py-2 rounded-xl transition-colors hover:bg-orange-50"
              >
                {t("change_password")}
              </button>

              <button
                onClick={() => {
                  setOpen(false);
                  setLoginActivityOpen(true);
                }}
                className="w-full text-left px-3 py-2 rounded-xl transition-colors hover:bg-orange-50"
              >
                {t("login_activity")}
              </button>

              <button
                onClick={() => {
                  setOpen(false);
                  setLangOpen(true);
                }}
                className="w-full text-left px-3 py-2 rounded-xl transition-colors hover:bg-orange-50"
              >
                {t("language")}
              </button>

              <button
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-red-50 text-red-600 font-semibold"
              >
                {t("logout")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {pwOpen && (
        <ChangePasswordModal
          onClose={() => setPwOpen(false)}
          onSaved={async () => {
            await refresh();
          }}
        />
      )}

      {avOpen && (
        <AvatarModal
          onClose={() => setAvOpen(false)}
          userName={userName}
          currentAvatarUrl={userAvatarUrl}
          onSaved={async () => {
            await refresh();
          }}
        />
      )}

      {langOpen && <LanguageModal onClose={() => setLangOpen(false)} />}

      {loginActivityOpen && (
        <LoginActivityModal mode="self" onClose={() => setLoginActivityOpen(false)} />
      )}

      {dailyReportOpen && (
        <CurrentUserDailyReportModal
          business={business}
          userName={userName}
          variant="desktop"
          onClose={() => setDailyReportOpen(false)}
        />
      )}
    </div>
  );
}

/* ---------------- Modals ---------------- */

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="absolute z-[60] top-0 left-0 w-[100%] h-[100vh] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-[92%] max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="font-extrabold text-slate-900">{title}</div>
          <button onClick={onClose} className="p-2 rounded-xl transition-colors hover:bg-orange-50">
            ✖️
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function ChangePasswordModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const t = useTranslations("topbar.password_modal");
  const [current, setCurrent] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setErr("");
    if (pwd.length < 8) return setErr(t("too_short"));
    if (pwd !== confirm) return setErr(t("mismatch"));
    setLoading(true);
    try {
      await updatePassword(current, pwd, confirm);
      await onSaved();
      onClose();
    } catch (e: unknown) {
      setErr(getErrorMessage(e, t("generic_error")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell title={t("title")} onClose={onClose}>
      {err ? <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{err}</div> : null}

      <div className="space-y-3">
        <div>
          <label className="text-sm font-semibold text-slate-700">{t("current_label")}</label>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 outline-none transition focus:border-[#0d63b8] focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700">{t("new_label")}</label>
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 outline-none transition focus:border-[#0d63b8] focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700">{t("confirm_label")}</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 outline-none transition focus:border-[#0d63b8] focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <button
          onClick={submit}
          disabled={loading}
          className="w-full rounded-2xl brand-primary-btn py-3 font-bold disabled:opacity-60"
        >
          {loading ? t("submit_loading") : t("submit")}
        </button>
      </div>
    </ModalShell>
  );
}

function AvatarModal({
  onClose,
  userName,
  currentAvatarUrl,
  onSaved,
}: {
  onClose: () => void;
  userName: string;
  currentAvatarUrl?: string;
  onSaved: () => Promise<void>;
}) {
  const t = useTranslations("topbar.avatar_modal");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLoadFailed, setPreviewLoadFailed] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const previewSource = previewUrl || currentAvatarUrl || "";
  const showPreviewPhoto = Boolean(previewSource) && !previewLoadFailed;

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useEffect(() => {
    setPreviewLoadFailed(false);
  }, [previewUrl, currentAvatarUrl]);

  async function submit() {
    setErr("");
    if (!file) return setErr(t("no_file_selected"));
    setLoading(true);
    try {
      await updateAvatar(file);
      await onSaved();
      onClose();
    } catch (e: unknown) {
      setErr(getErrorMessage(e, t("generic_error")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell title={t("title")} onClose={onClose}>
      {err ? <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{err}</div> : null}

      <div className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold text-slate-600">{t("preview_label")}</div>
          <div className="mt-2 flex items-center gap-3">
            {showPreviewPhoto ? (
              <Image
                src={previewSource}
                alt={t("preview_label")}
                width={64}
                height={64}
                className="h-16 w-16 rounded-full border border-slate-200 bg-white object-cover"
                unoptimized
                onError={() => setPreviewLoadFailed(true)}
              />
            ) : (
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#0d63b8] to-[#f59e0b] text-white flex items-center justify-center text-lg font-bold">
                {initials(userName)}
              </div>
            )}
            <div className="text-sm text-slate-700">
              {file ? (
                <>
                  {t("file_prefix")} <span className="font-semibold">{file.name}</span>
                </>
              ) : (
                t("choose_hint")
              )}
            </div>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        <button
          onClick={() => fileRef.current?.click()}
          className="w-full rounded-2xl border border-orange-200 bg-orange-50 py-3 font-semibold text-orange-700 transition-colors hover:bg-orange-100"
        >
          {t("choose_button")}
        </button>

        <button
          onClick={submit}
          disabled={loading}
          className="w-full rounded-2xl brand-primary-btn py-3 font-bold disabled:opacity-60"
        >
          {loading ? t("submit_loading") : t("submit")}
        </button>
      </div>
    </ModalShell>
  );
}

function LanguageModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("topbar.language_modal");
  const { locale, setLocale } = useAppLocale();
  const [selected, setSelected] = useState<Locale>(locale);

  function submit() {
    setLocale(selected);
    onClose();
  }

  return (
    <ModalShell title={t("title")} onClose={onClose}>
      <div className="space-y-2">
        {LANGUAGE_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => setSelected(option.value)}
            className={`w-full flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
              selected === option.value
                ? "border-[#0d63b8] bg-blue-50 text-[#0d63b8] font-semibold"
                : "border-slate-200 hover:border-blue-200 hover:bg-orange-50"
            }`}
          >
            <span>{option.label}</span>
            {selected === option.value ? <span>✓</span> : null}
          </button>
        ))}

        <button
          onClick={submit}
          className="w-full rounded-2xl brand-primary-btn py-3 font-bold mt-2"
        >
          {t("submit")}
        </button>
      </div>
    </ModalShell>
  );
}
