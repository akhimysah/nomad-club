import path from "node:path";
import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/modules/securite/headers";

const nextConfig: NextConfig = {
  // Racine explicite : évite que Turbopack remonte à un dossier parent (worktrees, lockfiles multiples).
  turbopack: { root: path.resolve(__dirname) },
  // --- Lot 4 --- : envoi des fichiers de la boutique (25 Mo au plus) par server action
  experimental: { serverActions: { bodySizeLimit: "26mb" } },
  poweredByHeader: false,
  // --- Lot 6 --- en-têtes de sécurité (CSP, cadres, référent, permissions, HSTS) et service worker
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders() },
      // --- Lancement --- espaces privés et parcours personnels : jamais indexés
      {
        source: "/:root(espace|fondatrices|partenaire|pro|mes-donnees|bienvenue|candidature|invitation|billet|auth|api|statut|hors-ligne)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
