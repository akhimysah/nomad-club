/**
 * Parrainage : capture du paramètre d'adresse `?parrain=CODE` (middleware, compatible Edge).
 * Le code est gardé 30 jours dans le cookie `nc_parrain`, puis rattaché au compte à l'inscription
 * (connexion par lien magique, réservation ou adhésion) : voir referral.ts.
 */
import type { NextRequest, NextResponse } from "next/server";

export const REFERRAL_COOKIE = "nc_parrain";
export const REFERRAL_PARAM = "parrain";
const CODE_RE = /^[A-Z0-9]{2,12}-[A-Z0-9]{3,6}$/;

/** Code normalisé (majuscules, sans espaces) ou null s'il n'a pas la bonne forme. */
export function normalizeReferralCode(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const c = v.trim().toUpperCase().replace(/\s+/g, "");
  return CODE_RE.test(c) ? c : null;
}

/** À appeler par le middleware sur toute réponse : pose le cookie si l'adresse porte ?parrain=CODE. */
export function withReferralCookie(request: NextRequest, response: NextResponse): NextResponse {
  const code = normalizeReferralCode(request.nextUrl.searchParams.get(REFERRAL_PARAM));
  if (code) response.cookies.set(REFERRAL_COOKIE, code, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  return response;
}
