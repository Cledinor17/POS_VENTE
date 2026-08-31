"use client";

import PhoneInput, { type Country } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import en from "react-phone-number-input/locale/en.json";
import fr from "react-phone-number-input/locale/fr.json";
import es from "react-phone-number-input/locale/es.json";
import zh from "react-phone-number-input/locale/zh.json";
import ar from "react-phone-number-input/locale/ar.json";
import { useLocale } from "next-intl";
import type { Locale } from "@/lib/locale";
import { toE164 } from "@/lib/phone";

// react-phone-number-input has no Haitian Creole label set; French is the
// closest available (Haiti's other official language), used as a fallback.
const COUNTRY_LABELS: Record<Locale, typeof en> = { en, fr, es, ht: fr, zh, ar };

type PhoneFieldProps = {
  value: string | null | undefined;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
  compact?: boolean;
  disabled?: boolean;
  defaultCountry?: Country;
};

export default function PhoneField({
  value,
  onChange,
  id,
  placeholder,
  className = "",
  compact = false,
  disabled = false,
  defaultCountry = "HT" as Country,
}: PhoneFieldProps) {
  const locale = useLocale() as Locale;

  return (
    <PhoneInput
      id={id}
      value={toE164(value) || undefined}
      onChange={(next) => onChange(next || "")}
      defaultCountry={defaultCountry}
      international
      disabled={disabled}
      placeholder={placeholder}
      labels={COUNTRY_LABELS[locale] ?? en}
      className={`pos-phone-field rounded-xl border border-slate-200 bg-white px-3 ${
        compact ? "py-1.5 text-sm" : "py-2.5"
      } outline-none transition focus-within:border-[#0d63b8] focus-within:ring-2 focus-within:ring-blue-500/20 ${className}`.trim()}
      numberInputProps={{
        className: "w-full border-0 bg-transparent outline-none",
      }}
    />
  );
}
