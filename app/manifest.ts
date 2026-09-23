import type { MetadataRoute } from "next";

/**
 * Manifeste PWA. Sans lui, Chrome ne propose qu'un raccourci vers un onglet ;
 * avec lui (et le service worker, qui ne s'enregistre qu'en production, voir
 * components/ServiceWorkerRegistration.tsx) l'app s'installe vraiment :
 * icone dans le launcher, ouverture plein ecran, mode hors-ligne.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FC Manager — Point de vente",
    short_name: "FC Manager",
    description: "Caisse, catalogue et gestion d'entreprise FC Manager.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Reprend --background et --brand-blue de app/globals.css.
    background_color: "#f8fafc",
    theme_color: "#0a4d8f",
    lang: "fr",
    dir: "ltr",
    categories: ["business", "productivity", "finance"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
