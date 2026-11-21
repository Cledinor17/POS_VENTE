"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { getGeoCountries, getGeoCountry, type GeoCountry, type GeoCountrySummary } from "@/lib/geoApi";

export type AddressValue = {
  line1: string;
  country: string;
  country_code: string;
  state: string;
  city: string;
  zip: string;
};

export const emptyAddress: AddressValue = { line1: "", country: "", country_code: "", state: "", city: "", zip: "" };

export function normalizeAddress(value?: Partial<Record<keyof AddressValue, string | null>> | null): AddressValue {
  return Object.fromEntries(Object.keys(emptyAddress).map(key => [key, value?.[key as keyof AddressValue] ?? ""])) as AddressValue;
}

export function selectAddressCountry(value: AddressValue, country: GeoCountrySummary | undefined): AddressValue {
  return { ...value, country: country?.name ?? "", country_code: country?.code ?? "", state: "", city: "" };
}

export function selectAddressState(value: AddressValue, name: string, country?: GeoCountry): AddressValue {
  const subdivision = country?.subdivisions.find(entry => entry.name === name);
  return { ...value, state: name, city: subdivision?.cities[0] ?? "" };
}

export default function AddressFields({ value, onChange, required = false, disabled = false }: {
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations("address");
  const id = useId();
  const [countries, setCountries] = useState<GeoCountrySummary[]>([]);
  const [details, setDetails] = useState<Record<string, GeoCountry>>({});
  const [failedCountry, setFailedCountry] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const code = value.country_code || countries.find(country => country.name === value.country)?.code || "";
  const detail = details[code];
  const cities = detail?.subdivisions.find(subdivision => subdivision.name === value.state)?.cities ?? [];

  useEffect(() => {
    let cancelled = false;
    getGeoCountries().then(list => { if (!cancelled) { setCountries(list); setFailedCountry(null); } })
      .catch(() => { if (!cancelled) setFailedCountry(""); });
    return () => { cancelled = true; };
  }, [retry]);

  useEffect(() => {
    if (!code || detail) return;
    let cancelled = false;
    getGeoCountry(code).then(country => {
      if (!cancelled) { setDetails(previous => ({ ...previous, [code]: country })); setFailedCountry(null); }
    }).catch(() => { if (!cancelled) setFailedCountry(code); });
    return () => { cancelled = true; };
  }, [code, detail, retry]);

  const fieldClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-[#0b4f88] disabled:bg-slate-50 disabled:text-slate-400";
  const failed = failedCountry === "" || (Boolean(code) && failedCountry === code);
  return (
    <fieldset disabled={disabled} className="space-y-4">
      <legend className="mb-3 text-sm font-semibold text-slate-800">{t("title")}</legend>
      <label className="block text-sm font-medium text-slate-700" htmlFor={`${id}-line1`}>
        {t("street")}
        <input id={`${id}-line1`} autoComplete="street-address" required={required} maxLength={255} value={value.line1}
          onChange={event => onChange({ ...value, line1: event.target.value })} className={fieldClass} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700" htmlFor={`${id}-country`}>
          {t("country")}
          <select id={`${id}-country`} autoComplete="country" required={required} value={code} className={fieldClass}
            onChange={event => onChange(selectAddressCountry(value, countries.find(country => country.code === event.target.value)))}>
            <option value="">{countries.length ? t("choose_country") : t("loading")}</option>
            {countries.map(country => <option key={country.code} value={country.code}>{country.name}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700" htmlFor={`${id}-state`}>
          {t("state")}
          <input id={`${id}-state`} list={`${id}-states`} autoComplete="address-level1" required={required} maxLength={120}
            disabled={!code} value={value.state} placeholder={!code ? t("choose_country_first") : t("choose_or_type")}
            onChange={event => onChange(selectAddressState(value, event.target.value, detail))} className={fieldClass} />
          <datalist id={`${id}-states`}>
            {(detail?.subdivisions ?? []).map(subdivision => <option key={subdivision.code} value={subdivision.name} />)}
          </datalist>
        </label>
        <label className="block text-sm font-medium text-slate-700" htmlFor={`${id}-city`}>
          {t("city")}
          <input id={`${id}-city`} list={`${id}-cities`} autoComplete="address-level2" required={required} maxLength={120}
            disabled={!value.state} value={value.city} placeholder={t("choose_or_type")}
            onChange={event => onChange({ ...value, city: event.target.value })} className={fieldClass} />
          <datalist id={`${id}-cities`}>{cities.map(city => <option key={city} value={city} />)}</datalist>
        </label>
        <label className="block text-sm font-medium text-slate-700" htmlFor={`${id}-zip`}>
          {t("zip")}
          <input id={`${id}-zip`} autoComplete="postal-code" maxLength={30} value={value.zip}
            onChange={event => onChange({ ...value, zip: event.target.value })} className={fieldClass} />
        </label>
      </div>
      <p className="text-xs leading-5 text-slate-500">{t("hint")}</p>
      {failed && <p role="status" className="text-sm text-amber-700">{t("error")} <button type="button" className="underline" onClick={() => setRetry(previous => previous + 1)}>{t("retry")}</button></p>}
    </fieldset>
  );
}
