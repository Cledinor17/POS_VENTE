import { apiFetch, apiFetchBlob } from "./api";

type Dict = Record<string, unknown>;

export type BackupTable = { table: string; rows: number };
export type DataSpace = { name: string; configured: boolean };

export type BackupSummary = {
  businessName: string;
  dataSpace: DataSpace;
  tables: BackupTable[];
  totalRows: number;
  canRestore: boolean;
  maxUploadBytes: number;
  recoveryPoints: { id: string; createdAt: string }[];
};

export type BackupPreview = {
  business_name: string;
  generated_at: string;
  total_records: number;
  files_count: number;
  missing_files_count: number;
  preview_token: string;
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
  const space = isObject(obj.data_space) ? obj.data_space : {};

  return {
    businessName: typeof biz.name === "string" ? biz.name : "",
    dataSpace: { name: typeof space.name === "string" ? space.name : "", configured: space.configured === true },
    totalRows: typeof obj.total_rows === "number" ? obj.total_rows : 0,
    canRestore: obj.can_restore === true,
    maxUploadBytes: typeof obj.max_upload_bytes === "number" ? obj.max_upload_bytes : 0,
    recoveryPoints: Array.isArray(obj.recovery_points) ? obj.recovery_points.flatMap(value => {
      const row = isObject(value) ? value : {};
      return typeof row.id === "string" && typeof row.created_at === "string" ? [{ id: row.id, createdAt: row.created_at }] : [];
    }) : [],
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
async function download(path: string, filename: string, password: string): Promise<string> {
  const blob = await apiFetchBlob(path, { method: "POST", json: { backup_password: password } });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);

  return filename;
}

function stamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

/** Readable workbook with an authenticated recovery copy and its attachments. */
export async function downloadBackup(business: string, password: string, name: string): Promise<string> {
  return download(`${basePath(business)}/download`, `${safeName(name)}-${stamp()}.xlsx`, password);
}

/**
 * Restorable snapshot, read back by `php artisan business:restore`.
 * Carries password hashes — the caller warns before triggering it.
 */
export async function downloadRestorePoint(business: string, password: string, name: string): Promise<string> {
  return download(`${basePath(business)}/export.json`, `restauration-${safeName(name)}-${stamp()}.json`, password);
}

export async function previewBackup(business: string, file: File, signal?: AbortSignal): Promise<BackupPreview> {
  const body = new FormData();
  body.append("file", file);
  return apiFetch<BackupPreview>(`${basePath(business)}/preview`, { method: "POST", body, signal });
}

export async function restoreBackup(business: string, file: File, previewToken: string, password: string): Promise<{ message: string; recovery_id: string }> {
  const body = new FormData();
  body.append("file", file);
  body.append("preview_token", previewToken);
  body.append("backup_password", password);
  body.append("confirmed", "1");
  return apiFetch(`${basePath(business)}/restore`, { method: "POST", body });
}

export async function downloadRecoveryCopy(business: string, id: string, password: string, name: string): Promise<string> {
  return download(`${basePath(business)}/recovery/${encodeURIComponent(id)}`, `${safeName(name)}-avant-recuperation-${stamp()}.xlsx`, password);
}

function safeName(name: string): string {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,63}$/.test(name) ? name : "sauvegarde";
}

export async function getDataSpace(business: string): Promise<DataSpace> {
  return apiFetch(`${basePath(business)}/settings`);
}

export async function updateDataSpace(business: string, payload: {
  backup_name: string; backup_password: string; backup_password_confirmation: string;
  current_backup_password?: string; password?: string;
}): Promise<DataSpace> {
  return apiFetch(`${basePath(business)}/settings`, { method: "PATCH", json: payload });
}
