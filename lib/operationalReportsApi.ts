import { apiFetch, apiFetchBlob } from "./api";

export type StockReportRow = {
  product_id: number; barcode: string; category: string; name: string;
  opening: number; supplied: number; available: number; sold: number;
  unit_price: number; sold_value: number; remaining: number; remaining_value: number;
  defects: number; adjustments: number; cost_value: number;
};
export type StockReport = {
  business_name: string; branch_name: string; from: string; to: string;
  timezone: string; currency: string; generated_at: string; rows: StockReportRow[]; unassigned_movements_count?: number;
  totals: Omit<StockReportRow, "product_id" | "barcode" | "category" | "name" | "unit_price">;
};
export type CashSessionReport = {
  session_id: number; status: "open" | "closed"; user_name: string;
  opening: Record<string, number>; cash: Record<string, number>; expected: Record<string, number>;
  to_remit: Record<string, number>; products: { name: string; sku: string; quantity: number }[];
};
const base = (business: string) => `/api/app/${encodeURIComponent(business)}`;
export async function getStockReport(business: string, from: string, to: string): Promise<StockReport> {
  return (await apiFetch<{ data: StockReport }>(`${base(business)}/reports/inventory?${new URLSearchParams({ from, to })}`)).data;
}
export async function downloadStockReport(business: string, from: string, to: string) {
  const blob = await apiFetchBlob(`${base(business)}/reports/inventory.pdf?${new URLSearchParams({ from, to })}`);
  downloadReportBlob(blob, `rapport-stock-${from}-${to}.pdf`);
}
export async function getCashSessionReport(business: string, id: number): Promise<CashSessionReport> {
  return (await apiFetch<{ data: CashSessionReport }>(`${base(business)}/cash-sessions/${id}/report`)).data;
}
export async function downloadCashSessionReport(business: string, id: number) {
  const blob = await apiFetchBlob(`${base(business)}/cash-sessions/${id}/report.pdf`);
  downloadReportBlob(blob, `fermeture-caisse-${id}.pdf`);
}
function downloadReportBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
