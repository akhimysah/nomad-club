/**
 * Vague 2 — Lancement : garde du middleware (avant toute autre logique).
 * - MAINTENANCE_MODE=true : toutes les pages affichent /maintenance (503, Retry-After).
 * - NEXT_PUBLIC_DEMO=false sans Supabase : /configuration-manquante (503), jamais de données d'exemple.
 * Restent accessibles : /statut (+ /api/statut) et les tâches planifiées (/api/cron/*).
 */
import { NextResponse, type NextRequest } from "next/server";
import { configMissing, maintenanceMode } from "../../env";

const ALWAYS_OPEN = ["/statut", "/api/statut", "/api/cron/", "/maintenance", "/configuration-manquante", "/robots.txt", "/sitemap.xml", "/opengraph-image"];

export function lancementGate(request: NextRequest): NextResponse | null {
  const path = request.nextUrl.pathname;
  if (ALWAYS_OPEN.some((p) => path === p || path.startsWith(p))) return null;
  const target = maintenanceMode() ? "/maintenance" : configMissing() ? "/configuration-manquante" : null;
  if (!target) return null;
  if (path.startsWith("/api/")) return NextResponse.json({ error: target === "/maintenance" ? "Maintenance en cours." : "Configuration manquante." }, { status: 503, headers: { "Retry-After": "600" } });
  const url = request.nextUrl.clone();
  url.pathname = target;
  url.search = "";
  return NextResponse.rewrite(url, { status: 503, headers: { "Retry-After": "600", "X-Robots-Tag": "noindex" } });
}
