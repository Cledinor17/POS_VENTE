"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  getBusinessSettings,
  getOnlineCurrencies,
  updateBusinessSettings,
  type BusinessSettings,
  type CurrencyOption,
} from "@/lib/businessApi";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";
const API_ORIGIN = (() => {
  try {
    return API_BASE ? new URL(API_BASE).origin : "";
  } catch {
    return "";
  }
})();

type PhoneDialOption = {
  value: string;
  dialCode: string;
  flag: string;
  label: string;
};

const DEFAULT_PHONE_DIAL_CODE = "+1";
const DEFAULT_PHONE_DIAL_SELECTION = "US:+1";
const PHONE_DIAL_OPTIONS: PhoneDialOption[] = [
  { value: "US:+1", dialCode: "+1", flag: "🇺🇸", label: "United States" },
  { value: "CA:+1", dialCode: "+1", flag: "🇨🇦", label: "Canada" },
  { value: "MX:+52", dialCode: "+52", flag: "🇲🇽", label: "Mexico" },
  { value: "BZ:+501", dialCode: "+501", flag: "🇧🇿", label: "Belize" },
  { value: "GT:+502", dialCode: "+502", flag: "🇬🇹", label: "Guatemala" },
  { value: "SV:+503", dialCode: "+503", flag: "🇸🇻", label: "El Salvador" },
  { value: "HN:+504", dialCode: "+504", flag: "🇭🇳", label: "Honduras" },
  { value: "NI:+505", dialCode: "+505", flag: "🇳🇮", label: "Nicaragua" },
  { value: "CR:+506", dialCode: "+506", flag: "🇨🇷", label: "Costa Rica" },
  { value: "PA:+507", dialCode: "+507", flag: "🇵🇦", label: "Panama" },
  { value: "CU:+53", dialCode: "+53", flag: "🇨🇺", label: "Cuba" },
  { value: "HT:+509", dialCode: "+509", flag: "🇭🇹", label: "Haiti" },
  { value: "AG:+1 268", dialCode: "+1 268", flag: "🇦🇬", label: "Antigua and Barbuda" },
  { value: "BS:+1 242", dialCode: "+1 242", flag: "🇧🇸", label: "Bahamas" },
  { value: "BB:+1 246", dialCode: "+1 246", flag: "🇧🇧", label: "Barbados" },
  { value: "DM:+1 767", dialCode: "+1 767", flag: "🇩🇲", label: "Dominica" },
  { value: "DO:+1 809", dialCode: "+1 809", flag: "🇩🇴", label: "Dominican Republic" },
  { value: "GD:+1 473", dialCode: "+1 473", flag: "🇬🇩", label: "Grenada" },
  { value: "JM:+1 876", dialCode: "+1 876", flag: "🇯🇲", label: "Jamaica" },
  { value: "KN:+1 869", dialCode: "+1 869", flag: "🇰🇳", label: "Saint Kitts and Nevis" },
  { value: "LC:+1 758", dialCode: "+1 758", flag: "🇱🇨", label: "Saint Lucia" },
  { value: "VC:+1 784", dialCode: "+1 784", flag: "🇻🇨", label: "Saint Vincent and the Grenadines" },
  { value: "TT:+1 868", dialCode: "+1 868", flag: "🇹🇹", label: "Trinidad and Tobago" },
  { value: "AR:+54", dialCode: "+54", flag: "🇦🇷", label: "Argentina" },
  { value: "BO:+591", dialCode: "+591", flag: "🇧🇴", label: "Bolivia" },
  { value: "BR:+55", dialCode: "+55", flag: "🇧🇷", label: "Brazil" },
  { value: "CL:+56", dialCode: "+56", flag: "🇨🇱", label: "Chile" },
  { value: "CO:+57", dialCode: "+57", flag: "🇨🇴", label: "Colombia" },
  { value: "EC:+593", dialCode: "+593", flag: "🇪🇨", label: "Ecuador" },
  { value: "GY:+592", dialCode: "+592", flag: "🇬🇾", label: "Guyana" },
  { value: "PY:+595", dialCode: "+595", flag: "🇵🇾", label: "Paraguay" },
  { value: "PE:+51", dialCode: "+51", flag: "🇵🇪", label: "Peru" },
  { value: "SR:+597", dialCode: "+597", flag: "🇸🇷", label: "Suriname" },
  { value: "UY:+598", dialCode: "+598", flag: "🇺🇾", label: "Uruguay" },
  { value: "VE:+58", dialCode: "+58", flag: "🇻🇪", label: "Venezuela" },
  { value: "AL:+355", dialCode: "+355", flag: "🇦🇱", label: "Albania" },
  { value: "AD:+376", dialCode: "+376", flag: "🇦🇩", label: "Andorra" },
  { value: "AM:+374", dialCode: "+374", flag: "🇦🇲", label: "Armenia" },
  { value: "AT:+43", dialCode: "+43", flag: "🇦🇹", label: "Austria" },
  { value: "AZ:+994", dialCode: "+994", flag: "🇦🇿", label: "Azerbaijan" },
  { value: "BY:+375", dialCode: "+375", flag: "🇧🇾", label: "Belarus" },
  { value: "BE:+32", dialCode: "+32", flag: "🇧🇪", label: "Belgium" },
  { value: "BA:+387", dialCode: "+387", flag: "🇧🇦", label: "Bosnia and Herzegovina" },
  { value: "BG:+359", dialCode: "+359", flag: "🇧🇬", label: "Bulgaria" },
  { value: "HR:+385", dialCode: "+385", flag: "🇭🇷", label: "Croatia" },
  { value: "CY:+357", dialCode: "+357", flag: "🇨🇾", label: "Cyprus" },
  { value: "CZ:+420", dialCode: "+420", flag: "🇨🇿", label: "Czech Republic" },
  { value: "DK:+45", dialCode: "+45", flag: "🇩🇰", label: "Denmark" },
  { value: "EE:+372", dialCode: "+372", flag: "🇪🇪", label: "Estonia" },
  { value: "FI:+358", dialCode: "+358", flag: "🇫🇮", label: "Finland" },
  { value: "FR:+33", dialCode: "+33", flag: "🇫🇷", label: "France" },
  { value: "GE:+995", dialCode: "+995", flag: "🇬🇪", label: "Georgia" },
  { value: "DE:+49", dialCode: "+49", flag: "🇩🇪", label: "Germany" },
  { value: "GR:+30", dialCode: "+30", flag: "🇬🇷", label: "Greece" },
  { value: "HU:+36", dialCode: "+36", flag: "🇭🇺", label: "Hungary" },
  { value: "IS:+354", dialCode: "+354", flag: "🇮🇸", label: "Iceland" },
  { value: "IE:+353", dialCode: "+353", flag: "🇮🇪", label: "Ireland" },
  { value: "IT:+39", dialCode: "+39", flag: "🇮🇹", label: "Italy" },
  { value: "XK:+383", dialCode: "+383", flag: "🇽🇰", label: "Kosovo" },
  { value: "LV:+371", dialCode: "+371", flag: "🇱🇻", label: "Latvia" },
  { value: "LI:+423", dialCode: "+423", flag: "🇱🇮", label: "Liechtenstein" },
  { value: "LT:+370", dialCode: "+370", flag: "🇱🇹", label: "Lithuania" },
  { value: "LU:+352", dialCode: "+352", flag: "🇱🇺", label: "Luxembourg" },
  { value: "MT:+356", dialCode: "+356", flag: "🇲🇹", label: "Malta" },
  { value: "MD:+373", dialCode: "+373", flag: "🇲🇩", label: "Moldova" },
  { value: "MC:+377", dialCode: "+377", flag: "🇲🇨", label: "Monaco" },
  { value: "ME:+382", dialCode: "+382", flag: "🇲🇪", label: "Montenegro" },
  { value: "NL:+31", dialCode: "+31", flag: "🇳🇱", label: "Netherlands" },
  { value: "MK:+389", dialCode: "+389", flag: "🇲🇰", label: "North Macedonia" },
  { value: "NO:+47", dialCode: "+47", flag: "🇳🇴", label: "Norway" },
  { value: "PL:+48", dialCode: "+48", flag: "🇵🇱", label: "Poland" },
  { value: "PT:+351", dialCode: "+351", flag: "🇵🇹", label: "Portugal" },
  { value: "RO:+40", dialCode: "+40", flag: "🇷🇴", label: "Romania" },
  { value: "RU:+7", dialCode: "+7", flag: "🇷🇺", label: "Russia" },
  { value: "SM:+378", dialCode: "+378", flag: "🇸🇲", label: "San Marino" },
  { value: "RS:+381", dialCode: "+381", flag: "🇷🇸", label: "Serbia" },
  { value: "SK:+421", dialCode: "+421", flag: "🇸🇰", label: "Slovakia" },
  { value: "SI:+386", dialCode: "+386", flag: "🇸🇮", label: "Slovenia" },
  { value: "ES:+34", dialCode: "+34", flag: "🇪🇸", label: "Spain" },
  { value: "SE:+46", dialCode: "+46", flag: "🇸🇪", label: "Sweden" },
  { value: "CH:+41", dialCode: "+41", flag: "🇨🇭", label: "Switzerland" },
  { value: "TR:+90", dialCode: "+90", flag: "🇹🇷", label: "Turkey" },
  { value: "UA:+380", dialCode: "+380", flag: "🇺🇦", label: "Ukraine" },
  { value: "GB:+44", dialCode: "+44", flag: "🇬🇧", label: "United Kingdom" },
  { value: "VA:+379", dialCode: "+379", flag: "🇻🇦", label: "Vatican City" },
  { value: "DZ:+213", dialCode: "+213", flag: "🇩🇿", label: "Algeria" },
  { value: "AO:+244", dialCode: "+244", flag: "🇦🇴", label: "Angola" },
  { value: "BJ:+229", dialCode: "+229", flag: "🇧🇯", label: "Benin" },
  { value: "BW:+267", dialCode: "+267", flag: "🇧🇼", label: "Botswana" },
  { value: "BF:+226", dialCode: "+226", flag: "🇧🇫", label: "Burkina Faso" },
  { value: "BI:+257", dialCode: "+257", flag: "🇧🇮", label: "Burundi" },
  { value: "CV:+238", dialCode: "+238", flag: "🇨🇻", label: "Cabo Verde" },
  { value: "CM:+237", dialCode: "+237", flag: "🇨🇲", label: "Cameroon" },
  { value: "CF:+236", dialCode: "+236", flag: "🇨🇫", label: "Central African Republic" },
  { value: "TD:+235", dialCode: "+235", flag: "🇹🇩", label: "Chad" },
  { value: "KM:+269", dialCode: "+269", flag: "🇰🇲", label: "Comoros" },
  { value: "CG:+242", dialCode: "+242", flag: "🇨🇬", label: "Congo (Republic)" },
  { value: "CD:+243", dialCode: "+243", flag: "🇨🇩", label: "Congo (DRC)" },
  { value: "DJ:+253", dialCode: "+253", flag: "🇩🇯", label: "Djibouti" },
  { value: "EG:+20", dialCode: "+20", flag: "🇪🇬", label: "Egypt" },
  { value: "GQ:+240", dialCode: "+240", flag: "🇬🇶", label: "Equatorial Guinea" },
  { value: "ER:+291", dialCode: "+291", flag: "🇪🇷", label: "Eritrea" },
  { value: "SZ:+268", dialCode: "+268", flag: "🇸🇿", label: "Eswatini" },
  { value: "ET:+251", dialCode: "+251", flag: "🇪🇹", label: "Ethiopia" },
  { value: "GA:+241", dialCode: "+241", flag: "🇬🇦", label: "Gabon" },
  { value: "GM:+220", dialCode: "+220", flag: "🇬🇲", label: "Gambia" },
  { value: "GH:+233", dialCode: "+233", flag: "🇬🇭", label: "Ghana" },
  { value: "GN:+224", dialCode: "+224", flag: "🇬🇳", label: "Guinea" },
  { value: "GW:+245", dialCode: "+245", flag: "🇬🇼", label: "Guinea-Bissau" },
  { value: "CI:+225", dialCode: "+225", flag: "🇨🇮", label: "Ivory Coast" },
  { value: "KE:+254", dialCode: "+254", flag: "🇰🇪", label: "Kenya" },
  { value: "LS:+266", dialCode: "+266", flag: "🇱🇸", label: "Lesotho" },
  { value: "LR:+231", dialCode: "+231", flag: "🇱🇷", label: "Liberia" },
  { value: "LY:+218", dialCode: "+218", flag: "🇱🇾", label: "Libya" },
  { value: "MG:+261", dialCode: "+261", flag: "🇲🇬", label: "Madagascar" },
  { value: "MW:+265", dialCode: "+265", flag: "🇲🇼", label: "Malawi" },
  { value: "ML:+223", dialCode: "+223", flag: "🇲🇱", label: "Mali" },
  { value: "MR:+222", dialCode: "+222", flag: "🇲🇷", label: "Mauritania" },
  { value: "MU:+230", dialCode: "+230", flag: "🇲🇺", label: "Mauritius" },
  { value: "MA:+212", dialCode: "+212", flag: "🇲🇦", label: "Morocco" },
  { value: "MZ:+258", dialCode: "+258", flag: "🇲🇿", label: "Mozambique" },
  { value: "NA:+264", dialCode: "+264", flag: "🇳🇦", label: "Namibia" },
  { value: "NE:+227", dialCode: "+227", flag: "🇳🇪", label: "Niger" },
  { value: "NG:+234", dialCode: "+234", flag: "🇳🇬", label: "Nigeria" },
  { value: "RW:+250", dialCode: "+250", flag: "🇷🇼", label: "Rwanda" },
  { value: "ST:+239", dialCode: "+239", flag: "🇸🇹", label: "Sao Tome and Principe" },
  { value: "SN:+221", dialCode: "+221", flag: "🇸🇳", label: "Senegal" },
  { value: "SC:+248", dialCode: "+248", flag: "🇸🇨", label: "Seychelles" },
  { value: "SL:+232", dialCode: "+232", flag: "🇸🇱", label: "Sierra Leone" },
  { value: "SO:+252", dialCode: "+252", flag: "🇸🇴", label: "Somalia" },
  { value: "ZA:+27", dialCode: "+27", flag: "🇿🇦", label: "South Africa" },
  { value: "SS:+211", dialCode: "+211", flag: "🇸🇸", label: "South Sudan" },
  { value: "SD:+249", dialCode: "+249", flag: "🇸🇩", label: "Sudan" },
  { value: "TZ:+255", dialCode: "+255", flag: "🇹🇿", label: "Tanzania" },
  { value: "TG:+228", dialCode: "+228", flag: "🇹🇬", label: "Togo" },
  { value: "TN:+216", dialCode: "+216", flag: "🇹🇳", label: "Tunisia" },
  { value: "UG:+256", dialCode: "+256", flag: "🇺🇬", label: "Uganda" },
  { value: "ZM:+260", dialCode: "+260", flag: "🇿🇲", label: "Zambia" },
  { value: "ZW:+263", dialCode: "+263", flag: "🇿🇼", label: "Zimbabwe" },
];
const PHONE_DIAL_CODES_BY_LENGTH = PHONE_DIAL_OPTIONS
  .map((item) => item.dialCode)
  .filter((item, index, list) => list.indexOf(item) === index)
  .sort((a, b) => b.length - a.length);

