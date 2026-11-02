import type { MetadataRoute } from "next";
import { getRepo } from "@/lib/data";
import { configMissing } from "@/lib/env";
import { PUBLIC_PAGES, publicSiteUrl } from "@/lib/modules/lancement/seo";

export const revalidate = 3600;

/** Vague 2 — sitemap : pages publiques et fiches des rendez-vous publiés (jamais les espaces privés). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicSiteUrl();
  const pages: MetadataRoute.Sitemap = PUBLIC_PAGES.map((p) => ({ url: `${base}${p.path === "/" ? "" : p.path}` || base, changeFrequency: p.changeFrequency, priority: p.priority }));
  if (configMissing()) return pages;
  try {
    const events = await getRepo().listEvents({ status: "published" });
    return [...pages, ...events.map((e) => ({ url: `${base}/rendez-vous/${e.slug}`, lastModified: e.createdAt ? new Date(e.createdAt) : undefined, changeFrequency: "weekly" as const, priority: 0.7 }))];
  } catch {
    return pages;
  }
}
