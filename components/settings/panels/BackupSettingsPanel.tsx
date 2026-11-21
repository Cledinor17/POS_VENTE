"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Download, Upload, ShieldCheck, RotateCcw, LoaderCircle } from "lucide-react";
import { ApiError } from "@/lib/api";
import {
  downloadBackup, downloadRecoveryCopy, getBackupSummary, previewBackup, restoreBackup,
  type BackupPreview, type BackupSummary,
} from "@/lib/backupApi";
import { usePermissionGuard } from "@/lib/usePermissionGuard";
import type { SettingsPanelProps } from "../types";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 413) return "Ce fichier est trop volumineux pour être envoyé. Contactez l’assistance.";
    if (error.status === 429) return "Vous avez effectué plusieurs essais. Patientez une minute avant de réessayer.";
    if ([403, 422, 423].includes(error.status)) return error.message;
    if (error.status === 401) return "Votre connexion a expiré. Connectez-vous à nouveau.";
  }
  return "L’opération n’a pas pu être confirmée. Actualisez la page pour vérifier vos données avant de réessayer. Contactez l’assistance si le problème persiste.";
}

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date indisponible" : date.toLocaleString("fr-FR");
}

export default function BackupSettingsPanel({ embedded = false }: SettingsPanelProps = {}) {
  const { business = "" } = useParams<{ business: string }>();
  return <BackupContent key={business} business={business} embedded={embedded} />;
}