function getDialCodeFromSelection(selection: string): string {
  return (
    PHONE_DIAL_OPTIONS.find((item) => item.value === selection)?.dialCode ??
    selection
  );
}

function getSelectionFromDialCode(dialCode: string): string {
  return (
    PHONE_DIAL_OPTIONS.find((item) => item.dialCode === dialCode)?.value ??
    dialCode
  );
}

type BusinessFormState = {
  name: string;
  legalName: string;
  email: string;
  phone: string;
  website: string;
  taxNumber: string;
  currency: string;
  timezone: string;
  invoiceFooter: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

const initialFormState: BusinessFormState = {
  name: "",
  legalName: "",
  email: "",
  phone: "",
  website: "",
  taxNumber: "",
  currency: "",
  timezone: "",
  invoiceFooter: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  zip: "",
  country: "",
};

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue.";
}

function toFormState(data: BusinessSettings): BusinessFormState {
  return {
    name: data.name ?? "",
    legalName: data.legal_name ?? "",
    email: data.email ?? "",
    phone: data.phone ?? "",
    website: data.website ?? "",
    taxNumber: data.tax_number ?? "",
    currency: data.currency ?? "",
    timezone: data.timezone ?? "",
    invoiceFooter: data.invoice_footer ?? "",
    line1: data.address?.line1 ?? "",
    line2: data.address?.line2 ?? "",
    city: data.address?.city ?? "",
    state: data.address?.state ?? "",
    zip: data.address?.zip ?? "",
    country: data.address?.country ?? "",
  };
}

