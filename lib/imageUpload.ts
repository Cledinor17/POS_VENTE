import { ApiError } from "./api";
import { getErrorMessage } from "./errors";

// ProfileController and ProductController both validate max:2048 (KiB).
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

type ImageFile = Pick<File, "size">;
type Translate = (key: "too_large" | "server_too_large" | "network_error", values?: Record<string, string>) => string;

export class ImageSizeError extends Error {
  constructor(public readonly size: number) {
    super("Cette image dépasse la taille maximale de 2 Mo.");
    this.name = "ImageSizeError";
  }
}

export function assertImageSize(file: ImageFile): void {
  if (file.size > MAX_IMAGE_BYTES) throw new ImageSizeError(file.size);
}

export function formatImageSize(bytes: number, locale: string): string {
  const inMegabytes = bytes >= 1024 * 1024;
  const divisor = inMegabytes ? 1024 * 1024 : 1024;
  // Round upwards so a file just above the limit never appears to fit it.
  const size = Math.ceil((bytes / divisor) * 100) / 100;
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: inMegabytes ? "megabyte" : "kilobyte",
    maximumFractionDigits: 2,
  }).format(size);
}

export function imageSizeMessage(file: ImageFile | null, t: Translate, locale: string): string {
  if (!file || file.size <= MAX_IMAGE_BYTES) return "";
  return t("too_large", {
    size: formatImageSize(file.size, locale),
    maxSize: formatImageSize(MAX_IMAGE_BYTES, locale),
  });
}

export function imageUploadErrorMessage(error: unknown, t: Translate, locale: string, fallback: string): string {
  if (error instanceof ImageSizeError) return imageSizeMessage(error, t, locale);
  if (error instanceof ApiError && error.status === 413) return t("server_too_large");
  // A CORS-blocked 413 is indistinguishable from other network failures in JS.
  if (error instanceof TypeError) return t("network_error");
  return getErrorMessage(error, fallback);
}
