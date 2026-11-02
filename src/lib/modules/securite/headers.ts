/**
 * Lot 6 — en-têtes de sécurité HTTP (importé par next.config.ts : module pur, sans dépendance).
 *
 * Politique de sécurité du contenu (CSP) adaptée à Next.js :
 * - scripts : 'self' + 'unsafe-inline' (Next injecte des scripts en ligne pour l'hydratation ; une CSP à nonce
 *   imposerait un rendu dynamique de toutes les pages) + Stripe.js ; 'unsafe-eval' seulement en développement ;
 * - polices : servies par l'appli (next/font les télécharge au build) ;
 * - images : l'appli, data:/blob:, tuiles OpenStreetMap, Stripe, Supabase Storage ;
 * - connexions : l'appli, Supabase (HTTPS + WebSocket temps réel), Open-Meteo (météo), Aladhan (heures de prière), Stripe ;
 * - cadres : Stripe uniquement ; personne ne peut afficher l'appli dans un cadre (frame-ancestors 'none').
 * Ajouts sans toucher au code : CSP_EXTRA_CONNECT, CSP_EXTRA_IMG, CSP_EXTRA_SCRIPT, CSP_EXTRA_FRAME (listes séparées par des espaces).
 */

type Env = Record<string, string | undefined>;

const words = (v: string | undefined) => (v ?? "").split(/\s+/).filter(Boolean);

function supabaseOrigins(env: Env): { https: string[]; wss: string[] } {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return { https: [], wss: [] };
  try {
    const u = new URL(url);
    return { https: [u.origin], wss: [`${u.protocol === "http:" ? "ws" : "wss"}://${u.host}`] };
  } catch {
    return { https: [], wss: [] };
  }
}

export function contentSecurityPolicy(env: Env = process.env): string {
  const dev = env.NODE_ENV !== "production";
  const sb = supabaseOrigins(env);
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'", "https://checkout.stripe.com"],
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : []), "https://js.stripe.com", ...words(env.CSP_EXTRA_SCRIPT)],
    "style-src": ["'self'", "'unsafe-inline'"],
    "font-src": ["'self'", "data:"],
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      "https://tile.openstreetmap.org",
      "https://*.tile.openstreetmap.org",
      "https://unpkg.com",
      "https://*.stripe.com",
      ...sb.https,
      ...words(env.CSP_EXTRA_IMG),
    ],
    "connect-src": [
      "'self'",
      ...sb.https,
      ...sb.wss,
      "https://api.open-meteo.com",
      "https://geocoding-api.open-meteo.com",
      "https://api.aladhan.com",
      "https://api.stripe.com",
      ...(dev ? ["ws:", "wss:"] : []),
      ...words(env.CSP_EXTRA_CONNECT),
    ],
    "frame-src": ["https://js.stripe.com", "https://hooks.stripe.com", "https://checkout.stripe.com", ...words(env.CSP_EXTRA_FRAME)],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "media-src": ["'self'", "blob:"],
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${[...new Set(v)].join(" ")}`);
  // seulement quand le site est servi en HTTPS (sinon `next start` en local sur http:// casserait les ressources)
  if (!dev && (env.VERCEL || env.NEXT_PUBLIC_SITE_URL?.startsWith("https://"))) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

export type HeaderPair = { key: string; value: string };

/** En-têtes appliqués à toutes les réponses. */
export function securityHeaders(env: Env = process.env): HeaderPair[] {
  const prod = env.NODE_ENV === "production";
  const list: HeaderPair[] = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(env) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(self), payment=(self \"https://js.stripe.com\"), usb=(), serial=(), bluetooth=(), browsing-topics=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "X-DNS-Prefetch-Control", value: "on" },
  ];
  // HSTS seulement en production (en HTTPS) : sinon le navigateur refuserait ensuite http://localhost.
  if (prod) list.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
  return list;
}
