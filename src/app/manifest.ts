import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // --- Lot 6 --- identifiant stable, portée, orientation et raccourcis (PWA installable)
    id: "/",
    name: "Nomad Club",
    short_name: "Nomad Club",
    description: "Le club des femmes et entrepreneuses à Marrakech.",
    start_url: "/espace",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0b0b",
    theme_color: "#0b0b0b",
    lang: "fr",
    dir: "ltr",
    categories: ["lifestyle", "social"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Agenda", url: "/espace/agenda", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Cercle", url: "/espace/cercle", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Notifications", url: "/espace/notifications", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
