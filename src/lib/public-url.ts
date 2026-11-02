import type { NextRequest } from "next/server";

/**
 * Origine publique de la requête (https://domaine). Derrière Nginx, request.url pointe sur
 * l'adresse interne (localhost:3030) : on reprend l'hôte et le protocole transmis par le proxy.
 */
export function publicOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto");
  const base = new URL(request.url);
  const protocol = proto === "http" || proto === "https" ? proto : base.protocol.replace(":", "");
  return host ? `${protocol}://${host}` : base.origin;
}

/** Adresse absolue sur l'hôte public, pour NextResponse.redirect. */
export function publicUrl(request: NextRequest, path: string): URL {
  return new URL(path, publicOrigin(request));
}
