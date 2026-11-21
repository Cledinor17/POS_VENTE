import "server-only";
import { BarcodeFormat, EncodeHintType, QRCodeWriter } from "@zxing/library";
import { mobileDestination, normalizeMobileDownloads, type MobileDownloadCard, type MobileDownloadSettings } from "./mobileDownloads";

export function mobileSiteOrigin(): string {
  // QR codes must be reachable from a phone, even when the page is previewed locally.
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://pos.haytinumeric.com";
  try {
    const url = new URL(configured);
    if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password) return url.origin;
  } catch { /* Use the deployed frontend below. */ }
  return "https://pos.haytinumeric.com";
}

export async function loadMobileDownloads(): Promise<MobileDownloadSettings> {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!apiBase) return normalizeMobileDownloads(null);
  try {
    const response = await fetch(`${apiBase}/api/public/mobile-downloads`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) return normalizeMobileDownloads(null);
    return normalizeMobileDownloads(await response.json());
  } catch {
    // The public landing page and web access still work if the API is unavailable.
    return normalizeMobileDownloads(null);
  }
}

export function mobileQrDataUrl(url: string): string {
  const matrix = new QRCodeWriter().encode(url, BarcodeFormat.QR_CODE, 0, 0,
    new Map([[EncodeHintType.MARGIN, 4]]));
  let path = "";
  for (let y = 0; y < matrix.getHeight(); y++) {
    for (let x = 0; x < matrix.getWidth(); x++) {
      if (matrix.get(x, y)) path += `M${x} ${y}h1v1h-1z`;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${matrix.getWidth()} ${matrix.getHeight()}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#0f2c59"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export function mobileDownloadCards(settings: MobileDownloadSettings): MobileDownloadCard[] {
  return (["android", "ios"] as const).map(id => {
    const href = mobileDestination(settings, id);
    return {
      id, href, isDownload: href !== "/login",
      // Stable QR addresses pick up future settings without reprinting the code.
      qrSrc: mobileQrDataUrl(`${mobileSiteOrigin()}/mobile/${id}`),
    };
  });
}
