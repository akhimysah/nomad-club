/** Lot 6 — petites aides de sécurité côté requête (module pur ; clientIp charge next/headers à l'appel). */

/**
 * Adresse de redirection interne sûre (après connexion, lien magique) : chemin relatif uniquement.
 * Refuse « //domaine », « /\domaine » (que les navigateurs lisent comme « //domaine »), les schémas
 * et les caractères de contrôle.
 */
export function safeRedirectPath(next: string | null | undefined, fallback = "/espace"): string {
  if (!next || typeof next !== "string" || next.length > 500) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
  return next;
}

/**
 * Adresse IP de la personne, pour la limitation de fréquence.
 * Derrière Vercel ou un proxy, la première valeur de X-Forwarded-For est celle du client
 * (Vercel la réécrit : elle n'est pas falsifiable). En local : « local ».
 */
export function ipFromHeaders(h: Headers): string {
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = fwd || h.get("x-real-ip")?.trim() || "";
  return /^[0-9a-fA-F:.]{2,45}$/.test(ip) ? ip : "local";
}

export async function clientIp(): Promise<string> {
  const { headers } = await import("next/headers");
  return ipFromHeaders(await headers());
}
