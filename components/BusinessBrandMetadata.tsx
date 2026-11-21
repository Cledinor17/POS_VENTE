"use client";

import { useEffect } from "react";
import { getPosSettings } from "@/lib/businessApi";
import { resolveBusinessBrandLogo } from "@/lib/brandAssets";

/**
 * Per-business browser tab icon and document title.
 * Uses the same existing, authenticated settings as the Sidebar logo.
 * The platform's default icon remains in place if the business has no logo.
 */
export default function BusinessBrandMetadata({ business }: { business: string }) {
  useEffect(() => {
    if (!business) return;
    let active = true;
    let requestId = 0;
    const previousTitle = document.title;

    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.dataset.businessBrandIcon = "true";

    const appleIcon = document.createElement("link");
    appleIcon.rel = "apple-touch-icon";
    appleIcon.dataset.businessBrandIcon = "true";

    async function update() {
      const myRequest = ++requestId;
      try {
        const settings = await getPosSettings(business);
        if (!active || myRequest !== requestId) return;

        const businessName = settings.name?.trim() || business;
        document.title = `${businessName} | FC Manager`;

        const logo = resolveBusinessBrandLogo(settings.logo_url, settings.logo_path);
        if (!logo) {
          icon.remove();
          appleIcon.remove();
          return;
        }

        // Re-request the favicon when an admin updates the business logo.
        // This also avoids a stale favicon when the new upload reuses the URL.
        const updated = new URL(logo, window.location.origin);
        if (updated.protocol === "http:" || updated.protocol === "https:") {
          updated.searchParams.set("brand_refresh", String(Date.now()));
          icon.href = updated.toString();
          appleIcon.href = updated.toString();
        } else {
          icon.href = logo;
          appleIcon.href = logo;
        }
        if (!icon.isConnected) document.head.appendChild(icon);
        if (!appleIcon.isConnected) document.head.appendChild(appleIcon);
      } catch {
        // No offline/broken tab icon; default platform icon stays intact.
      }
    }

    void update();
    window.addEventListener("business-settings-changed", update);
    return () => {
      active = false;
      requestId++;
      window.removeEventListener("business-settings-changed", update);
      icon.remove();
      appleIcon.remove();
      document.title = previousTitle;
    };
  }, [business]);

  return null;
}