function resolveLogoUrl(data: BusinessSettings): string {
  const raw = (data.logo_url || data.logo_path || "").trim();
  if (!raw) return "";
  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("data:") ||
    raw.startsWith("blob:")
  ) {
    return raw;
  }

  const normalized = raw.replace(/^\/+/, "");
  const relative = normalized.startsWith("storage/")
    ? normalized
    : `storage/${normalized}`;

  return API_ORIGIN ? `${API_ORIGIN}/${relative}` : `/${relative}`;
}

function parseBusinessPhone(rawPhone: string): { dialCode: string; number: string } {
  const value = rawPhone.trim();
  if (!value) {
    return { dialCode: DEFAULT_PHONE_DIAL_CODE, number: "" };
  }

  const compact = value.replace(/\s+/g, " ").trim();

  for (const code of PHONE_DIAL_CODES_BY_LENGTH) {
    if (compact === code) {
      return { dialCode: code, number: "" };
    }
    if (compact.startsWith(`${code} `)) {
      return { dialCode: code, number: compact.slice(code.length).trim() };
    }
    if (compact.startsWith(code)) {
      const rest = compact.slice(code.length).trim();
      if (rest.length > 0) {
        return { dialCode: code, number: rest };
      }
    }
  }

  const generic = compact.match(/^(\+\d{1,4})\s*(.*)$/);
  if (generic) {
    return {
      dialCode: generic[1],
      number: (generic[2] ?? "").trim(),
    };
  }

  return { dialCode: DEFAULT_PHONE_DIAL_CODE, number: compact };
}

