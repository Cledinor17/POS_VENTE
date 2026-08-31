import { apiFetch } from "./api";

type Dict = Record<string, unknown>;

export type PrinterConnectionType = "network" | "qz";
export type PrinterPaperWidth = "58" | "80";

export type PrinterItem = {
  id: string;
  name: string;
  connectionType: PrinterConnectionType;
  ipAddress: string | null;
  port: number | null;
  qzPrinterName: string | null;
  paperWidth: PrinterPaperWidth;
  cashDrawerEnabled: boolean;
  isDefault: boolean;
  createdAt: string | null;
};

export type PrinterInput = {
  name: string;
  connectionType: PrinterConnectionType;
  ipAddress?: string | null;
  port?: number | null;
  qzPrinterName?: string | null;
  paperWidth?: PrinterPaperWidth;
  cashDrawerEnabled?: boolean;
  isDefault?: boolean;
};

export type PrintReceiptResult =
  | { printed: true }
  | { printed: false; format: "escpos_raw_base64"; data: string; qzPrinterName: string | null };

export type OpenDrawerResult =
  | { opened: true }
  | { opened: false; format: "escpos_raw_base64"; data: string; qzPrinterName: string | null };

function isObject(value: unknown): value is Dict {
  return typeof value === "object" && value !== null;
}

function toString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

function basePath(business: string): string {
  return `/api/app/${encodeURIComponent(business)}/printers`;
}

function getCollection(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!isObject(raw)) return [];
  if (Array.isArray(raw.data)) return raw.data;
  return [];
}

function normalizePrinter(raw: unknown): PrinterItem {
  const obj = isObject(raw) ? raw : {};
  const connectionType = toString(obj.connection_type, "network") as PrinterConnectionType;
  const paperWidth = toString(obj.paper_width, "80") as PrinterPaperWidth;

  return {
    id: toString(obj.id, ""),
    name: toString(obj.name, "Imprimante"),
    connectionType: connectionType === "qz" ? "qz" : "network",
    ipAddress: toString(obj.ip_address, "") || null,
    port: toNumberOrNull(obj.port),
    qzPrinterName: toString(obj.qz_printer_name, "") || null,
    paperWidth: paperWidth === "58" ? "58" : "80",
    cashDrawerEnabled: Boolean(obj.cash_drawer_enabled),
    isDefault: Boolean(obj.is_default),
    createdAt: toString(obj.created_at, "") || null,
  };
}

function toPayload(input: Partial<PrinterInput>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.connectionType !== undefined) payload.connection_type = input.connectionType;
  if (input.ipAddress !== undefined) payload.ip_address = input.ipAddress;
  if (input.port !== undefined) payload.port = input.port;
  if (input.qzPrinterName !== undefined) payload.qz_printer_name = input.qzPrinterName;
  if (input.paperWidth !== undefined) payload.paper_width = input.paperWidth;
  if (input.cashDrawerEnabled !== undefined) payload.cash_drawer_enabled = input.cashDrawerEnabled;
  if (input.isDefault !== undefined) payload.is_default = input.isDefault;
  return payload;
}

export async function listPrinters(business: string): Promise<PrinterItem[]> {
  const raw = await apiFetch<unknown>(basePath(business));
  return getCollection(raw).map(normalizePrinter);
}

export async function createPrinter(business: string, input: PrinterInput): Promise<PrinterItem> {
  const raw = await apiFetch<unknown>(basePath(business), {
    method: "POST",
    json: toPayload(input),
  });
  return normalizePrinter(raw);
}

export async function updatePrinter(
  business: string,
  printerId: string,
  input: Partial<PrinterInput>
): Promise<PrinterItem> {
  const raw = await apiFetch<unknown>(`${basePath(business)}/${encodeURIComponent(printerId)}`, {
    method: "PUT",
    json: toPayload(input),
  });
  return normalizePrinter(raw);
}

export async function deletePrinter(business: string, printerId: string): Promise<void> {
  await apiFetch<unknown>(`${basePath(business)}/${encodeURIComponent(printerId)}`, {
    method: "DELETE",
  });
}

export async function printReceiptOnPrinter(
  business: string,
  printerId: string,
  saleId: string
): Promise<PrintReceiptResult> {
  const raw = await apiFetch<Dict>(`${basePath(business)}/${encodeURIComponent(printerId)}/print-receipt`, {
    method: "POST",
    json: { sale_id: Number(saleId) },
  });

  if (raw.printed === true) return { printed: true };

  return {
    printed: false,
    format: "escpos_raw_base64",
    data: toString(raw.data, ""),
    qzPrinterName: toString(raw.qz_printer_name, "") || null,
  };
}

export async function openCashDrawer(business: string, printerId: string): Promise<OpenDrawerResult> {
  const raw = await apiFetch<Dict>(`${basePath(business)}/${encodeURIComponent(printerId)}/open-drawer`, {
    method: "POST",
  });

  if (raw.opened === true) return { opened: true };

  return {
    opened: false,
    format: "escpos_raw_base64",
    data: toString(raw.data, ""),
    qzPrinterName: toString(raw.qz_printer_name, "") || null,
  };
}
