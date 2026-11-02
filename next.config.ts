import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Racine explicite : évite que Turbopack remonte à un dossier parent (worktrees, lockfiles multiples).
  turbopack: { root: path.resolve(__dirname) },
  // --- Lot 4 --- : envoi des fichiers de la boutique (25 Mo au plus) par server action
  experimental: { serverActions: { bodySizeLimit: "26mb" } },
};

export default nextConfig;
