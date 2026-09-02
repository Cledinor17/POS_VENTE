"use client";

import { useState } from "react";
import { Download, Upload, X } from "lucide-react";
import { downloadImportTemplate, importEntityCsv, type ImportResult } from "@/lib/importApi";

export type ImportColumnHelp = {
  name: string;
  required: boolean;
  description: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  business: string;
  entityPath: string;
  title: string;
  templateFilename: string;
  columnsHelp: ImportColumnHelp[];
  onImported: () => void;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return "Une erreur est survenue.";
}

function importResultText(result: ImportResult): string {
  const parts = [`${result.created} cree(s)`, `${result.updated} mis a jour`];
  if (result.errorsCount > 0) {
    parts.push(`${result.errorsCount} ligne(s) en erreur`);
  }

  return `${parts.join(", ")}.`;
}

export default function ImportModal({
  open,
  onClose,
  business,
  entityPath,
  title,
  templateFilename,
  columnsHelp,
  onImported,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  if (!open) return null;

  function handleClose() {
    setFile(null);
    setError("");
    setResult(null);
    onClose();
  }

  async function handleDownloadTemplate() {
    setDownloading(true);
    setError("");
    try {
      await downloadImportTemplate(business, entityPath, templateFilename);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  }

  async function handleSubmit() {
    if (!file) return;
    setSubmitting(true);
    setError("");
    setResult(null);
    try {
      const outcome = await importEntityCsv(business, entityPath, file);
      setResult(outcome);
      onImported();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={handleClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl border border-slate-100 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 className="font-bold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-50"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          ) : null}

          <p className="text-sm text-slate-600">
            Ouvrez le modele dans Excel, remplissez une ligne par element, enregistrez au format CSV
            (<code>.csv</code>), puis importez-le ici.
          </p>

          <button
            type="button"
            onClick={() => void handleDownloadTemplate()}
            disabled={downloading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            {downloading ? "Telechargement..." : "Telecharger le modele"}
          </button>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Colonne</th>
                  <th className="px-3 py-2 font-semibold">Obligatoire</th>
                  <th className="px-3 py-2 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody>
                {columnsHelp.map((column) => (
                  <tr key={column.name} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono text-slate-800">{column.name}</td>
                    <td className="px-3 py-2 text-slate-600">{column.required ? "Oui" : "Non"}</td>
                    <td className="px-3 py-2 text-slate-600">{column.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Fichier CSV</label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
            />
          </div>

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!file || submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl brand-primary-btn py-2.5 font-bold disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            {submitting ? "Importation..." : "Importer"}
          </button>

          {result ? (
            <div className="space-y-2">
              <div
                className={`rounded-xl border px-4 py-3 text-sm ${
                  result.errors.length === 0
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                {importResultText(result)}
                {result.errorsTruncated ? (
                  <span className="mt-1 block text-xs">
                    Les {result.errors.length} premieres erreurs sont affichees.
                  </span>
                ) : null}
              </div>
              {result.errors.length > 0 ? (
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
                  {result.errors.map((rowError) => (
                    <li key={rowError.row}>
                      Ligne {rowError.row}: {rowError.errors.join(", ")}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
