/**
 * Lot 6 — règles pures de la double authentification (importables par le middleware, sans accès serveur).
 * Voir ./mfa.ts pour le fonctionnement complet.
 */
import type { Role } from "../../types";

export const MFA_PATH = "/connexion/double-authentification";

/** La double authentification est-elle exigée pour l'espace admin ? Mode réel, sauf ADMIN_MFA_REQUIRED=false. */
export function adminMfaRequired(env: Record<string, string | undefined> = process.env): boolean {
  const real = Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return real && env.ADMIN_MFA_REQUIRED !== "false";
}

export type Aal = "aal1" | "aal2";

/** Rôles effectifs d'une session : sans AAL2, une administratrice n'a pas (encore) ses droits d'admin. */
export function rolesForAal(roles: Role[], aal: Aal, required: boolean): Role[] {
  if (!required || aal === "aal2" || !roles.includes("admin")) return roles;
  const rest = roles.filter((r) => r !== "admin");
  return rest.length ? rest : ["guest"];
}

/** L'image du QR code renvoyée par Supabase (SVG brut ou déjà en data URL). */
export function qrToDataUrl(qr: string): string {
  if (qr.startsWith("data:")) return qr;
  return `data:image/svg+xml;utf-8,${encodeURIComponent(qr)}`;
}
