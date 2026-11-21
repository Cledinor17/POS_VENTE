"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import { getDataSpace, updateDataSpace, type DataSpace } from "@/lib/backupApi";
import { useBusinessPermissions } from "@/lib/useBusinessPermissions";
import DataSpaceFields, { dataSpaceError, emptyDataSpace } from "./DataSpaceFields";

export default function DataSpaceSettings({ business }: { business: string }) {
  const { currentBusinessEntry, loading } = useBusinessPermissions(business);
  const owner = (currentBusinessEntry?.pivot?.role ?? currentBusinessEntry?.role) === "owner";
  return !loading && owner ? <OwnerDataSpace key={business} business={business} /> : null;
}

function OwnerDataSpace({ business }: { business: string }) {
  const [settings, setSettings] = useState<DataSpace | null>(null);
  const [form, setForm] = useState(emptyDataSpace);
  const [currentPassword, setCurrentPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let live = true;
    getDataSpace(business).then(data => {
      if (live) { setSettings(data); setForm({ ...emptyDataSpace, backup_name: data.name }); }
    }).catch(() => { if (live) setError("Impossible de charger votre espace de données. Réessayez."); });
    return () => { live = false; };
  }, [business, reload]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!settings || busy) return;
    setError(""); setMessage("");
    const invalid = dataSpaceError(form, !settings.configured);
    if (invalid) { setError(invalid); return; }
    if (!currentPassword) { setError("Saisissez votre mot de passe pour confirmer."); return; }
    setBusy(true);
    try {
      const result = await updateDataSpace(business, {
        ...form, backup_name: form.backup_name.trim(),
        ...(settings.configured ? { current_backup_password: currentPassword } : { password: currentPassword }),
      });
      setSettings(result);
      setMessage("Votre espace de données a été enregistré. Ce mot de passe vous sera demandé pour télécharger ou récupérer vos sauvegardes.");
      window.dispatchEvent(new CustomEvent("backup-settings-updated", { detail: business }));
    } catch (cause) {
      setError(cause instanceof ApiError && [401, 403, 422, 423].includes(cause.status) ? cause.message
        : cause instanceof ApiError && cause.status === 429 ? "Patientez une minute avant de réessayer."
        : "Impossible d’enregistrer votre espace de données. Réessayez.");
    } finally {
      setCurrentPassword(""); setForm(value => ({ ...value, backup_password: "", backup_password_confirmation: "" })); setBusy(false);
    }
  }

  return <section id="data-space" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <h2 className="text-lg font-bold text-slate-900">Espace de données</h2>
    <p className="mt-2 text-sm text-slate-600">Nommez les sauvegardes de votre entreprise et choisissez le mot de passe demandé pour les télécharger et les récupérer dans l’application.</p>
    {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {message && <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
    {!settings ? <button type="button" onClick={() => { setError(""); setReload(value => value + 1); }} className="mt-4 text-sm font-semibold text-[#0d63b8]">{error ? "Réessayer le chargement" : "Chargement…"}</button>
      : <form onSubmit={save} className="mt-5 space-y-4">
        <DataSpaceFields value={form} onChange={setForm} configured={settings.configured} disabled={busy} />
        <label className="block max-w-md text-sm font-semibold text-slate-700">{settings.configured ? "Mot de passe de sauvegarde actuel" : "Votre mot de passe de connexion"}
          <input type="password" autoComplete="current-password" required maxLength={settings.configured ? 72 : 1024} value={currentPassword} disabled={busy}
            onChange={event => setCurrentPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
          {!settings.configured && <span className="mt-1 block text-xs font-normal text-slate-500">Pour confirmer cette première configuration.</span>}
        </label>
        <button type="submit" disabled={busy} className="rounded-xl brand-primary-btn px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Enregistrement…" : "Enregistrer mon espace de données"}</button>
      </form>}
  </section>;
}
