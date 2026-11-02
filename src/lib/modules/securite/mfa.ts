/**
 * Lot 6 — double authentification (TOTP) des administratrices, via Supabase Auth MFA (mode réel).
 *
 * - Exigée par défaut en mode réel pour l'espace /fondatrices (désactivable : ADMIN_MFA_REQUIRED=false).
 * - Le middleware redirige une administratrice en AAL1 (lien magique seul) vers /connexion/double-authentification.
 * - Défense en profondeur : getViewer() retire le rôle « admin » d'une session AAL1 (server actions comprises),
 *   et la base peut exiger l'AAL2 (security_settings.admin_mfa_enforced, 0008_securite.sql).
 * En démo, l'écran est simulé (aucun vrai facteur n'est créé).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "../../types";
import { adminMfaRequired, rolesForAal, type Aal } from "./mfa-core";

export { adminMfaRequired, MFA_PATH, qrToDataUrl, rolesForAal } from "./mfa-core";

export type AalState = { current: Aal; next: Aal };

export async function sessionAal(supabase: SupabaseClient): Promise<AalState> {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return { current: data?.currentLevel === "aal2" ? "aal2" : "aal1", next: data?.nextLevel === "aal2" ? "aal2" : "aal1" };
}

/** Variante pour getViewer() (mode réel) : rôles effectifs selon le niveau de la session. */
export async function enforceAdminMfa(roles: Role[]): Promise<Role[]> {
  if (!adminMfaRequired() || !roles.includes("admin")) return roles;
  const { supabaseServer } = await import("../../supabase/server");
  const aal = await sessionAal(await supabaseServer());
  return rolesForAal(roles, aal.current, true);
}
