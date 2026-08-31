import { parsePhoneNumberWithError } from "libphonenumber-js";

/**
 * Formats a stored E.164 phone number (e.g. "+50936101234") for read-only
 * display in national style (e.g. "36 10 1234"). Falls back to the raw
 * value when it isn't a parseable phone number.
 */
export function formatPhoneDisplay(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";

  try {
    const parsed = parsePhoneNumberWithError(raw);
    return parsed.formatNational();
  } catch {
    return raw;
  }
}

/**
 * Normalizes a phone number into strict E.164 (e.g. "+50936101234", no
 * spaces/dashes). react-phone-number-input requires strict E.164 for its
 * controlled `value` prop and throws otherwise — this is needed because
 * some records predate E.164-only storage and hold a "pretty" formatted
 * value (e.g. "+509 3610-0000"). Returns null when the value can't be
 * turned into a valid phone number at all.
 */
export function toE164(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;

  try {
    return parsePhoneNumberWithError(raw).number;
  } catch {
    const stripped = raw.replace(/(?!^\+)[^\d]/g, "");
    return stripped.startsWith("+") ? stripped : null;
  }
}
