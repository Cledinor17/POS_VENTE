import type { Metadata } from "next";
import PublicLandingPage from "@/components/landing/PublicLandingPage";
import { loadMobileDownloads, mobileDownloadCards } from "@/lib/mobileDownloadsServer";
import "@/components/landing/landing.css";

export const metadata: Metadata = {
  title: "NovaGest — Gérez, vendez et développez votre activité",
  description: "Plateforme cloud et hors-ligne de caisse, stock et gestion conçue pour les commerces, restaurants et entreprises d’Haïti et des Caraïbes.",
};

export default async function HomePage() {
  const mobileDownloads = mobileDownloadCards(await loadMobileDownloads());
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* These fonts belong only to the supplied public landing design. */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700&display=swap" />
      <PublicLandingPage mobileDownloads={mobileDownloads} />
    </>
  );
}
