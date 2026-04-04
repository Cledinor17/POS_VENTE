"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  fetchCurrentUserDailyReportPdf,
  getCurrentUserDailyReport,
  saveCurrentUserDailyClosure,
  type CurrentUserDailyReport,
} from "../lib/currentUserReportApi";

function todayLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function formatDateTime(value: string | null) {
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

function remittanceCurrencyLabel(currency: string) {
  switch (currency.toUpperCase()) {
    case "HTG":
      return "HTG";
    case "USD":
      return "$";
    default:
      return currency;
  }
}

const REMITTANCE_CURRENCIES = ["HTG", "USD"] as const;

type RemittanceCurrency = (typeof REMITTANCE_CURRENCIES)[number];

function formatAmountInput(amount: number) {
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

function differenceTone(value: number | null) {
  if (value === null) return "text-slate-600";
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-red-600";
  return "text-slate-700";
}

function parseMoneyInput(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

export default function CurrentUserDailyReportModal({
  business,
  userName,
  onClose,
  variant = "desktop",
}: {
  business: string;
  userName: string;
  onClose: () => void;
  variant?: "desktop" | "mobile";
}) {
  const [mounted, setMounted] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayLocalDate());
  const [report, setReport] = useState<CurrentUserDailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submittedCashInputs, setSubmittedCashInputs] = useState<Record<RemittanceCurrency, string>>({
    HTG: "0.00",
    USD: "0.00",
  });
  const [closureNotes, setClosureNotes] = useState("");

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!business) return;
      setLoading(true);
      setError("");
      setNotice("");

      try {
        const next = await getCurrentUserDailyReport(business, { date: selectedDate });
        if (!cancelled) {
          setReport(next);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Impossible de charger le rapport utilisateur.");
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
  }, [business, selectedDate]);

  useEffect(() => {
    if (!report) return;
    const nextAmounts = report.summary.cashToSubmitByCurrency;
    setSubmittedCashInputs({
      HTG: formatAmountInput(nextAmounts.HTG ?? 0),
      USD: formatAmountInput(nextAmounts.USD ?? 0),
    });
    setClosureNotes(report.closure.notes || "");
  }, [report]);

  const currency = report?.currency || "USD";
  const remainingCash = report?.summary.cashToSubmit ?? 0;
  const remainingCashByCurrency = report?.summary.cashToSubmitByCurrency ?? { HTG: 0, USD: 0 };
  const expectedCash = report?.closure.currentExpectedCashAmount ?? 0;
  const expectedCashByCurrency =
    report?.closure.currentExpectedCashAmountByCurrency ??
    report?.closure.expectedCashAmountByCurrency ?? { HTG: 0, USD: 0 };
  const cashBreakdown = useMemo(
    () =>
      REMITTANCE_CURRENCIES.map((code) => ({
        code,
        label: remittanceCurrencyLabel(code),
        amount: remainingCashByCurrency[code] ?? 0,
      })),
    [remainingCashByCurrency]
  );
  const enteredBreakdown = useMemo<Record<RemittanceCurrency, number | null>>(
    () => ({
      HTG: parseMoneyInput(submittedCashInputs.HTG),
      USD: parseMoneyInput(submittedCashInputs.USD),
    }),
    [submittedCashInputs]
  );
  const differencePreviewByCurrency = useMemo<Record<RemittanceCurrency, number | null>>(
    () => ({
      HTG:
        enteredBreakdown.HTG === null
          ? null
          : Number((enteredBreakdown.HTG - (remainingCashByCurrency.HTG ?? 0)).toFixed(2)),
      USD:
        enteredBreakdown.USD === null
          ? null
          : Number((enteredBreakdown.USD - (remainingCashByCurrency.USD ?? 0)).toFixed(2)),
    }),
    [enteredBreakdown, remainingCashByCurrency]
  );

  async function handleExportPdf() {
    if (!business) return;
    setExporting(true);
    setError("");
    setNotice("");

    try {
      const blob = await fetchCurrentUserDailyReportPdf(business, { date: selectedDate });
      downloadBlob(blob, `mon-rapport-${selectedDate}.pdf`);
      setNotice("Le PDF du rapport a ete telecharge.");
    } catch (e: any) {
      setError(e?.message ?? "Impossible d'exporter le PDF.");
    } finally {
      setExporting(false);
    }
  }

  async function handleSaveClosure() {
    if (!business || !report) return;
    const submittedCashAmountByCurrency = {
      HTG: enteredBreakdown.HTG ?? 0,
      USD: enteredBreakdown.USD ?? 0,
    };
    if (submittedCashAmountByCurrency.HTG < 0 || submittedCashAmountByCurrency.USD < 0) {
      setError("Saisis des montants remis valides en HTG et en $.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const next = await saveCurrentUserDailyClosure(business, {
        date: selectedDate,
        submittedCashAmountByCurrency,
        notes: closureNotes,
      });
      setReport(next);
      setNotice("La remise de caisse a ete enregistree.");
    } catch (e: any) {
      setError(e?.message ?? "Impossible d'enregistrer la remise.");
    } finally {
      setSaving(false);
    }
  }

  const shellClassName =
    variant === "mobile"
      ? "fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-3 py-4 [padding-top:max(env(safe-area-inset-top),1rem)] [padding-bottom:max(env(safe-area-inset-bottom),1rem)]"
      : "fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4 py-5 [padding-top:max(env(safe-area-inset-top),1.25rem)] [padding-bottom:max(env(safe-area-inset-bottom),1.25rem)] md:px-6 md:py-6";
  const dialogClassName =
    variant === "mobile"
      ? "relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
      : "relative z-10 flex max-h-[calc(100dvh-2.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl";
  const contentClassName = variant === "mobile" ? "min-h-0 flex-1 space-y-4 overflow-y-auto p-4" : "min-h-0 flex-1 space-y-4 overflow-y-auto p-5";

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className={shellClassName}>
      <div className="absolute inset-0" onClick={onClose} />
      <div className={dialogClassName}>
        <div className="shrink-0 flex items-center justify-between border-b border-slate-100 px-4 py-3 md:px-5">
          <div>
            <div className="font-bold text-slate-900">Mon rapport du jour</div>
            <div className="text-xs text-slate-500">{userName}</div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Fermer
          </button>
        </div>

        <div className={contentClassName}>
          {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div> : null}
          {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div> : null}

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="font-bold text-slate-900">Periode du rapport</div>
                <div className="text-xs text-slate-500">Consulte une date, exporte le PDF et cloture ta caisse.</div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="text-sm font-semibold text-slate-700">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Date</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 outline-none transition focus:border-[#0d63b8] focus:ring-2 focus:ring-blue-500/20"
                  />
                </label>
                <button
                  onClick={handleExportPdf}
                  disabled={exporting || loading}
                  className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {exporting ? "Export..." : "Exporter PDF"}
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Chargement du rapport...
            </div>
          ) : report ? (
            <>
              <div className="grid gap-3 lg:grid-cols-4">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-xs font-semibold text-emerald-700">Cash a remettre</div>
                  <div className="mt-1 text-xl font-extrabold text-emerald-900">
                    {formatMoney(remainingCash, currency)}
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {cashBreakdown.map((item) => (
                      <div key={item.code} className="rounded-xl border border-emerald-200/80 bg-white/70 px-3 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                          {item.label}
                        </div>
                        <div className="mt-1 text-sm font-bold text-emerald-950">{formatMoney(item.amount, item.code)}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs font-semibold text-slate-500">Ventes</div>
                  <div className="mt-1 text-lg font-extrabold text-slate-900">
                    {formatMoney(report.summary.salesTotal, currency)}
                  </div>
                  <div className="text-xs text-slate-500">{report.summary.salesCount} operation(s)</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs font-semibold text-slate-500">Encaissements</div>
                  <div className="mt-1 text-lg font-extrabold text-slate-900">
                    {formatMoney(report.summary.receiptsTotal, currency)}
                  </div>
                  <div className="text-xs text-slate-500">{report.summary.receiptsCount} encaissement(s)</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs font-semibold text-slate-500">Cloture</div>
                  <div className="mt-1 text-sm font-extrabold text-slate-900">
                    {report.closure.isClosed ? "Cloturee" : "En attente"}
                  </div>
                  <div className="text-xs text-slate-500">{report.closure.submittedAt ? formatDateTime(report.closure.submittedAt) : "Aucune remise enregistree"}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="font-bold text-slate-900">Cloture de caisse</div>
                    <div className="text-xs text-slate-500">
                      Enregistre une remise partielle ou complete. Les champs HTG et $ se rechargent avec le reste a remettre.
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Derniere cloture: {report.closure.submittedAt ? formatDateTime(report.closure.submittedAt) : "pas encore"}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                  <div className="grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {REMITTANCE_CURRENCIES.map((code) => (
                        <label key={code} className="text-sm font-semibold text-slate-700">
                          <span className="mb-1 block">{`Nouvelle remise ${remittanceCurrencyLabel(code)}`}</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={submittedCashInputs[code]}
                            onChange={(event) =>
                              setSubmittedCashInputs((prev) => ({
                                ...prev,
                                [code]: event.target.value,
                              }))
                            }
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 outline-none transition focus:border-[#0d63b8] focus:ring-2 focus:ring-blue-500/20"
                          />
                        </label>
                      ))}
                    </div>

                    <label className="text-sm font-semibold text-slate-700">
                      <span className="mb-1 block">Notes</span>
                      <textarea
                        rows={3}
                        value={closureNotes}
                        onChange={(event) => setClosureNotes(event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-[#0d63b8] focus:ring-2 focus:ring-blue-500/20"
                        placeholder="Details de remise, ecart, observations..."
                      />
                    </label>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Cash encaisse du jour</span>
                        <span className="font-bold text-slate-900">{formatMoney(expectedCash, currency)}</span>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Reste a remettre par devise</div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {REMITTANCE_CURRENCIES.map((code) => (
                            <div key={code} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                {remittanceCurrencyLabel(code)}
                              </div>
                              <div className="mt-1 font-bold text-slate-900">
                                {formatMoney(remainingCashByCurrency[code] ?? 0, code)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Cash du jour par devise</div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {REMITTANCE_CURRENCIES.map((code) => (
                            <div key={code} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                {remittanceCurrencyLabel(code)}
                              </div>
                              <div className="mt-1 font-bold text-slate-900">
                                {formatMoney(expectedCashByCurrency[code] ?? 0, code)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Total deja remis par devise</div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {REMITTANCE_CURRENCIES.map((code) => (
                            <div key={code} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                {remittanceCurrencyLabel(code)}
                              </div>
                              <div className="mt-1 font-bold text-slate-900">
                                {report.closure.submittedCashAmountByCurrency
                                  ? formatMoney(report.closure.submittedCashAmountByCurrency[code] ?? 0, code)
                                  : "-"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Total deja remis</span>
                        <span className="font-bold text-slate-900">
                          {report.closure.submittedCashAmount === null ? "-" : formatMoney(report.closure.submittedCashAmount, currency)}
                        </span>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Ecart en cours par devise</div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {REMITTANCE_CURRENCIES.map((code) => {
                            const preview = differencePreviewByCurrency[code];
                            return (
                              <div key={code} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                  {remittanceCurrencyLabel(code)}
                                </div>
                                <div className={`mt-1 font-bold ${differenceTone(preview)}`}>
                                  {preview === null ? "-" : formatMoney(preview, code)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Ecart cumule enregistre</span>
                        <span className={`font-bold ${differenceTone(report.closure.differenceAmount)}`}>
                          {report.closure.differenceAmount === null ? "-" : formatMoney(report.closure.differenceAmount, currency)}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={handleSaveClosure}
                      disabled={saving || loading}
                      className="mt-4 w-full rounded-2xl brand-primary-btn py-3 font-bold disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? "Enregistrement..." : report.closure.isClosed ? "Enregistrer une autre remise" : "Enregistrer la remise"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3">
                  <div className="font-bold text-slate-900">Ventilation des encaissements</div>
                  <div className="text-xs text-slate-500">Montants collectes par mode de paiement pour cette date.</div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {Object.entries(report.paymentMethods).map(([method, amount]) => (
                    <div key={method} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-semibold text-slate-500">{paymentMethodLabel(method)}</div>
                      <div className="mt-1 font-extrabold text-slate-900">{formatMoney(amount, currency)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {variant === "mobile" ? (
                <>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-2 font-bold text-slate-900">Mes ventes</div>
                    <div className="space-y-2">
                      {report.sales.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                          Aucune vente enregistree.
                        </div>
                      ) : (
                        report.sales.map((item) => (
                          <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-semibold text-slate-900">{item.label}</div>
                                <div className="text-xs text-slate-500">
                                  {item.source}
                                  {item.reference ? ` - ${item.reference}` : ""}
                                </div>
                                <div className="mt-1 text-xs text-slate-600">{item.counterparty || "-"}</div>
                                <div className="text-[11px] text-slate-500">{formatDateTime(item.occurredAt)}</div>
                              </div>
                              <div className="text-right font-bold text-slate-900">{formatMoney(item.amount, currency)}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-2 font-bold text-slate-900">Mes encaissements</div>
                    <div className="space-y-2">
                      {report.receipts.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                          Aucun encaissement enregistre.
                        </div>
                      ) : (
                        report.receipts.map((item) => (
                          <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-semibold text-slate-900">{item.label}</div>
                                <div className="text-xs text-slate-500">{paymentMethodLabel(item.paymentMethod)}</div>
                                <div className="mt-1 text-xs text-slate-600">{item.counterparty || "-"}</div>
                                <div className="text-[11px] text-slate-500">{formatDateTime(item.occurredAt)}</div>
                              </div>
                              <div className="text-right font-bold text-slate-900">{formatMoney(item.amount, currency)}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-3">
                      <div className="font-bold text-slate-900">Mes ventes</div>
                      <div className="text-xs text-slate-500">Produits et services vendus ou postes a mon nom pour cette date.</div>
                    </div>

                    {report.sales.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                        Aucune vente enregistree.
                      </div>
                    ) : (
                      <div className="max-h-[260px] overflow-y-auto rounded-2xl border border-slate-100">
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
                      <div className="font-bold text-slate-900">Mes encaissements</div>
                      <div className="text-xs text-slate-500">Encaissements relies a mon utilisateur pour cette date.</div>
                    </div>

                    {report.receipts.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                        Aucun encaissement enregistre.
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
                </>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
