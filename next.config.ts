import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // --- Lot 4 --- : envoi des fichiers de la boutique (25 Mo au plus) par server action
  experimental: { serverActions: { bodySizeLimit: "26mb" } },
};

export default nextConfig;
