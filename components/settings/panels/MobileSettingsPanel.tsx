"use client";
import type { SettingsPanelProps } from "../types";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { ApiError, apiFetch } from "@/lib/api";
import { normalizeMobileDownloads, type MobileDownloadSettings } from "@/lib/mobileDownloads";

export default function MobileSettingsPanel({ embedded = false }: SettingsPanelProps = {}) {
  const Heading = embedded ? "h2" : "h1";
  const t = useTranslations("landing.mobile.settings");
  const { user, loading: authLoading } = useAuth();
  const canEdit = user?.is_platform_admin === true;
  const [draft, setDraft] = useState<MobileDownloadSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!canEdit) return;
    const controller = new AbortController();
    apiFetch<MobileDownloadSettings>("/api/public/mobile-downloads", { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setDraft(normalizeMobileDownloads(data)); })
      .catch(cause => {
        if (!controller.signal.aborted) setError(cause instanceof ApiError ? cause.message : t("loadError"));
      });
    return () => controller.abort();
  }, [canEdit, reload, t]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || saving) return;
    setSaving(true); setError(""); setSaved(false);
    try {
      const result = await apiFetch<MobileDownloadSettings>("/api/platform/mobile-downloads", {
        method: "PUT",
        json: { android_url: draft.android_url?.trim() || null, ios_url: draft.ios_url?.trim() || null },
      });
      setDraft(normalizeMobileDownloads(result));
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) return <p className="p-6 text-slate-500">{t("loading")}</p>;
  if (!canEdit) return <p className="p-6 text-slate-600">{t("restricted")}</p>;

  return (
    <section className="max-w-3xl space-y-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <div>
        <Heading className="text-2xl font-bold text-slate-900">{t("title")}</Heading>
        <p className="mt-2 text-slate-500">{t("description")}</p>
      </div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {saved && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-700">{t("saved")}</p>}
      {!draft ? (
        error ? <button type="button" className="font-semibold text-[#0d63b8]" onClick={() => { setError(""); setReload(value => value + 1); }}>{t("retry")}</button>
          : <p className="text-slate-500">{t("loading")}</p>
      ) : (
        <form onSubmit={save}>
          <fieldset disabled={saving} className="space-y-5 disabled:opacity-60">
            <div>
              <label htmlFor="android-url" className="block font-semibold text-slate-800">{t("android")}</label>
              <input id="android-url" type="url" dir="ltr" maxLength={2048} pattern="https://.*" value={draft.android_url ?? ""}
                autoComplete="off" aria-describedby="android-help" placeholder="https://.../application.apk"
                onChange={event => { setDraft({ ...draft, android_url: event.target.value }); setSaved(false); }}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-blue-500 focus:outline-none" />
              <p id="android-help" className="mt-1 text-sm text-slate-500">{t("androidHelp")}</p>
            </div>
            <div>
              <label htmlFor="ios-url" className="block font-semibold text-slate-800">{t("ios")}</label>
              <input id="ios-url" type="url" dir="ltr" maxLength={2048} pattern="https://.*" value={draft.ios_url ?? ""}
                autoComplete="off" aria-describedby="ios-help" placeholder="https://apps.apple.com/..."
                onChange={event => { setDraft({ ...draft, ios_url: event.target.value }); setSaved(false); }}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-blue-500 focus:outline-none" />
              <p id="ios-help" className="mt-1 text-sm text-slate-500">{t("iosHelp")}</p>
            </div>
            <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">{t("fallback")}</p>
            <div className="flex flex-wrap items-center gap-4">
              <button type="submit" className="rounded-xl bg-[#0f2c59] px-5 py-3 font-semibold text-white disabled:cursor-wait">
                {t(saving ? "saving" : "save")}
              </button>
              <a href="/" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0d63b8]">{t("preview")}</a>
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}
