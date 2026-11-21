export type MobileDownloadSettings = {
  android_url: string | null;
  ios_url: string | null;
};

export type MobilePlatform = "android" | "ios";

export type MobileDownloadCard = {
  id: MobilePlatform;
  href: string;
  isDownload: boolean;
  qrSrc: string;
};

export function normalizeMobileDownloads(value: unknown): MobileDownloadSettings {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  function validUrl(value: unknown, appleOnly = false): string | null {
    if (typeof value !== "string" || !value.trim() || value.length > 2048) return null;
    try {
      const url = new URL(value.trim());
      if (url.protocol !== "https:" || url.username || url.password) return null;
      if (appleOnly && url.hostname !== "apps.apple.com") return null;
      return url.href;
    } catch {
      return null;
    }
  }
  return { android_url: validUrl(input.android_url), ios_url: validUrl(input.ios_url, true) };
}

export function mobileDestination(settings: MobileDownloadSettings, platform: MobilePlatform): string {
  return normalizeMobileDownloads(settings)[`${platform}_url`] ?? "/login";
}
