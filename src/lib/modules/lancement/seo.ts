/**
 * Vague 2 — référencement : adresse publique, pages publiques (sitemap) et espaces privés (noindex).
 */

/** Adresse publique du site (NEXT_PUBLIC_SITE_URL), utilisée par les métadonnées et le sitemap. */
export function publicSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Pages publiques indexables (hors fiches de rendez-vous, ajoutées dynamiquement). */
export const PUBLIC_PAGES: Array<{ path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" | "yearly" }> = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/rendez-vous", priority: 0.9, changeFrequency: "daily" },
  { path: "/club", priority: 0.7, changeFrequency: "monthly" },
  { path: "/formules", priority: 0.8, changeFrequency: "monthly" },
  { path: "/inscription", priority: 0.6, changeFrequency: "yearly" },
  { path: "/cgu", priority: 0.2, changeFrequency: "yearly" },
  { path: "/confidentialite", priority: 0.2, changeFrequency: "yearly" },
  { path: "/mentions-legales", priority: 0.2, changeFrequency: "yearly" },
];

/** Préfixes jamais indexés (espaces privés, parcours personnels, techniques). */
export const PRIVATE_PREFIXES = [
  "/espace",
  "/fondatrices",
  "/partenaire",
  "/pro",
  "/mes-donnees",
  "/bienvenue",
  "/candidature",
  "/invitation",
  "/billet",
  "/connexion",
  "/auth",
  "/api",
  "/hors-ligne",
  "/statut",
  "/maintenance",
  "/configuration-manquante",
];