function validateForm(form: BusinessFormState): string {
  if (form.name.trim().length < 2) {
    return "Le nom du business est obligatoire (min 2 caracteres).";
  }
  if (form.email.trim().length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return "L'email n'est pas valide.";
  }
  return "";
}

export default function BusinessPage() {
  const params = useParams<{ business: string }>();
  const business = params?.business ?? "";

  const [form, setForm] = useState<BusinessFormState>(initialFormState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");
  const [currentLogoUrl, setCurrentLogoUrl] = useState("");
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);
  const [phoneDialCode, setPhoneDialCode] = useState(DEFAULT_PHONE_DIAL_SELECTION);
  const [customPhoneDialCode, setCustomPhoneDialCode] = useState("");
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyOption[]>([]);
  const [currenciesLoading, setCurrenciesLoading] = useState(false);
  const displayedLogoUrl = logoPreviewUrl || (logoLoadFailed ? "" : currentLogoUrl);
  const currencySelectOptions = useMemo(() => {
    const byCode = new Map<string, CurrencyOption>();
    for (const item of currencyOptions) {
      byCode.set(item.code, item);
    }

    const currentCode = form.currency.trim().toUpperCase();
    if (currentCode && !byCode.has(currentCode)) {
      byCode.set(currentCode, { code: currentCode, name: currentCode });
    }

    return Array.from(byCode.values()).sort((a, b) =>
      a.code.localeCompare(b.code),
    );
  }, [currencyOptions, form.currency]);
  const phoneDialOptions = useMemo(() => {
    const existsInBase = PHONE_DIAL_OPTIONS.some(
      (item) =>
        item.value === customPhoneDialCode || item.dialCode === customPhoneDialCode,
    );

    if (!customPhoneDialCode || existsInBase) {
      return PHONE_DIAL_OPTIONS;
    }

    return [
      {
        value: customPhoneDialCode,
        dialCode: customPhoneDialCode,
        flag: "🏳️",
        label: "Custom",
      },
      ...PHONE_DIAL_OPTIONS,
    ];
  }, [customPhoneDialCode]);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [logoFile]);

  useEffect(() => {
    setLogoLoadFailed(false);
  }, [logoPreviewUrl, currentLogoUrl]);

  useEffect(() => {
    let mounted = true;

    async function loadCurrencies() {
      setCurrenciesLoading(true);
      try {
        const data = await getOnlineCurrencies();
        if (!mounted) return;
        setCurrencyOptions(data);
      } catch {
        if (mounted) setCurrencyOptions([]);
      } finally {
        if (mounted) setCurrenciesLoading(false);
      }
    }

    void loadCurrencies();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadBusiness() {
      if (!business) return;
      setLoading(true);
      setError("");
      setSuccess("");

      try {
        const data = await getBusinessSettings(business);
        if (!mounted) return;
        const parsedPhone = parseBusinessPhone(data.phone ?? "");
        const nextForm = toFormState(data);
        nextForm.phone = parsedPhone.number;
        setForm(nextForm);
        setPhoneDialCode(getSelectionFromDialCode(parsedPhone.dialCode));
        setCustomPhoneDialCode(
          PHONE_DIAL_OPTIONS.some((item) => item.dialCode === parsedPhone.dialCode)
            ? ""
            : parsedPhone.dialCode,
        );
        setCurrentLogoUrl(resolveLogoUrl(data));
        setLogoFile(null);
      } catch (e) {
        if (mounted) setError(getErrorMessage(e));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadBusiness();
    return () => {
      mounted = false;
    };
  }, [business]);

  function setField<K extends keyof BusinessFormState>(
    key: K,
    value: BusinessFormState[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const validationMessage = validateForm(form);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setSaving(true);
    try {
      const phoneValue = form.phone.trim();
      const selectedDialCode =
        phoneDialOptions.find((item) => item.value === phoneDialCode)?.dialCode ??
        getDialCodeFromSelection(phoneDialCode);
      const fullPhone = phoneValue ? `${selectedDialCode} ${phoneValue}`.trim() : "";

      const updated = await updateBusinessSettings(business, {
        name: form.name.trim(),
        legal_name: form.legalName.trim(),
        email: form.email.trim(),
        phone: fullPhone,
        website: form.website.trim(),
        tax_number: form.taxNumber.trim(),
        currency: form.currency.trim(),
        timezone: form.timezone.trim(),
        invoice_footer: form.invoiceFooter.trim(),
        address: {
          line1: form.line1.trim(),
          line2: form.line2.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          zip: form.zip.trim(),
          country: form.country.trim(),
        },
        logoFile,
      });

      const parsedPhone = parseBusinessPhone(updated.phone ?? "");
      const nextForm = toFormState(updated);
      nextForm.phone = parsedPhone.number;
      setForm(nextForm);
      setPhoneDialCode(getSelectionFromDialCode(parsedPhone.dialCode));
      setCustomPhoneDialCode(
        PHONE_DIAL_OPTIONS.some((item) => item.dialCode === parsedPhone.dialCode)
          ? ""
          : parsedPhone.dialCode,
      );
      setCurrentLogoUrl(resolveLogoUrl(updated));
      setLogoFile(null);
      setSuccess("Informations du business mises a jour.");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const isSubmitDisabled = useMemo(
    () => loading || saving || !business,
    [loading, saving, business],
  );

  return (
    <div className="space-y-6">
      <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">MY Business</h1>
            <p className="text-slate-500 mt-1">
              Modifie les informations du business actif.
            </p>
          </div>
          <Link
            href={business ? `/${business}/settings` : "/"}
            className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Retour Parametres
          </Link>
        </div>
      </section>

      <form
        onSubmit={onSubmit}
        className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5"
      >
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        {loading ? (
          <div className="py-6 text-center text-slate-500">
            Chargement des informations business...
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nom business *">
            <input
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </Field>

          <Field label="Raison sociale">
            <input
              value={form.legalName}
              onChange={(event) => setField("legalName", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </Field>

          <Field label="Email">
            <input
              value={form.email}
              onChange={(event) => setField("email", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </Field>

          <Field label="Telephone">
            <div className="flex gap-2">
              <select
                value={phoneDialCode}
                onChange={(event) => setPhoneDialCode(event.target.value)}
                className="w-44 rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                {phoneDialOptions.map((item) => (
                  <option key={item.value} value={item.value} title={item.label}>
                    {item.flag} {item.dialCode} {item.label}
                  </option>
                ))}
              </select>
              <input
                value={form.phone}
                onChange={(event) => setField("phone", event.target.value)}
                placeholder="Numero"
                className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </Field>

          <Field label="Site web">
            <input
              value={form.website}
              onChange={(event) => setField("website", event.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </Field>

          <Field label="Tax number / NIF">
            <input
              value={form.taxNumber}
              onChange={(event) => setField("taxNumber", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </Field>

          <Field label="Devise">
            <select
              value={form.currency}
              onChange={(event) =>
                setField("currency", event.target.value.toUpperCase())
              }
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Selectionner une devise</option>

              {currenciesLoading ? (
                <option value={form.currency || ""}>Chargement des devises...</option>
              ) : null}

              {!currenciesLoading && currencySelectOptions.length === 0 ? (
                <option value={form.currency || ""}>
                  {form.currency || "Aucune devise disponible"}
                </option>
              ) : null}

              {currencySelectOptions.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.code} - {item.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Timezone">
            <input
              value={form.timezone}
              onChange={(event) => setField("timezone", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </Field>

          <div className="md:col-span-2">
            <Field label="Logo (logo_path)">
              <div className="space-y-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    setLogoFile(event.target.files?.[0] ?? null)
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />

                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                    {displayedLogoUrl ? (
                      <img
                        src={displayedLogoUrl}
                        alt="Logo business"
                        className="h-full w-full object-cover"
                        onError={() => setLogoLoadFailed(true)}
                      />
                    ) : (
                      <span>{(form.name.trim().slice(0, 1) || "B").toUpperCase()}</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {logoFile
                      ? `Nouveau logo: ${logoFile.name}`
                      : currentLogoUrl
                        ? "Aucun nouveau logo choisi: le logo actuel sera conserve."
                        : "Aucun logo defini. Selectionne une image pour ajouter le logo."}
                  </div>
                </div>
              </div>
            </Field>
          </div>

          <div className="md:col-span-2">
            <div className="text-sm font-semibold text-slate-700 mb-1.5">Adresse</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                value={form.line1}
                onChange={(event) => setField("line1", event.target.value)}
                placeholder="Ligne 1"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <input
                value={form.line2}
                onChange={(event) => setField("line2", event.target.value)}
                placeholder="Ligne 2"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <input
                value={form.city}
                onChange={(event) => setField("city", event.target.value)}
                placeholder="Ville"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <input
                value={form.state}
                onChange={(event) => setField("state", event.target.value)}
                placeholder="Region / Etat"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <input
                value={form.zip}
                onChange={(event) => setField("zip", event.target.value)}
                placeholder="Code postal"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <input
                value={form.country}
                onChange={(event) => setField("country", event.target.value)}
                placeholder="Pays"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <Field label="Pied de facture">
              <textarea
                rows={4}
                value={form.invoiceFooter}
                onChange={(event) => setField("invoiceFooter", event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </Field>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="inline-flex items-center justify-center rounded-xl brand-primary-btn px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Enregistrement..." : "Enregistrer les modifications"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
