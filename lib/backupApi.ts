import { apiFetch, apiFetchBlob } from "./api";

type Dict = Record<string, unknown>;

export type BackupTable = { table: string; rows: number };

export type BackupSummary = {
  businessName: string;
  tables: BackupTable[];
  totalRows: number;
};

function isObject(value: unknown): value is Dict {
  return typeof value === "object" && value !== null;
}

function basePath(business: string): string {
  return `/api/app/${encodeURIComponent(business)}/backup`;
}

export async function getBackupSummary(business: string): Promise<BackupSummary> {
  const raw = await apiFetch<unknown>(`${basePath(business)}/summary`);
  const obj = isObject(raw) ? raw : {};
  const biz = isObject(obj.business) ? obj.business : {};

  return {
    businessName: typeof biz.name === "string" ? biz.name : "",
    totalRows: typeof obj.total_rows === "number" ? obj.total_rows : 0,
    tables: Array.isArray(obj.tables)
      ? obj.tables
          .map((item) => {
            const row = isObject(item) ? item : {};
            return {
              table: typeof row.table === "string" ? row.table : "",
              rows: typeof row.rows === "number" ? row.rows : 0,
            };
          })
          .filter((row) => row.table !== "")
      : [],
  };
}

/**
 * Downloads a file and hands it to the browser. Goes through apiFetchBlob
 * rather than a plain link because the endpoint needs the Authorization
 * header — a bare <a href> would arrive unauthenticated.
 */
async function download(path: string, filename: string): Promise<string> {
  const blob = await apiFetchBlob(path);

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return filename;
}

function stamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

/** Human-readable archive: one CSV per table, no secrets. */
export async function downloadBackup(business: string): Promise<string> {
  return download(`${basePath(business)}/download`, `sauvegarde-${business}-${stamp()}.zip`);
}

/**
 * Restorable snapshot, read back by `php artisan business:restore`.
 * Carries password hashes — the caller warns before triggering it.
 */
export async function downloadRestorePoint(business: string): Promise<string> {
  return download(`${basePath(business)}/export.json`, `restauration-${business}-${stamp()}.json`);
}
