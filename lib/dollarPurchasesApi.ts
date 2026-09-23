import { apiFetch } from "./api";

export type DollarPurchaseReceipt = {
  kind: "dollar_purchase";
  receipt_no: string;
  date_label: string;
  cashier_name: string;
  branch_name: string;
  customer_name: string;
  usd_amount: number;
  buy_rate: number;
  htg_amount: number;
  business: { name: string; address: string; phone: string };
};
export type DollarPurchase = { id: number; branch_id: number; number: string; receipt: DollarPurchaseReceipt };
export type DollarPurchaseInput = { idempotency_key: string; usd_amount: number; buy_rate: number; customer_name: string };
export function dollarPurchaseReference(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // getRandomValues also works for local network installations without HTTPS.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
const path = (business: string) => `/api/app/${encodeURIComponent(business)}/pos/dollar-purchases`;
export async function listDollarPurchases(business: string): Promise<DollarPurchase[]> {
  return (await apiFetch<{ data: DollarPurchase[] }>(path(business))).data;
}
export async function createDollarPurchase(business: string, branch: string, input: DollarPurchaseInput): Promise<DollarPurchase> {
  return (await apiFetch<{ data: DollarPurchase }>(path(business), {
    method: "POST", headers: { "X-Branch-Id": branch }, json: input,
  })).data;
}
export async function printDollarPurchase(business: string, purchase: DollarPurchase, printerId: string) {
  return apiFetch<{ printed: boolean; data?: string; qz_printer_name?: string }>(`${path(business)}/${purchase.id}/print`, {
    method: "POST", headers: { "X-Branch-Id": String(purchase.branch_id) }, json: { printer_id: printerId },
  });
}

export function dollarPurchaseReceiptHtml(receipt: DollarPurchaseReceipt): string {
  const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escape(receipt.receipt_no)}</title>
    <style>body{font:12px Arial;margin:0;color:#111}h1{font-size:17px;text-align:center}h2{font-size:15px;text-align:center}p{margin:6px 0;overflow-wrap:anywhere}.total{font-size:16px;font-weight:bold;border-top:1px dashed;padding-top:10px}</style></head><body>
    <h1>${escape(receipt.business.name)}</h1><p>${escape(receipt.business.address)}</p><p>${escape(receipt.business.phone)}</p>
    <h2>ACHAT DE DOLLARS</h2><p>Ticket : ${escape(receipt.receipt_no)}</p><p>${escape(receipt.date_label)}</p>
    <p>Succursale : ${escape(receipt.branch_name)}</p><p>Caissier : ${escape(receipt.cashier_name)}</p>
    ${receipt.customer_name ? `<p>Client : ${escape(receipt.customer_name)}</p>` : ""}<hr>
    <p>Dollars reçus : <strong>${Number(receipt.usd_amount).toFixed(2)} USD</strong></p>
    <p>Taux d’achat : 1 USD = ${Number(receipt.buy_rate)} HTG</p>
    <p class="total">Gourdes remises : ${Number(receipt.htg_amount).toFixed(2)} HTG</p></body></html>`;
}
