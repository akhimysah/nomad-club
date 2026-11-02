import { NextResponse, type NextRequest } from "next/server";
import { monitoringEnabled, reportError } from "@/lib/modules/lancement/monitoring";

/**
 * Vague 2 — erreurs vues dans le navigateur (page d'erreur), relayées vers Sentry si SENTRY_DSN est défini.
 * Le DSN reste côté serveur. Limité à 10 signalements par minute et par adresse (mémoire du processus).
 */
const hits = new Map<string, { n: number; until: number }>();

export async function POST(req: NextRequest) {
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const now = Date.now();
  const h = hits.get(ip);
  if (h && h.until > now && h.n >= 10) return new NextResponse(null, { status: 429 });
  hits.set(ip, h && h.until > now ? { n: h.n + 1, until: h.until } : { n: 1, until: now + 60_000 });
  if (hits.size > 5000) hits.clear();
  let body: { message?: unknown; digest?: unknown; path?: unknown; name?: unknown };
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const err = new Error(String(body.message ?? "Erreur dans le navigateur").slice(0, 500));
  err.name = String(body.name ?? "ClientError").slice(0, 60);
  err.stack = undefined;
  // Sans Sentry : une ligne dans les journaux du serveur (journalctl -u nomad-club).
  if (!monitoringEnabled()) {
    console.error(`[erreur navigateur] ${typeof body.path === "string" ? body.path.slice(0, 200) : "?"} · ${err.name} : ${err.message}${typeof body.digest === "string" ? ` (digest ${body.digest.slice(0, 40)})` : ""}`);
    return new NextResponse(null, { status: 204 });
  }
  await reportError(err, { source: "client", path: typeof body.path === "string" ? body.path.slice(0, 200) : undefined, digest: typeof body.digest === "string" ? body.digest.slice(0, 40) : undefined });
  return new NextResponse(null, { status: 204 });
}
