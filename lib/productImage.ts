const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

const API_ORIGIN = (() => {
  try {
    return API_BASE ? new URL(API_BASE).origin : "";
  } catch {
    return "";
  }
})();

export const DEFAULT_PRODUCT_AVATAR_PATH = API_ORIGIN
  ? `${API_ORIGIN}/storage/products/default.png`
  : "/storage/products/default.png";

export function resolveProductImageUrl(imagePath: string | null | undefined): string {
  if (!imagePath) return DEFAULT_PRODUCT_AVATAR_PATH;

  const raw = imagePath.trim();
  if (!raw) return DEFAULT_PRODUCT_AVATAR_PATH;

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
