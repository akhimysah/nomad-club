import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/modules/securite/headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // --- Lot 6 --- en-têtes de sécurité (CSP, cadres, référent, permissions, HSTS) et service worker
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders() },
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
