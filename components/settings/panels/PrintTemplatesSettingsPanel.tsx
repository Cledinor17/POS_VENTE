"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, Copy, Eye, Printer, Save, Trash2 } from "lucide-react";
import { getPosSettings, type BusinessSettings } from "@/lib/businessApi";
import { hasPermission } from "@/lib/businessAccess";
import { useBusinessPermissions } from "@/lib/useBusinessPermissions";
import { useAppLocale } from "@/context/LocaleContext";
import {
  activatePrintTemplate, createPrintTemplate, deletePrintTemplate,
  listPrintTemplates, updatePrintTemplate,
} from "@/lib/printTemplatesApi";
import { defaultPrintTemplate, PRINT_PAPERS, safePrintTemplate,
  type PrintPaper, type PrintTemplate } from "@/lib/printTemplateModel";
import { buildReceiptHtml, printReceipt, type PosReceipt } from "@/lib/posReceipt";
import type { SettingsPanelProps } from "../types";

const fieldClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-100";
const buttonClass = "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";

function addressLabel(settings: BusinessSettings | null): string {
  const address = settings?.address;
  if (!address) return "";
  return [address.line1, address.line2, [address.city, address.state].filter(Boolean).join(", "), address.zip, address.country]
    .filter(Boolean).join(", ");
}

