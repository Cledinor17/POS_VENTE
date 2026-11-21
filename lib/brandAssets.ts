/**
 * Resolve a tenant-uploaded logo returned by the existing business settings API.
 * The fallback matches Sidebar and business settings screens.
 */
export function resolveBusinessBrandLogo(logoUrl?: string | null, logoPath?: string | null): string | null {
  const value = (logoUrl || logoPath || "").trim();
  if (!value) return null;

  // Only images over HTTP(S) or approved image data URLs are usable as icons.
  if (/^https?:\/\//i.test(value)) return value;
  if (/^data:image\/(?:png|jpeg|gif|webp|svg\+xml);/i.test(value)) return value;
  if (/^(?:blob:|javascript:|data:)/i.test(value)) return null;

  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
  const path = value.replace(/^\/+/, "");
  const relative = path.startsWith("storage/") ? path : `storage/${path}`;
  return base ? `${base}/${relative}` : `/${relative}`;
}
