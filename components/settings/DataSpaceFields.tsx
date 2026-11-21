"use client";

export type DataSpaceValues = { backup_name: string; backup_password: string; backup_password_confirmation: string };
export const emptyDataSpace: DataSpaceValues = { backup_name: "", backup_password: "", backup_password_confirmation: "" };

export function dataSpaceError(value: DataSpaceValues, passwordRequired = true): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,63}$/.test(value.backup_name.trim())) return "Donnez un nom de 3 à 64 caractères à votre espace de données : lettres sans accent, chiffres, tirets ou traits de soulignement.";
  if (passwordRequired || value.backup_password) {
    if ([...value.backup_password].length < 12) return "Le mot de passe de sauvegarde doit contenir au moins 12 caractères.";
    if (new TextEncoder().encode(value.backup_password).length > 72) return "Ce mot de passe est trop long. Utilisez moins de caractères.";
    if (value.backup_password !== value.backup_password_confirmation) return "Les deux mots de passe de sauvegarde ne correspondent pas.";
  }
  return "";
}

export default function DataSpaceFields({ value, onChange, disabled = false, configured = false }: {
  value: DataSpaceValues; onChange: (value: DataSpaceValues) => void; disabled?: boolean; configured?: boolean;
}) {
  const inputClass = "mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:bg-slate-50";
  return <div className="space-y-4">
    <label className="block text-sm font-semibold text-slate-700">Nom de l’espace de données
      <input name="backup_name" autoComplete="off" required minLength={3} maxLength={64} pattern="[a-zA-Z0-9][a-zA-Z0-9_\-]{2,63}"
        placeholder="Ex. : boutique_principale" value={value.backup_name} disabled={disabled}
        onChange={event => onChange({ ...value, backup_name: event.target.value })} className={inputClass} />
      <span className="mt-1 block text-xs font-normal text-slate-500">Ce nom sera utilisé pour votre fichier Excel. De 3 à 64 lettres sans accent, chiffres, tirets ou traits de soulignement.</span>
    </label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-semibold text-slate-700">{configured ? "Nouveau mot de passe de sauvegarde" : "Mot de passe de sauvegarde"}
        <input name="backup_password" type="password" autoComplete="new-password" required={!configured} minLength={12} maxLength={72}
          value={value.backup_password} disabled={disabled} onChange={event => onChange({ ...value, backup_password: event.target.value })} className={inputClass} />
        <span className="mt-1 block text-xs font-normal text-slate-500">Au moins 12 caractères.{configured ? " Laissez vide pour conserver le mot de passe actuel." : " Gardez-le dans un endroit sûr."}</span>
      </label>
      <label className="block text-sm font-semibold text-slate-700">Confirmer le mot de passe de sauvegarde
        <input name="backup_password_confirmation" type="password" autoComplete="new-password" required={!configured || !!value.backup_password} maxLength={72}
          value={value.backup_password_confirmation} disabled={disabled} onChange={event => onChange({ ...value, backup_password_confirmation: event.target.value })} className={inputClass} />
      </label>
    </div>
  </div>;
}
