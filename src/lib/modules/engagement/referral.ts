/** Parrainage côté serveur : rattacher une inscription à un code, lien de partage. */
import { cookies } from "next/headers";
import { getRepo } from "../../data";
import { siteUrl } from "../../site";
import { normalizeReferralCode, REFERRAL_COOKIE, REFERRAL_PARAM } from "./referral-cookie";
import type { Referral } from "./types";

/**
 * Rattache la personne à sa marraine : code saisi (champ « Code de parrainage ») sinon cookie `nc_parrain`.
 * Sans effet si elle est déjà parrainée, déjà membre, ou si le code est inconnu. Ne fait jamais échouer l'action appelante.
 */
export async function claimReferral(profileId: string, typed?: string | null): Promise<Referral | null> {
  try {
    const jar = await cookies();
    const code = normalizeReferralCode(typed) ?? normalizeReferralCode(jar.get(REFERRAL_COOKIE)?.value);
    if (!code) return null;
    const r = await getRepo().claimReferral(profileId, code);
    if (r) {
      try {
        jar.delete(REFERRAL_COOKIE);
      } catch {
        /* lecture seule (composant serveur) */
      }
    }
    return r;
  } catch (e) {
    console.error("[parrainage]", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Code mémorisé (cookie) pour préremplir un formulaire. */
export async function pendingReferralCode(): Promise<string | null> {
  const jar = await cookies();
  return normalizeReferralCode(jar.get(REFERRAL_COOKIE)?.value);
}

/** Lien à partager : la page des formules, avec le code. */
export async function referralLink(code: string): Promise<string> {
  return `${await siteUrl()}/formules?${REFERRAL_PARAM}=${encodeURIComponent(code)}`;
}
