import type { MetadataRoute } from "next";
import { isRealMode } from "@/lib/env";
import { PRIVATE_PREFIXES, publicSiteUrl } from "@/lib/modules/lancement/seo";

/** Vague 2 — robots.txt : pages publiques seulement ; tout est fermé sur un aperçu de démonstration. */
export default function robots(): MetadataRoute.Robots {
  const base = publicSiteUrl();
  if (!isRealMode()) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE_PREFIXES.map((p) => `${p}`) }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
