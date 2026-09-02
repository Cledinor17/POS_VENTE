import { apiFetch, apiFetchBlob } from "./api";

export type ImportRowError = { row: number; errors: string[] };
export type ImportResult = {
  created: number;
  updated: number;
  processed: number;
  errorsCount: number;
  errorsTruncated: boolean;
  errors: ImportRowError[];
};

type Dict = Record<string, unknown>;
function isObj(value: unknown): value is Dict {
  return typeof value === "object" && value !== null;
}
function toNum(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function toStr(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}
function toBool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return fallback;
}

function normalizeResult(raw: unknown): ImportResult {
  const obj = isObj(raw) ? raw : {};
  const errorsRaw = Array.isArray(obj.errors) ? obj.errors : [];
  const errors = errorsRaw.map((item) => {
    const errorObj = isObj(item) ? item : {};
    const errorList = Array.isArray(errorObj.errors)
      ? errorObj.errors.filter((value): value is string => typeof value === "string")
      : [];
    return { row: toNum(errorObj.row, 0), errors: errorList };
  });
  const created = toNum(obj.created, 0);
  const updated = toNum(obj.updated, 0);

  return {
    created,
    updated,
    processed: toNum(obj.processed, created + updated + errors.length),
    errorsCount: toNum(obj.errors_count ?? obj.errorsCount, errors.length),
    errorsTruncated: toBool(obj.errors_truncated ?? obj.errorsTruncated, false),
    errors,
  };
}

export async function importEntityCsv(
  business: string,
  entityPath: string,
  file: File
): Promise<ImportResult> {
  const formData = new FormData();
  formData.append("file", file);

  const raw = await apiFetch<unknown>(
    `/api/app/${encodeURIComponent(business)}/${entityPath}/import`,
    { method: "POST", body: formData }
  );
  return normalizeResult(raw);
}

export async function downloadImportTemplate(
  business: string,
  entityPath: string,
  filename: string
): Promise<void> {
  const blob = await apiFetchBlob(
    `/api/app/${encodeURIComponent(business)}/${entityPath}/import/template`
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = toStr(filename, "modele.csv");
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}
