"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Download, LifeBuoy, ShieldCheck } from "lucide-react";
import { ApiError } from "@/lib/api";
import {
  downloadBackup,
  downloadRestorePoint,
  getBackupSummary,
  type BackupSummary,
} from "@/lib/backupApi";
import { usePermissionGuard } from "@/lib/usePermissionGuard";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

export default function BackupPage() {
  const { allowed, loading: permLoading } = usePermissionGuard("business.manage");
  const params = useParams<{ business: string }>();
  const businessSlug = params?.business ?? "";

  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const load = useCallback(async () => {
    if (!businessSlug) return;
    setLoading(true);
    setError("");
    try {
      setSummary(await getBackupSummary(businessSlug));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [businessSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDownload() {
    setDownloading(true);
    setError("");
    setInfo("");
    try {
      const filename = await downloadBackup(businessSlug);
      setInfo(`Archive telechargee : ${filename}`);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setDownloading(false);
    }
  }

  async function handleRestorePoint() {
    const confirmed = window.confirm(
      "Ce fichier contient les mots de passe (chiffres) de tes utilisateurs : il permet de restaurer " +
        "l'entreprise apres une panne, mais il doit etre garde en lieu sur et ne jamais etre partage.\n\n" +
        "Telecharger ?",
    );
    if (!confirmed) return;

    setDownloading(true);
    setError("");
    setInfo("");
    try {
      const filename = await downloadRestorePoint(businessSlug);
      setInfo(`Point de restauration telecharge : ${filename}`);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setDownloading(false);
    }
  }

  if (permLoading || !allowed) return null;

  const filled = (summary?.tables ?? []).filter((row) => row.rows > 0);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Sauvegarde des donnees</h1>
            <p className="mt-1 max-w-2xl text-slate-500">
              Telecharge une archive ZIP contenant toutes les donnees de cette entreprise, un
              fichier par table, ouvrable dans Excel. Garde-la ailleurs que sur le serveur.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={downloading || loading}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl brand-primary-btn px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            {downloading ? "Preparation..." : "Telecharger la sauvegarde"}
          </button>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <span>
            L&apos;archive ne contient que les donnees de cette entreprise. Les mots de passe et
            jetons de connexion en sont volontairement exclus.
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-bold text-slate-900">
              <LifeBuoy className="h-4 w-4 text-amber-600" />
              Point de restauration
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Un fichier unique qui permet de <strong>reconstruire entierement cette entreprise</strong>{" "}
              apres une panne, via la commande{" "}
              <code className="rounded bg-white px-1.5 py-0.5 text-xs">php artisan business:restore</code>.
              Contrairement a l&apos;archive Excel, il contient les mots de passe chiffres : sans eux,
              personne ne pourrait se reconnecter apres la restauration. Garde-le en lieu sur.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleRestorePoint()}
            disabled={downloading || loading}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            Telecharger le point de restauration
          </button>
        </div>
      </section>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</section>
      ) : null}
      {info ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{info}</section>
      ) : null}

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        {loading ? (
          <div className="py-8 text-center text-slate-500">Analyse des donnees...</div>
        ) : !summary ? (
          <div className="py-8 text-center text-slate-500">Impossible de lire le contenu.</div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-baseline gap-x-2 text-sm text-slate-600">
              <span className="text-lg font-bold text-slate-900">{summary.totalRows}</span>
              <span>ligne(s) au total, reparties sur</span>
              <span className="font-semibold text-slate-900">{filled.length}</span>
              <span>fichier(s) contenant des donnees</span>
              <span className="text-slate-400">({summary.tables.length} fichiers au total)</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2 pr-3 font-semibold">Fichier</th>
                    <th className="py-2 font-semibold">Lignes</th>
                  </tr>
                </thead>
                <tbody>
                  {filled.map((row) => (
                    <tr key={row.table} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium text-slate-800">{row.table}.csv</td>
                      <td className="py-2 text-slate-600">{row.rows}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filled.length === 0 ? (
              <div className="py-6 text-center text-slate-500">Aucune donnee a sauvegarder pour le moment.</div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