function BackupContent({ business, embedded }: { business: string; embedded: boolean }) {
  const Heading = embedded ? "h2" : "h1";
  const { allowed, loading: permLoading } = usePermissionGuard("business.manage");
  const search = useSearchParams();
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"download" | "restore" | "copy" | null>(null);
  const [checking, setChecking] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [password, setPassword] = useState("");
  const [downloadPassword, setDownloadPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState(search.get("recovered") === "1" ? "Vos données ont été récupérées. Vous pouvez reprendre votre activité." : "");
  const verification = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!allowed || permLoading) return;
    let live = true;
    getBackupSummary(business).then(data => { if (live) setSummary(data); })
      .catch(cause => { if (live) setError(errorMessage(cause)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [allowed, permLoading, business, reload]);

  useEffect(() => () => { verification.current?.abort(); }, []);
  useEffect(() => {
    function refreshSettings(event: Event) {
      if ((event as CustomEvent).detail !== business) return;
      setLoading(true); setDownloadPassword(""); setPassword(""); setReload(value => value + 1);
    }
    window.addEventListener("backup-settings-updated", refreshSettings);
    return () => window.removeEventListener("backup-settings-updated", refreshSettings);
  }, [business]);

  async function handleDownload(recoveryId?: string) {
    if (busy || loading || !summary?.dataSpace.configured || !downloadPassword) return;
    setBusy(recoveryId ? "copy" : "download"); setError(""); setInfo("");
    try {
      if (recoveryId) await downloadRecoveryCopy(business, recoveryId, downloadPassword, summary.dataSpace.name);
      else await downloadBackup(business, downloadPassword, summary.dataSpace.name);
      setInfo("Votre sauvegarde a été téléchargée. Gardez le fichier original dans un endroit sûr, en dehors de cet appareil.");
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(null); setDownloadPassword(""); }
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    verification.current?.abort();
    const selected = event.target.files?.[0] ?? null;
    // Allow choosing the same file again after a failed/expired verification.
    event.target.value = "";
    setFile(null); setPreview(null); setConfirmed(false); setPassword(""); setError(""); setInfo(""); setChecking(false);
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith(".xlsx")) {
      setError("Choisissez le fichier Excel de sauvegarde téléchargé depuis cette application."); return;
    }
    if (!summary || summary.maxUploadBytes <= 0) { setError("Patientez pendant le chargement puis choisissez à nouveau votre sauvegarde."); return; }
    if (selected.size > summary.maxUploadBytes) {
      setError("Ce fichier dépasse la taille acceptée. Contactez l’assistance pour récupérer cette sauvegarde."); return;
    }
    const controller = new AbortController();
    verification.current = controller;
    setFile(selected); setChecking(true);
    try {
      const result = await previewBackup(business, selected, controller.signal);
      if (!controller.signal.aborted) setPreview(result);
    } catch (cause) { if (!controller.signal.aborted) setError(errorMessage(cause)); }
    finally { if (!controller.signal.aborted) setChecking(false); }
  }

  async function handleRestore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || checking || !summary?.dataSpace.configured || !file || !preview || !confirmed || !password) return;
    setBusy("restore"); setError(""); setInfo("");
    try {
      await restoreBackup(business, file, preview.preview_token, password);
      setPassword("");
      setInfo("Vos données ont été récupérées. Réouverture de votre entreprise…");
      // Reload all business screens so old forms/cached branch selections cannot overwrite restored data.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Recovery must discard every mounted business form.
      window.location.assign(`/${encodeURIComponent(business)}/settings/backup?recovered=1`);
    } catch (cause) { setError(errorMessage(cause)); setBusy(null); }
    finally { setPassword(""); }
  }

  if (permLoading || !allowed) return null;
  const disabled = busy !== null || checking;
  const stats = [
    ["Produits", "products"], ["Clients", "customers"], ["Fournisseurs", "suppliers"], ["Factures", "invoices"],
  ];

  return <div className="space-y-5" aria-busy={disabled}>
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
      <Heading className="text-2xl font-bold text-slate-900">Sauvegarder et récupérer mes données</Heading>
      <p className="mt-2 text-slate-500">
        Gardez une copie des données de <strong className="text-slate-700">{summary?.businessName || "votre entreprise"}</strong> pour les retrouver après une panne ou une erreur.
      </p>
      {summary && <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(([label, table]) => <div key={table} className="rounded-xl bg-slate-50 px-4 py-3">
          <div className="text-xl font-bold text-slate-900">{(summary.tables.find(row => row.table === table)?.rows ?? 0).toLocaleString("fr-FR")}</div>
          <div className="text-sm text-slate-500">{label}</div>
        </div>)}
      </div>}
    </section>

    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    {info && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{info}</p>}
    {summary && !summary.dataSpace.configured && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      {summary.canRestore ? <>Pour commencer, <a href={`/${encodeURIComponent(business)}/business#data-space`} className="font-semibold underline">configurez votre espace de données</a> : choisissez son nom et son mot de passe de sauvegarde.</>
        : "Le propriétaire doit d’abord configurer l’espace de données dans les paramètres de l’entreprise."}
    </p>}

    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Download className="h-5 w-5 text-[#0d63b8]" />1. Garder une copie</h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-600">
        Téléchargez un fichier Excel contenant les données de cette entreprise et ses pièces jointes disponibles : ventes, stock, clients, équipe et réglages.
        Conservez le fichier original sans le modifier pour pouvoir le réutiliser ici.
      </p>
      {summary?.dataSpace.configured && <div className="mt-4 max-w-md">
        <p className="mb-3 text-sm text-slate-600">Espace de données : <strong>{summary.dataSpace.name}</strong></p>
        <label htmlFor="backup-download-password" className="block text-sm font-semibold text-slate-700">Mot de passe de sauvegarde</label>
        <input id="backup-download-password" type="password" autoComplete="current-password" maxLength={72} disabled={disabled} value={downloadPassword}
          onChange={event => setDownloadPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
        <p className="mt-1 text-xs text-slate-500">Le mot de passe choisi pour les sauvegardes de cette entreprise.</p>
      </div>}
      <button type="button" disabled={disabled || loading || !summary?.dataSpace.configured || !downloadPassword} onClick={() => void handleDownload()}
        className="mt-4 inline-flex items-center gap-2 rounded-xl brand-primary-btn px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
        {busy === "download" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {busy === "download" ? "Préparation de votre sauvegarde…" : "Télécharger ma sauvegarde"}
      </button>
      <p className="mt-4 flex items-start gap-2 text-sm text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        Ce fichier est personnel à votre entreprise. Gardez-en une copie dans un endroit sûr et partagez-le uniquement avec une personne de confiance.
      </p>
    </section>

    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><RotateCcw className="h-5 w-5 text-[#0d63b8]" />2. Retrouver mes données</h2>
      <p className="mt-2 text-sm text-slate-600">Choisissez une sauvegarde de cette entreprise. Vous pourrez vérifier son nom et sa date avant de continuer.</p>
      {loading ? <p role="status" className="mt-4 text-sm text-slate-500">Chargement…</p> : !summary ? <button type="button"
        onClick={() => { setLoading(true); setError(""); setReload(value => value + 1); }}
        className="mt-4 font-semibold text-[#0d63b8]">Réessayer le chargement</button> : !summary.canRestore ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
        Seul le propriétaire de l’entreprise peut récupérer une sauvegarde.
      </p> : !summary.dataSpace.configured ? <p className="mt-4 text-sm text-slate-500">Configurez votre espace de données pour récupérer une sauvegarde.</p> : <form onSubmit={handleRestore} className="mt-4 space-y-4">
        <div>
          <label htmlFor="business-backup-file" className="mb-2 block text-sm font-semibold text-slate-700">Choisir ma sauvegarde</label>
          <input id="business-backup-file" type="file" accept=".xlsx" disabled={busy !== null}
            onChange={event => void chooseFile(event)}
            className="block w-full rounded-xl border border-slate-200 p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-[#0d63b8]" />
          <p className="mt-2 text-xs text-slate-500">Fichier Excel original · Taille maximale : {(summary.maxUploadBytes / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo.</p>
          {file && <p className="mt-2 break-all text-sm text-slate-600">Fichier choisi : {file.name}</p>}
        </div>
        {checking && <p role="status" className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Vérification de votre sauvegarde…</p>}
        {preview && <>
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-slate-700">
            <p className="font-bold">{preview.business_name}</p>
            <p className="mt-1">Sauvegarde du {dateLabel(preview.generated_at)}</p>
            <p className="mt-1">{preview.total_records.toLocaleString("fr-FR")} éléments et {preview.files_count.toLocaleString("fr-FR")} pièces jointes à récupérer.</p>
            {preview.missing_files_count > 0 && <p className="mt-2 font-semibold text-amber-800">{preview.missing_files_count} pièce(s) jointe(s) étaient déjà indisponibles au moment de la sauvegarde et ne pourront pas être récupérées.</p>}
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p>Les données actuelles seront remplacées par celles de cette sauvegarde. Les changements effectués après sa date ne seront plus présents.</p>
            <p className="mt-2">Demandez à votre équipe de terminer ses opérations et d’envoyer ses ventes en attente avant de continuer. Reconnectez ensuite les appareils de l’équipe.</p>
            <p className="mt-2">Une copie de vos données actuelles sera conservée automatiquement pour pouvoir revenir en arrière.</p>
          </div>
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input type="checkbox" checked={confirmed} disabled={disabled} onChange={event => setConfirmed(event.target.checked)} className="mt-1 h-4 w-4 shrink-0" />
            Je souhaite remplacer les données actuelles de cette entreprise par cette sauvegarde.
          </label>
          <div className="max-w-md">
            <label htmlFor="backup-confirm-password" className="mb-2 block text-sm font-semibold text-slate-700">Mot de passe de sauvegarde</label>
            <input id="backup-confirm-password" type="password" autoComplete="current-password" value={password} disabled={disabled}
              onChange={event => setPassword(event.target.value)} required maxLength={72}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5" />
          </div>
          <button type="submit" disabled={disabled || !confirmed || !password} className="inline-flex items-center gap-2 rounded-xl brand-primary-btn px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {busy === "restore" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {busy === "restore" ? "Récupération en cours, patientez…" : "Récupérer mes données"}
          </button>
        </>}
      </form>}
    </section>

    {!!summary?.recoveryPoints.length && <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-bold text-slate-900">Copies conservées avant une récupération</h2>
      <p className="mt-2 text-sm text-slate-600">Pour revenir à la situation précédente, saisissez votre mot de passe de sauvegarde dans « Garder une copie », puis téléchargez une de ces copies et choisissez-la ci-dessus. Les trois dernières copies sont conservées.</p>
      <ul className="mt-3 divide-y divide-slate-100">
        {summary.recoveryPoints.map(point => <li key={point.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
          <span className="text-slate-600">{dateLabel(point.createdAt)}</span>
          <button type="button" disabled={disabled || loading || !summary.dataSpace.configured || !downloadPassword} onClick={() => void handleDownload(point.id)}
            className="font-semibold text-[#0d63b8] hover:underline disabled:opacity-50">Télécharger cette copie</button>
        </li>)}
      </ul>
    </section>}
  </div>;
}
