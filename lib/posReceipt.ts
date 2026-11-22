import { formatMoney } from "./currency";
import { printHtmlDocument } from "./printHtml";
import { receiptLabels, receiptLocale, RECEIPT_LOCALE_TAG } from "./receiptI18n";
import type { Locale } from "./locale";

export type PosReceiptItem = {
  name: string;
  sku: string;
  qty: number;
  price: number;
  discountType?: "percent" | "fixed" | null;
  discountValue?: number;
  netTotal?: number;
};

export type PosReceipt = {
  locale?: Locale;
  loyaltyEnabled?: boolean;
  loyaltyPointsEarned?: number;
  loyaltyPointsBalanceAfter?: number | null;
  loyaltyPending?: boolean;
  reprint?: boolean;
  status?: string;
  customerName?: string;
  refundedTotal?: number;
  balanceDue?: number;
  payments?: { method: string; kind: string; amount: number; currency: string; cashReceived?: number | null; change?: number | null }[];
  saleId: string;
  receiptNo: string;
  createdAt: string;
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  businessEmail: string;
  businessLogoSrc: string | null;
  invoiceFooter: string;
  cashierName: string;
  items: PosReceiptItem[];
  saleCurrency: string;
  subtotal: number;
  discountAmount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  paymentCurrency: string;
  paymentAmount: number;
  paymentDateLabel: string | null;
  receiptQrCodeDataUri: string | null;
  cashReceived: number | null;
  change: number | null;
};
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function computeItemDiscount(
  lineGross: number,
  discountType: "percent" | "fixed" | null | undefined,
  discountValue: number | undefined,
): number {
  const value = discountValue ?? 0;
  if (!discountType || value <= 0 || lineGross <= 0) return 0;
  const amount = discountType === "percent" ? (lineGross * value) / 100 : value;
  return Math.min(lineGross, Math.max(0, amount));
}
// Reject executable SVGs, javascript: URLs and injected attributes from
// user-configurable logos/QR data. The same brand data is used on reprints.
function safeImageSrc(value: string | null | undefined): string {
  const src = String(value ?? "").trim();
  if (/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(src)) return src;
  if (/^https?:\/\/[^<>"'\s]+$/i.test(src)) return src;
  if (/^\/(?!\/)[^<>"'\s]+$/.test(src)) return src;
  return "";
}

export type ReceiptPaper = "80mm" | "a4";
export type ReceiptPrintOptions = { paper?: ReceiptPaper };

export function buildReceiptHtml(sale: PosReceipt, options: ReceiptPrintOptions = {}): string {
  const locale = receiptLocale(sale.locale);
  const t = receiptLabels(locale);
  const dir = locale === "ar" ? "rtl" : "ltr";
  const a4 = options.paper === "a4";
  const localeTag = RECEIPT_LOCALE_TAG[locale];
  const linesHtml = sale.items
    .map((item) => {
      const lineGross = item.qty * item.price;
      const lineTotal = item.netTotal ?? (lineGross - computeItemDiscount(lineGross, item.discountType, item.discountValue));
      return `<tr><td><div class="item-name">${escapeHtml(item.name)}</div>${item.sku ? `<div class="item-meta">${escapeHtml(item.sku)}</div>` : ""}</td><td style="text-align:right">${escapeHtml(String(item.qty))} x ${escapeHtml(formatMoney(item.price, sale.saleCurrency))}</td><td style="text-align:right">${escapeHtml(formatMoney(lineTotal, sale.saleCurrency))}</td></tr>`;
    })
    .join("");
  const paymentLabel = t.methods[sale.paymentMethod] ?? sale.paymentMethod;
  const paymentSummary = `<div class="row"><span>${escapeHtml(t.paid)}</span><strong>${escapeHtml(formatMoney(sale.paymentAmount, sale.paymentCurrency))}</strong></div>`;
  const discountBlock =
    sale.discountAmount > 0
      ? `<div class="row"><span>${escapeHtml(t.discount)}</span><span>- ${escapeHtml(formatMoney(sale.discountAmount, sale.saleCurrency))}</span></div>`
      : "";
  const cashBlock =
    sale.paymentMethod === "cash" && sale.cashReceived !== null && sale.change !== null
      ? `<div class="row"><span>${escapeHtml(t.received)}</span><strong>${escapeHtml(formatMoney(sale.cashReceived, sale.paymentCurrency))}</strong></div><div class="row"><span>${escapeHtml(t.change)}</span><strong>${escapeHtml(formatMoney(sale.change, sale.paymentCurrency))}</strong></div>`
      : "";
  const logoUrl = safeImageSrc(sale.businessLogoSrc);
  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(t.logoAlt)}" class="logo" />`
    : "";
  const qrUrl = safeImageSrc(sale.receiptQrCodeDataUri);
  const qrBlock = qrUrl
    ? `<div class="qr-card"><div class="qr-title">${escapeHtml(t.qrPayment)}</div><img src="${escapeHtml(qrUrl)}" alt="${escapeHtml(t.qrAlt)}" class="qr-image" /><div class="muted small">${escapeHtml(t.qrScan)}</div></div>`
    : "";
  const footerBlock = sale.invoiceFooter.trim()
    ? `<div class="footer-note">${escapeHtml(sale.invoiceFooter).replace(/\n/g, "<br />")}</div>`
    : "";
  const statusLabels = t.statuses;
  const copyBlock = sale.reprint ? `<div class="center copy"><strong>${escapeHtml(t.reprint)}</strong></div>` : "";
  const statusBlock = sale.status
    ? `<div class="row"><span>${escapeHtml(t.status)}</span><strong>${escapeHtml(statusLabels[sale.status] ?? sale.status)}</strong></div>` : "";
  const customerBlock = sale.customerName
    ? `<div class="row"><span>${escapeHtml(t.customer)}</span><span>${escapeHtml(sale.customerName)}</span></div>` : "";
  const balanceBlock = (sale.balanceDue ?? 0) > 0
    ? `<div class="row"><span>${escapeHtml(t.balance)}</span><strong>${escapeHtml(formatMoney(sale.balanceDue!, sale.saleCurrency))}</strong></div>` : "";
  const refundsBlock = (sale.refundedTotal ?? 0) > 0
    ? `<div class="row"><span>${escapeHtml(t.refunded)}</span><strong>${escapeHtml(formatMoney(sale.refundedTotal!, sale.saleCurrency))}</strong></div>` : "";
  const paymentsBlock = (sale.payments?.length ?? 0) > 1
    ? sale.payments!.map((payment) => `<div class="row"><span>${escapeHtml(payment.kind === "refund" ? t.refund : t.paymentLine)} ${escapeHtml(t.methods[payment.method] ?? payment.method)}</span><span>${escapeHtml(formatMoney(payment.amount, payment.currency))}</span></div>${payment.cashReceived != null ? `<div class="row"><span>${escapeHtml(t.cashReceived)}</span><span>${escapeHtml(formatMoney(payment.cashReceived, payment.currency))}</span></div>` : ""}${payment.change != null ? `<div class="row"><span>${escapeHtml(t.changeGiven)}</span><span>${escapeHtml(formatMoney(payment.change, payment.currency))}</span></div>` : ""}`).join("") : "";
  const date = new Date(sale.createdAt);
  const paymentDateLabel = Number.isNaN(date.getTime())
    ? (sale.paymentDateLabel || "")
    : new Intl.DateTimeFormat(localeTag, {
        dateStyle: "short", timeStyle: "short", timeZone: "America/Port-au-Prince",
      }).format(date);
  const loyaltyBlock = sale.loyaltyEnabled
    ? sale.loyaltyPending
      ? `<div class="sep"></div><div class="small">${escapeHtml(t.pointsPending)}</div>`
      : sale.loyaltyPointsBalanceAfter != null && Number.isFinite(sale.loyaltyPointsBalanceAfter)
        ? `<div class="sep"></div><div class="row"><span>${escapeHtml(t.earnedPoints)}</span><strong>${Math.max(0, Math.trunc(sale.loyaltyPointsEarned ?? 0))}</strong></div><div class="row"><span>${escapeHtml(t.pointsBalance)}</span><strong>${Math.max(0, Math.trunc(sale.loyaltyPointsBalanceAfter))}</strong></div>`
        : ''
    : '';
  // The business identity is the first visual block on every paper format.
  const brandHeader = `<header class="brand-header">
    <div class="brand-main">${logoBlock}<div class="brand-name">${escapeHtml(sale.businessName)}</div></div>
    <div class="brand-rule" aria-hidden="true"></div>
    ${sale.businessAddress ? `<div class="brand-address">${escapeHtml(sale.businessAddress)}</div>` : ""}
    ${sale.businessPhone || sale.businessEmail ? `<div class="brand-contact">${[sale.businessPhone, sale.businessEmail].filter(Boolean).map(escapeHtml).join(" · ")}</div>` : ""}
  </header>`;
  const css = `
    @page { ${a4 ? "size: A4; margin: 14mm;" : "margin: 4mm;"} }
    *, *::before, *::after { box-sizing: border-box; }
    html { color-scheme: light; }
    body { font-family: Arial, "Noto Sans", "Noto Naskh Arabic", sans-serif;
      font-size: 11px; color:#111827; width:72mm; margin:0 auto;
      overflow-wrap:anywhere; line-height:1.35; background:#fff; }
    body.paper-a4 { width:100%; max-width:185mm; font-size:13px; }
    .center {text-align:center;} .muted {color:#64748b;} .small {font-size:.87em;line-height:1.45;}
    .copy {margin:0 0 8px;font-size:11px;letter-spacing:.08em;}
    .brand-header {text-align:center; margin:0 0 13px; break-inside:avoid;}
    .brand-main {display:flex; flex-direction:row; gap:9px; align-items:center; justify-content:center;
      min-height:60px; margin-bottom:7px;}
    .brand-main .logo {width:60px;height:60px;flex:none;object-fit:contain;object-position:center;}
    .brand-name {font-size:18px;line-height:1.12;font-weight:800;overflow-wrap:anywhere;
      text-align:start; flex:1; }
    .brand-main:not(:has(.logo)) .brand-name {text-align:center;}
    .brand-rule {border-top:2px solid #172554;margin:7px 0 6px;width:100%;}
    .brand-address {font-weight:600;line-height:1.4;word-break:break-word;}
    .brand-contact {color:#475569;font-size:.93em;line-height:1.4;margin-top:3px;word-break:break-word;}
    .sep {border-top:1px dashed #94a3b8;margin:10px 0;}
    .row {display:flex;justify-content:space-between;gap:8px;margin:4px 0;align-items:baseline;}
    .row > * {min-width:0;overflow-wrap:anywhere;} .row > :last-child {text-align:end;}
    table {width:100%;border-collapse:collapse;table-layout:fixed;}
    td {padding:4px 2px;vertical-align:top;overflow-wrap:anywhere;}
    td:first-child {width:43%;padding-inline-start:0;} td:last-child {padding-inline-end:0;}
    tr,.header-card,.qr-card,.footer-note {break-inside:avoid;page-break-inside:avoid;}
    .grand {font-size:1.22em;font-weight:800;}
    .header-card,.qr-card,.footer-note {border:1px solid #e2e8f0;border-radius:10px;
      padding:9px;background:#fff;margin-bottom:10px;}
    .item-name {font-weight:700;} .item-meta {color:#64748b;font-size:.85em;}
    .qr-title {text-transform:uppercase;letter-spacing:.07em;font-size:.85em;
      color:#475569;font-weight:700;margin-bottom:8px;text-align:center;}
    .qr-image {width:96px;height:96px;display:block;margin:0 auto 8px;object-fit:contain;}
    .footer-note {font-size:.95em;line-height:1.5;color:#334155;white-space:normal;}
    .paper-a4 .brand-main {justify-content:flex-start;gap:18px;min-height:100px;}
    .paper-a4 .brand-main .logo {width:100px;height:100px;}
    .paper-a4 .brand-name {font-size:30px;}
    .paper-a4 .brand-header {margin-bottom:22px;}
    .paper-a4 .brand-rule {margin:14px 0 10px;border-top-width:3px;}
    .paper-a4 .brand-address {font-size:14px;}
    .paper-a4 .brand-contact {font-size:12px;}
    .paper-a4 td {padding:8px 5px;border-bottom:1px solid #e5e7eb;}
    .paper-a4 .header-card {margin-bottom:18px;padding:12px;}
    @media print {body {-webkit-print-color-adjust:exact; print-color-adjust:exact;}
      .header-card,.footer-note,.qr-card {background:#fff;} }
  `;
  return `
<!doctype html>
<html lang="${locale}" dir="${dir}"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(t.ticket)} ${escapeHtml(sale.receiptNo)}</title>
<style>${css}</style></head>
<body class="${a4 ? "paper-a4" : "paper-thermal"}">
${brandHeader}${copyBlock}
<section class="header-card">
<div class="row"><span>${escapeHtml(t.ticket)}</span><strong>${escapeHtml(sale.receiptNo)}</strong></div>
<div class="row"><span>${escapeHtml(t.date)}</span><span>${escapeHtml(paymentDateLabel)}</span></div>
<div class="row"><span>${escapeHtml(t.cashier)}</span><span>${escapeHtml(sale.cashierName)}</span></div>
<div class="row"><span>${escapeHtml(t.payment)}</span><span>${escapeHtml(paymentLabel)}</span></div>
${statusBlock}${customerBlock}
</section>
<table>${linesHtml}</table>
<div class="sep"></div>
<div class="row"><span>${escapeHtml(t.subtotal)}</span><span>${escapeHtml(formatMoney(sale.subtotal,sale.saleCurrency))}</span></div>
${discountBlock}
<div class="row"><span>${escapeHtml(t.tax)}</span><span>${escapeHtml(formatMoney(sale.tax,sale.saleCurrency))}</span></div>
<div class="row grand"><span>${escapeHtml(t.total)}</span><strong>${escapeHtml(formatMoney(sale.total,sale.saleCurrency))}</strong></div>
${paymentsBlock}${paymentSummary}${refundsBlock}${balanceBlock}${cashBlock}${loyaltyBlock}
<div class="sep"></div>${footerBlock}${qrBlock}
<div class="center muted">${escapeHtml(t.thanks)}</div>
</body></html>`;
}
export function printReceipt(sale: PosReceipt, options: ReceiptPrintOptions = {}) {
  const paper = options.paper ?? "80mm";
  printHtmlDocument(buildReceiptHtml(sale, { paper }), paper === "80mm"
    ? { paperWidthMm: 80, marginMm: 4 }
    : {});
}
