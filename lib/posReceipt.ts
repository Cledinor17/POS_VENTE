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
  return `
<!doctype html>
<html><head><meta charset="utf-8" /><title>Ticket ${escapeHtml(sale.receiptNo)}</title><style>@page { margin: 4mm; } body { font-family: Arial, sans-serif; font-size: 11px; width: 72mm; margin: 0 auto; color: #111827; } .center { text-align: center; } .muted { color: #6b7280; } .small { font-size: 9px; line-height: 1.35; } .sep { border-top: 1px dashed #9ca3af; margin: 8px 0; } .row { display: flex; justify-content: space-between; gap: 8px; margin: 3px 0; } .title { font-size: 14px; font-weight: 700; margin-bottom: 2px; } table { width: 100%; border-collapse: collapse; table-layout: fixed; } td { padding: 3px 2px; vertical-align: top; overflow-wrap: anywhere; } td:first-child { width: 42%; padding-left: 0; } td:last-child { padding-right: 0; } .row > * { min-width: 0; overflow-wrap: anywhere; } .row > :last-child { text-align: right; } body { overflow-wrap: anywhere; } tr, .header-card, .qr-card { break-inside: avoid; } .grand { font-size: 14px; font-weight: 800; } .logo-wrap { text-align: center; margin-bottom: 8px; } .logo { width: 56px; height: 56px; object-fit: contain; border: 1px solid #e5e7eb; border-radius: 12px; padding: 4px; background: #fff; } .header-card, .qr-card, .footer-note { border: 1px solid #e5e7eb; border-radius: 12px; padding: 8px; background: #f8fafc; margin-bottom: 8px; } .item-name { font-weight: 700; } .item-meta { color: #6b7280; font-size: 9px; } .qr-title { text-transform: uppercase; letter-spacing: .08em; font-size: 9px; color: #475569; font-weight: 700; margin-bottom: 6px; text-align: center; } .qr-image { width: 96px; height: 96px; display: block; margin: 0 auto 6px; } .footer-note { font-size: 10px; line-height: 1.45; color: #334155; }</style></head><body>${copyBlock}<div class="center">${logoBlock}<div class="title">${escapeHtml(sale.businessName)}</div><div class="muted">${escapeHtml(sale.businessAddress || "")}</div><div class="muted">${escapeHtml(sale.businessPhone || "")}${sale.businessEmail ? ` | ${escapeHtml(sale.businessEmail)}` : ""}</div></div><div class="sep"></div><div class="header-card"><div class="row"><span>Ticket</span><strong>${escapeHtml(sale.receiptNo)}</strong></div><div class="row"><span>Date</span><span>${escapeHtml(paymentDateLabel)}</span></div><div class="row"><span>Caissier</span><span>${escapeHtml(sale.cashierName)}</span></div><div class="row"><span>Paiement</span><span>${escapeHtml(paymentLabel)}</span></div>${statusBlock}${customerBlock}</div><table>${linesHtml}</table><div class="sep"></div><div class="row"><span>Sous-total</span><span>${escapeHtml(formatMoney(sale.subtotal, sale.saleCurrency))}</span></div>${discountBlock}<div class="row"><span>Taxes</span><span>${escapeHtml(formatMoney(sale.tax, sale.saleCurrency))}</span></div><div class="row grand"><span>Total</span><span>${escapeHtml(formatMoney(sale.total, sale.saleCurrency))}</span></div>${paymentsBlock}${paymentSummary}${refundsBlock}${balanceBlock}${cashBlock}${loyaltyBlock}<div class="sep"></div>${footerBlock}${qrBlock}<div class="center muted">Merci et a bientot.</div></body></html>`;
}
export function printReceipt(sale: PosReceipt) {
  printHtmlDocument(buildReceiptHtml(sale), { paperWidthMm: 80 });
}