export default function PrintTemplatesSettingsPanel({ embedded = false }: SettingsPanelProps = {}) {
  const { business = "" } = useParams<{ business: string }>();
  const t = useTranslations("receiptDesigner");
  const { locale } = useAppLocale();
  const { permissions } = useBusinessPermissions(business);
  const canManage = hasPermission(permissions, "business.manage");
  const [paper, setPaper] = useState<PrintPaper>("80mm");
  const [templates, setTemplates] = useState<PrintTemplate[]>([]);
  const [effective, setEffective] = useState<Record<PrintPaper, PrintTemplate>>({
    "58mm": defaultPrintTemplate("58mm"),
    "80mm": defaultPrintTemplate("80mm"),
    "a4": defaultPrintTemplate("a4"),
  });
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [draft, setDraft] = useState<PrintTemplate>(defaultPrintTemplate("80mm"));
  const [baseline, setBaseline] = useState<PrintTemplate>(defaultPrintTemplate("80mm"));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!business) return null;
    const data = await listPrintTemplates(business);
    setTemplates(data.data);
    setEffective(data.effective);
    return data;
  }, [business]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    Promise.all([listPrintTemplates(business), getPosSettings(business)])
      .then(([result, config]) => {
        if (!current) return;
        setTemplates(result.data);
        setEffective(result.effective);
        setSettings(config);
        const initial = result.effective["80mm"];
        setDraft(initial);
        setBaseline(initial);
      })
      .catch(err => { if (current) setError(err instanceof Error ? err.message : t("error")); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [business, t]);

  function selectPaper(next: PrintPaper) {
    setPaper(next);
    const selected = effective[next];
    setDraft(selected);
    setBaseline(selected);
    setNotice("");
    setError("");
  }
  function selectTemplate(id: number | null) {
    const found = id === null
      ? defaultPrintTemplate(paper)
      : templates.find(item => item.id === id && item.paper === paper);
    if (!found) return;
    setDraft({ ...found });
    setBaseline({ ...found });
    setNotice("");
    setError("");
  }

  function update<K extends keyof PrintTemplate>(key: K, value: PrintTemplate[K]) {
    setDraft(old => ({ ...old, [key]: value }));
    setNotice("");
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const currentTemplates = templates.filter(item => item.paper === paper);
  const active = effective[paper]?.id === draft.id
    && (draft.id !== null || currentTemplates.length === 0);
  const paperName = (value: PrintPaper) => t(value === "a4" ? "paperA4" : value === "58mm" ? "paper58" : "paper80");

  async function save() {
    if (!canManage || busy || !business) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const safe = safePrintTemplate(draft, paper);
      const saved = safe.id
        ? await updatePrintTemplate(business, safe)
        : await createPrintTemplate(business, {
            name: safe.name.trim(), paper, layout: safe.layout,
            logo_position: safe.logo_position, accent_color: safe.accent_color,
            logo_size: safe.logo_size, name_size: safe.name_size,
            show_logo: safe.show_logo, show_name: safe.show_name, show_address: safe.show_address,
            show_phone: safe.show_phone, show_email: safe.show_email,
            show_separator: safe.show_separator, show_qr: safe.show_qr,
            show_footer: safe.show_footer, footer_text: safe.footer_text,
          });
      const data = await load();
      const fresh = data?.data.find(item => item.id === saved.id) ?? saved;
      setDraft(fresh);
      setBaseline(fresh);
      setNotice(t("saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error"));
    } finally { setBusy(false); }
  }

  async function activate() {
    if (!draft.id || !canManage || dirty || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await activatePrintTemplate(business, draft);
      const data = await load();
      const fresh = data?.data.find(item => item.id === draft.id) ?? draft;
      setDraft(fresh); setBaseline(fresh);
      setNotice(t("activated"));
    } catch (err) { setError(err instanceof Error ? err.message : t("error")); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!draft.id || !canManage || busy || !window.confirm(t("confirmDelete"))) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await deletePrintTemplate(business, draft);
      const data = await load();
      const next = data?.effective[paper] ?? defaultPrintTemplate(paper);
      setDraft(next); setBaseline(next);
      setNotice(t("deleted"));
    } catch (err) { setError(err instanceof Error ? err.message : t("error")); }
    finally { setBusy(false); }
  }

  const sample = useMemo<PosReceipt>(() => ({
    saleId: "sample", receiptNo: "DEMO-000001", createdAt: "2026-11-21T23:37:00-05:00",
    locale,
    businessName: settings?.name || business,
    businessAddress: addressLabel(settings),
    businessPhone: settings?.phone || "",
    businessEmail: settings?.email || "",
    businessLogoSrc: settings?.logo_url || null,
    invoiceFooter: settings?.invoice_footer || t("demoFooter"),
    cashierName: t("demoCashier"), customerName: t("demoCustomer"),
    items: [{ name: t("demoItem"), sku: "DEMO-1", qty: 2, price: 225 }],
    saleCurrency: settings?.currency || "HTG",
    subtotal: 450, discountAmount: 0, tax: 0, total: 450,
    paymentMethod: "cash", paymentCurrency: settings?.currency || "HTG",
    paymentAmount: 450, paymentDateLabel: null, receiptQrCodeDataUri: null,
    cashReceived: 500, change: 50,
  }), [settings, business, locale, t]);

  const preview = useMemo(
    () => buildReceiptHtml(sample, { paper, template: draft }),
    [sample, paper, draft],
  );
  const Heading = embedded ? "h2" : "h1";

  return (
    <div className="space-y-5">
      <header>
        <Heading className="text-xl font-bold text-slate-900">{t("title")}</Heading>
        <p className="mt-1 text-sm text-slate-600">{t("description")}</p>
      </header>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {loading ? <p role="status" className="p-5 text-sm text-slate-500">{t("loading")}</p> : (
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
            <label className="block text-sm font-medium text-slate-800">
              {t("paper")}
              <select className={fieldClass} value={paper}
                onChange={e => selectPaper(e.target.value as PrintPaper)}>
                {PRINT_PAPERS.map(item => <option key={item} value={item}>{paperName(item)}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-800">
              {t("savedTemplates")}
              <select className={fieldClass} value={draft.id ?? ""}
                onChange={e => selectTemplate(e.target.value ? Number(e.target.value) : null)}>
                <option value="">{t("standard")}</option>
                {currentTemplates.map(item => (
                  <option key={item.id} value={item.id ?? ""}>
                    {item.name}{item.is_default ? ` · ${t("active")}` : ""}
                  </option>
                ))}
              </select>
            </label>
            {currentTemplates.length === 0
              ? <p className="text-xs text-slate-500">{t("noTemplates")}</p> : null}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={buttonClass} disabled={!canManage || busy || currentTemplates.length >= 12}
                onClick={() => {
                  const next = { ...draft, id: null, is_default: false, name: t("namePlaceholder") };
                  setDraft(next); setBaseline(defaultPrintTemplate(paper)); setNotice("");
                }}>
                <Copy className="h-4 w-4" />{t("new")}
              </button>
              {active && !dirty && <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
                <Check className="h-4 w-4" />{t("active")}
              </span>}
            </div>
            <label className="block text-sm font-medium text-slate-800">
              {t("name")}
              <input className={fieldClass} value={draft.name} disabled={!canManage} maxLength={100}
                onChange={e => update("name", e.target.value)} placeholder={t("namePlaceholder")} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-800">
                {t("layout")}
                <select className={fieldClass} value={draft.layout} disabled={!canManage}
                  onChange={e => update("layout", e.target.value as PrintTemplate["layout"])}>
                  <option value="brand">{t("brand")}</option>
                  <option value="classic">{t("classic")}</option>
                  <option value="compact">{t("compact")}</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-800">
                {t("logoPosition")}
                <select className={fieldClass} value={draft.logo_position} disabled={!canManage}
                  onChange={e => update("logo_position", e.target.value as PrintTemplate["logo_position"])}>
                  <option value="left">{t("left")}</option>
                  <option value="center">{t("center")}</option>
                  <option value="right">{t("right")}</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-800">
                {t("accentColor")}
                <input type="color" className="mt-1 block h-10 w-full rounded-lg border border-slate-300"
                  disabled={!canManage} value={draft.accent_color}
                  onChange={e => update("accent_color", e.target.value)} />
              </label>
              <label className="block text-sm font-medium text-slate-800">
                {t("logoSize")}
                <input type="number" min={28} max={130} className={fieldClass} disabled={!canManage}
                  value={draft.logo_size} onChange={e => update("logo_size", Number(e.target.value))} />
              </label>
              <label className="block text-sm font-medium text-slate-800">
                {t("nameSize")}
                <input type="number" min={12} max={42} className={fieldClass} disabled={!canManage}
                  value={draft.name_size} onChange={e => update("name_size", Number(e.target.value))} />
              </label>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                ["show_logo", "showLogo"], ["show_name", "showName"],
                ["show_address", "showAddress"], ["show_phone", "showPhone"],
                ["show_email", "showEmail"], ["show_separator", "showSeparator"],
                ["show_qr", "showQr"], ["show_footer", "showFooter"],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm text-slate-700">
                  <input type="checkbox" checked={draft[key]} disabled={!canManage}
                    onChange={e => update(key, e.target.checked)} />
                  {t(label)}
                </label>
              ))}
            </div>
            <label className="block text-sm font-medium text-slate-800">
              {t("footerText")}
              <textarea rows={2} className={fieldClass} disabled={!canManage}
                maxLength={1000} value={draft.footer_text ?? ""}
                onChange={e => update("footer_text", e.target.value || null)} />
              <span className="mt-1 block text-xs font-normal text-slate-500">{t("footerHint")}</span>
            </label>
            <p className="text-xs text-slate-500">
              {t("logoHint")}{" "}
              <Link className="font-semibold text-indigo-700 underline" href={`/${encodeURIComponent(business)}/business`}>
                {t("manageLogo")}
              </Link>
            </p>
            {!canManage && <p role="status" className="text-sm text-amber-800">{t("noAccess")}</p>}
            {dirty && <p className="text-xs font-semibold text-amber-700">{t("unsaved")}</p>}
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <button type="button" className={buttonClass + " bg-indigo-700 text-white hover:bg-indigo-800"}
                disabled={!canManage || busy || !draft.name.trim()}
                onClick={() => void save()}>
                <Save className="h-4 w-4" />{busy ? t("saving") : t("save")}
              </button>
              <button type="button" className={buttonClass}
                disabled={!canManage || busy || !draft.id || dirty || active}
                title={dirty ? t("saveFirst") : undefined} onClick={() => void activate()}>
                <Check className="h-4 w-4" />{t("activate")}
              </button>
              <button type="button" className={buttonClass + " text-rose-700"}
                disabled={!canManage || busy || !draft.id} onClick={() => void remove()}>
                <Trash2 className="h-4 w-4" />{t("remove")}
              </button>
            </div>
            <p className="text-xs text-slate-500">{t("templateLimit")}</p>
          </section>
          <section className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                  <Eye className="h-4 w-4" />{t("preview")}
                </h3>
                <p className="text-xs text-slate-500">{t("previewHint")}</p>
              </div>
              <button type="button" className={buttonClass}
                onClick={() => printReceipt(sample, { paper, template: draft })}>
                <Printer className="h-4 w-4" />{t("printTest")}
              </button>
            </div>
            <div className="max-w-full overflow-x-auto rounded-xl border border-slate-300 bg-slate-200 p-4">
              <iframe title={t("preview")} srcDoc={preview} sandbox=""
                className="mx-auto block min-h-[700px] border border-slate-200 bg-white shadow-sm"
                style={{ width: paper === "a4" ? "210mm" : paper === "58mm" ? "58mm" : "80mm", height: 750 }} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
