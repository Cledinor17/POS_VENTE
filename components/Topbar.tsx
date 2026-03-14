"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { updatePassword, updateAvatar } from "../lib/authApi";
import { getCurrentUserDailyReport, type CurrentUserDailyReport } from "../lib/currentUserReportApi";
import CurrentUserDailyReportModal from "./CurrentUserDailyReportModal";
import { PanelLeftClose, PanelLeftOpen, ShoppingCart } from "lucide-react";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase()).join("") || "U";
}

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
  const router = useRouter();
  const { refresh, activeBusiness } = useAuth();

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  const [pwOpen, setPwOpen] = useState(false);
  const [avOpen, setAvOpen] = useState(false);
  const [dailyReportOpen, setDailyReportOpen] = useState(false);

  const role = useMemo(() => {
    const r = (activeBusiness as any)?.pivot?.role ?? (activeBusiness as any)?.role ?? null;
    return r ? String(r) : "";
  }, [activeBusiness]);
  const showProfilePhoto = Boolean(userAvatarUrl) && !avatarLoadFailed;

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [userAvatarUrl]);

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
          aria-label={isSidebarOpen ? "Masquer le menu" : "Afficher le menu"}
          title={isSidebarOpen ? "Masquer le menu" : "Afficher le menu"}
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="h-4 w-4 text-slate-700" />
          ) : (
            <PanelLeftOpen className="h-4 w-4 text-slate-700" />
          )}
        </button>
      ) : null}

      <div className="min-w-[180px]">
        <div className="text-xs text-slate-500">Business</div>
        <div className="font-extrabold text-slate-900">{title}</div>
      </div>

      {/* Search */}
      <form onSubmit={onSearchSubmit} className="flex-1">
        <div className="relative">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="🔎 Rechercher : produit, client, facture, ticket…"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 outline-none transition focus:border-[#0d63b8] focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </form>

      {showCartShortcut ? (
        <button
          onClick={onCartClick}
          className="relative inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-orange-50"
          aria-label="Voir le panier"
          title="Voir le panier"
        >
          <ShoppingCart className="h-4 w-4 text-slate-700" />
          <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold inline-flex items-center justify-center">
            {cartCount}
          </span>
        </button>
      ) : null}

      {/* Profile */}
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-orange-50"
        >
          {showProfilePhoto ? (
            <img
              src={userAvatarUrl}
              alt={`Avatar ${userName}`}
              className="h-9 w-9 rounded-full border border-slate-200 bg-white object-cover"
              onError={() => setAvatarLoadFailed(true)}
            />
          ) : (
            <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-[#0d63b8] to-[#f59e0b] text-white flex items-center justify-center font-bold">
              {initials(userName)}
            </div>
          )}
          <div className="text-left leading-tight hidden lg:block">
            <div className="text-sm font-bold text-slate-900">{userName}</div>
            <div className="text-[11px] text-slate-500 truncate max-w-[220px]">
              {role ? `Rôle: ${role}` : userEmail}
            </div>
          </div>
          <span className="text-slate-500">▾</span>
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden z-50">
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="font-semibold text-slate-900">{userName}</div>
              <div className="text-xs text-slate-500 truncate">{userEmail}</div>
              {role ? <div className="text-xs text-[#0d63b8] font-semibold mt-1">Rôle: {role}</div> : null}
            </div>

            <div className="p-2 space-y-1">
              <button
                onClick={() => {
                  setOpen(false);
                  setDailyReportOpen(true);
                }}
                className="w-full text-left px-3 py-2 rounded-xl transition-colors hover:bg-orange-50"
              >
                Mon rapport du jour
              </button>

              <button
                onClick={() => {
                  setOpen(false);
                  setAvOpen(true);
                }}
                className="w-full text-left px-3 py-2 rounded-xl transition-colors hover:bg-orange-50"
              >
                🖼️ Mettre à jour l’avatar
              </button>

              <button
                onClick={() => {
                  setOpen(false);
                  setPwOpen(true);
                }}
                className="w-full text-left px-3 py-2 rounded-xl transition-colors hover:bg-orange-50"
              >
                🔐 Changer le mot de passe
              </button>

              <button
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-red-50 text-red-600 font-semibold"
              >
                🚪 Déconnexion
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

function ModalShell({ title, onClose, children }: any) {
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

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency || "USD"}`;
  }
}

function formatDateTime(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function paymentMethodLabel(value: string | null) {
  switch ((value || "").toLowerCase()) {
    case "cash":
      return "Cash";
    case "card":
      return "Carte";
    case "bank":
      return "Banque";
    case "mobile":
    case "moncash":
      return "Mobile";
    case "other":
      return "Autre";
    default:
      return value || "-";
  }
}

function DailyReportModal({
  business,
  userName,
  onClose,
}: {
  business: string;
  userName: string;
  onClose: () => void;
}) {
  const [report, setReport] = useState<CurrentUserDailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!business) return;
      setLoading(true);
      setErr("");

      try {
        const next = await getCurrentUserDailyReport(business);
        if (!cancelled) {
          setReport(next);
        }
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.message ?? "Impossible de charger le rapport du jour.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [business]);

  const currency = report?.currency || "USD";
  const paymentMethods = report?.paymentMethods ?? {};

  return (
    <ModalShell title={`Mon rapport du jour - ${userName}`} onClose={onClose}>
      {err ? <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{err}</div> : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Chargement du rapport...
        </div>
      ) : report ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rapport du {report.date}</div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <div className="text-xs font-semibold text-emerald-700">Cash a remettre</div>
                <div className="mt-1 text-xl font-extrabold text-emerald-900">
                  {formatMoney(report.summary.cashToSubmit, currency)}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="text-xs font-semibold text-slate-500">Ventes du jour</div>
                <div className="mt-1 text-lg font-extrabold text-slate-900">
                  {formatMoney(report.summary.salesTotal, currency)}
                </div>
                <div className="text-xs text-slate-500">{report.summary.salesCount} operation(s)</div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="text-xs font-semibold text-slate-500">Encaissements du jour</div>
                <div className="mt-1 text-lg font-extrabold text-slate-900">
                  {formatMoney(report.summary.receiptsTotal, currency)}
                </div>
                <div className="text-xs text-slate-500">{report.summary.receiptsCount} encaissement(s)</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3">
              <div className="font-bold text-slate-900">Ventilation des encaissements</div>
              <div className="text-xs text-slate-500">Montants collectes aujourd&apos;hui par mode de paiement.</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {Object.entries(paymentMethods).map(([method, amount]) => (
                <div key={method} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-500">{paymentMethodLabel(method)}</div>
                  <div className="mt-1 font-extrabold text-slate-900">{formatMoney(amount, currency)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3">
              <div className="font-bold text-slate-900">Mes ventes du jour</div>
              <div className="text-xs text-slate-500">Produits et services vendus ou postes a mon nom aujourd&apos;hui.</div>
            </div>

            {report.sales.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                Aucune vente enregistree pour aujourd&apos;hui.
              </div>
            ) : (
              <div className="max-h-[280px] overflow-y-auto rounded-2xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Operation</th>
                      <th className="px-3 py-2 font-semibold">Client / contexte</th>
                      <th className="px-3 py-2 font-semibold">Heure</th>
                      <th className="px-3 py-2 font-semibold">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.sales.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100 align-top">
                        <td className="px-3 py-2">
                          <div className="font-semibold text-slate-900">{item.label}</div>
                          <div className="text-xs text-slate-500">
                            {item.source}
                            {item.reference ? ` - ${item.reference}` : ""}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="text-slate-700">{item.counterparty || "-"}</div>
                          {item.note ? <div className="text-xs text-slate-500">{item.note}</div> : null}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{formatDateTime(item.occurredAt)}</td>
                        <td className="px-3 py-2 font-bold text-slate-900">{formatMoney(item.amount, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3">
              <div className="font-bold text-slate-900">Mes encaissements du jour</div>
              <div className="text-xs text-slate-500">Encaissements relies a mon utilisateur aujourd&apos;hui.</div>
            </div>

            {report.receipts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                Aucun encaissement enregistre pour aujourd&apos;hui.
              </div>
            ) : (
              <div className="max-h-[220px] overflow-y-auto rounded-2xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Encaissement</th>
                      <th className="px-3 py-2 font-semibold">Mode</th>
                      <th className="px-3 py-2 font-semibold">Heure</th>
                      <th className="px-3 py-2 font-semibold">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.receipts.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100 align-top">
                        <td className="px-3 py-2">
                          <div className="font-semibold text-slate-900">{item.label}</div>
                          <div className="text-xs text-slate-500">
                            {item.source}
                            {item.counterparty ? ` - ${item.counterparty}` : ""}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-700">{paymentMethodLabel(item.paymentMethod)}</td>
                        <td className="px-3 py-2 text-slate-600">{formatDateTime(item.occurredAt)}</td>
                        <td className="px-3 py-2 font-bold text-slate-900">{formatMoney(item.amount, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </ModalShell>
  );
}

function ChangePasswordModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [current, setCurrent] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setErr("");
    if (pwd.length < 8) return setErr("Le nouveau mot de passe doit avoir au moins 8 caractères.");
    if (pwd !== confirm) return setErr("La confirmation ne correspond pas.");
    setLoading(true);
    try {
      await updatePassword(current, pwd, confirm);
      await onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Échec du changement de mot de passe.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell title="Changer le mot de passe" onClose={onClose}>
      {err ? <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{err}</div> : null}

      <div className="space-y-3">
        <div>
          <label className="text-sm font-semibold text-slate-700">Mot de passe actuel</label>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 outline-none transition focus:border-[#0d63b8] focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700">Nouveau mot de passe</label>
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 outline-none transition focus:border-[#0d63b8] focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700">Confirmer</label>
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
          {loading ? "Mise à jour..." : "Mettre à jour"}
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
    if (!file) return setErr("Choisis une image (PNG/JPG).");
    setLoading(true);
    try {
      await updateAvatar(file);
      await onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Échec upload avatar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell title="Mettre à jour l’avatar" onClose={onClose}>
      {err ? <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{err}</div> : null}

      <div className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold text-slate-600">Apercu avatar</div>
          <div className="mt-2 flex items-center gap-3">
            {showPreviewPhoto ? (
              <img
                src={previewSource}
                alt="Apercu avatar"
                className="h-16 w-16 rounded-full border border-slate-200 bg-white object-cover"
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
                  Fichier: <span className="font-semibold">{file.name}</span>
                </>
              ) : (
                "Selectionne une image pour previsualiser avant upload."
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
          📁 Choisir une image
        </button>

        <button
          onClick={submit}
          disabled={loading}
          className="w-full rounded-2xl brand-primary-btn py-3 font-bold disabled:opacity-60"
        >
          {loading ? "Upload..." : "Enregistrer"}
        </button>
      </div>
    </ModalShell>
  );
}
