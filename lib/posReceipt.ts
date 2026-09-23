import { formatMoney } from "./currency";
import { printHtmlDocument } from "./printHtml";

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
function paymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: "Cash", card: "Carte", mobile_money: "Mobile", moncash: "Mobile",
    bank_transfer: "Virement", bank: "Virement", voucher: "Bon", cheque: "Cheque",
    loyalty: "Points fidelite",
  };
  return labels[method] ?? method;
}

export function buildReceiptHtml(sale: PosReceipt): string {
  const linesHtml = sale.items
    .map((item) => {
      const lineGross = item.qty * item.price;
      const lineTotal = item.netTotal ?? (lineGross - computeItemDiscount(lineGross, item.discountType, item.discountValue));
      return `<tr><td><div class="item-name">${escapeHtml(item.name)}</div>${item.sku ? `<div class="item-meta">${escapeHtml(item.sku)}</div>` : ""}</td><td style="text-align:right">${escapeHtml(String(item.qty))} x ${escapeHtml(formatMoney(item.price, sale.saleCurrency))}</td><td style="text-align:right">${escapeHtml(formatMoney(lineTotal, sale.saleCurrency))}</td></tr>`;
    })
    .join("");
  const paymentLabel = paymentMethodLabel(sale.paymentMethod);
  const paymentSummary = `<div class="row"><span>Montant regle</span><strong>${escapeHtml(formatMoney(sale.paymentAmount, sale.paymentCurrency))}</strong></div>`;
  const discountBlock =
    sale.discountAmount > 0
      ? `<div class="row"><span>Rabais</span><span>- ${escapeHtml(formatMoney(sale.discountAmount, sale.saleCurrency))}</span></div>`
      : "";
  const cashBlock =
    sale.paymentMethod === "cash" && sale.cashReceived !== null && sale.change !== null
      ? `<div class="row"><span>Recu</span><strong>${escapeHtml(formatMoney(sale.cashReceived, sale.paymentCurrency))}</strong></div><div class="row"><span>Monnaie</span><strong>${escapeHtml(formatMoney(sale.change, sale.paymentCurrency))}</strong></div>`
      : "";
  const logoBlock = sale.businessLogoSrc
    ? `<div class="logo-wrap"><img src="${sale.businessLogoSrc}" alt="Logo hotel" class="logo" /></div>`
    : "";
  const qrBlock = sale.receiptQrCodeDataUri
    ? `<div class="qr-card"><div class="qr-title">QR paiement</div><img src="${sale.receiptQrCodeDataUri}" alt="QR ticket" class="qr-image" /><div class="muted small">Scanner pour voir le business, le montant paye et la date.</div></div>`
    : "";
  const footerBlock = sale.invoiceFooter.trim()
    ? `<div class="footer-note">${escapeHtml(sale.invoiceFooter).replace(/\n/g, "<br />")}</div>`
    : "";
  const statusLabels: Record<string, string> = {
    paid: "Payee", partially_paid: "Partiellement payee", void: "Annulee",
    refunded: "Remboursee", issued: "Ouverte",
  };
  const copyBlock = sale.reprint ? '<div class="center"><strong>REIMPRESSION</strong></div>' : "";
  const statusBlock = sale.status
    ? `<div class="row"><span>Statut</span><strong>${escapeHtml(statusLabels[sale.status] ?? sale.status)}</strong></div>` : "";
  const customerBlock = sale.customerName
    ? `<div class="row"><span>Client</span><span>${escapeHtml(sale.customerName)}</span></div>` : "";
  const balanceBlock = (sale.balanceDue ?? 0) > 0
    ? `<div class="row"><span>Solde</span><strong>${escapeHtml(formatMoney(sale.balanceDue!, sale.saleCurrency))}</strong></div>` : "";
  const refundsBlock = (sale.refundedTotal ?? 0) > 0
    ? `<div class="row"><span>Rembourse</span><strong>${escapeHtml(formatMoney(sale.refundedTotal!, sale.saleCurrency))}</strong></div>` : "";
  const paymentsBlock = (sale.payments?.length ?? 0) > 1
    ? sale.payments!.map((payment) => `<div class="row"><span>${payment.kind === "refund" ? "Remboursement" : "Paiement"} ${escapeHtml(paymentMethodLabel(payment.method))}</span><span>${escapeHtml(formatMoney(payment.amount, payment.currency))}</span></div>${payment.cashReceived != null ? `<div class="row"><span>Espèces reçues</span><span>${escapeHtml(formatMoney(payment.cashReceived, payment.currency))}</span></div>` : ""}${payment.change != null ? `<div class="row"><span>Monnaie rendue</span><span>${escapeHtml(formatMoney(payment.change, payment.currency))}</span></div>` : ""}`).join("") : "";
  const paymentDateLabel = sale.paymentDateLabel || new Date(sale.createdAt).toLocaleString("fr-FR");
  return `
<!doctype html>
<html><head><meta charset="utf-8" /><title>Ticket ${escapeHtml(sale.receiptNo)}</title><style>@page { margin: 4mm; } body { font-family: Arial, sans-serif; font-size: 11px; width: 72mm; margin: 0 auto; color: #111827; } .center { text-align: center; } .muted { color: #6b7280; } .small { font-size: 9px; line-height: 1.35; } .sep { border-top: 1px dashed #9ca3af; margin: 8px 0; } .row { display: flex; justify-content: space-between; gap: 8px; margin: 3px 0; } .title { font-size: 14px; font-weight: 700; margin-bottom: 2px; } table { width: 100%; border-collapse: collapse; table-layout: fixed; } td { padding: 3px 2px; vertical-align: top; overflow-wrap: anywhere; } td:first-child { width: 42%; padding-left: 0; } td:last-child { padding-right: 0; } .row > * { min-width: 0; overflow-wrap: anywhere; } .row > :last-child { text-align: right; } body { overflow-wrap: anywhere; } tr, .header-card, .qr-card { break-inside: avoid; } .grand { font-size: 14px; font-weight: 800; } .logo-wrap { text-align: center; margin-bottom: 8px; } .logo { width: 56px; height: 56px; object-fit: contain; border: 1px solid #e5e7eb; border-radius: 12px; padding: 4px; background: #fff; } .header-card, .qr-card, .footer-note { border: 1px solid #e5e7eb; border-radius: 12px; padding: 8px; background: #f8fafc; margin-bottom: 8px; } .item-name { font-weight: 700; } .item-meta { color: #6b7280; font-size: 9px; } .qr-title { text-transform: uppercase; letter-spacing: .08em; font-size: 9px; color: #475569; font-weight: 700; margin-bottom: 6px; text-align: center; } .qr-image { width: 96px; height: 96px; display: block; margin: 0 auto 6px; } .footer-note { font-size: 10px; line-height: 1.45; color: #334155; }</style></head><body>${copyBlock}<div class="center">${logoBlock}<div class="title">${escapeHtml(sale.businessName)}</div><div class="muted">${escapeHtml(sale.businessAddress || "")}</div><div class="muted">${escapeHtml(sale.businessPhone || "")}${sale.businessEmail ? ` | ${escapeHtml(sale.businessEmail)}` : ""}</div></div><div class="sep"></div><div class="header-card"><div class="row"><span>Ticket</span><strong>${escapeHtml(sale.receiptNo)}</strong></div><div class="row"><span>Date</span><span>${escapeHtml(paymentDateLabel)}</span></div><div class="row"><span>Caissier</span><span>${escapeHtml(sale.cashierName)}</span></div><div class="row"><span>Paiement</span><span>${escapeHtml(paymentLabel)}</span></div>${statusBlock}${customerBlock}</div><table>${linesHtml}</table><div class="sep"></div><div class="row"><span>Sous-total</span><span>${escapeHtml(formatMoney(sale.subtotal, sale.saleCurrency))}</span></div>${discountBlock}<div class="row"><span>Taxes</span><span>${escapeHtml(formatMoney(sale.tax, sale.saleCurrency))}</span></div><div class="row grand"><span>Total</span><span>${escapeHtml(formatMoney(sale.total, sale.saleCurrency))}</span></div>${paymentsBlock}${paymentSummary}${refundsBlock}${balanceBlock}${cashBlock}<div class="sep"></div>${footerBlock}${qrBlock}<div class="center muted">Merci et a bientot.</div></body></html>`;
}
export function printReceipt(sale: PosReceipt) {
  printHtmlDocument(buildReceiptHtml(sale), { paperWidthMm: 80 });
}
