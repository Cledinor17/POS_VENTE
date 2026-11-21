import { NextRequest, NextResponse } from "next/server";
import { mobileDestination } from "@/lib/mobileDownloads";
import { loadMobileDownloads, mobileSiteOrigin } from "@/lib/mobileDownloadsServer";

export async function GET(request: NextRequest, context: { params: Promise<{ platform: string }> }) {
  const { platform } = await context.params;
  if (platform !== "android" && platform !== "ios") {
    return new NextResponse(null, { status: 404 });
  }
  const href = mobileDestination(await loadMobileDownloads(), platform);
  // Use the public origin, not a reverse proxy's internal localhost URL.
  const response = NextResponse.redirect(new URL(href, mobileSiteOrigin()), 307);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
