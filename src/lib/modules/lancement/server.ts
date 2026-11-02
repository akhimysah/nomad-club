/**
 * Vague 2 — Inscription et lancement : aides côté serveur (pages, actions, retour du lien magique).
 */
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getRepo } from "../../data";
import { isRealMode } from "../../env";
import { sendEmail } from "../../mail-hook";
import { ROLE_LABEL } from "../../permissions";
import type { Profile } from "../../types";
import { onboardingPending } from "./domain";
import type { InvitableRole, MembershipApplication } from "./types";

/**
 * Garde de la PREMIÈRE adhésion (« join ») : en mode « sur validation », il faut une candidature acceptée.
 * Renvoie null si c'est permis, sinon le message à afficher. Le renouvellement et le passage Premium ne
 * sont pas concernés. Une visiteuse sans compte (démo) n'est pas bloquée ici.
 */
export async function membershipGate(profile: Profile | null): Promise<string | null> {
  if (!profile) return null;
  try {
    if (await getRepo().canJoinMembership(profile.id)) return null;
  } catch (e) {
    console.error("[lancement] contrôle de l'adhésion :", e instanceof Error ? e.message : e);
    return null; // une panne ne doit pas empêcher de payer : les fondatrices peuvent rembourser
  }
  return "L’adhésion se fait sur candidature : dépose ta demande, Julia et Nora te répondent vite.";
}

/** Lien de candidature à afficher à la place des boutons « Adhérer » (null : paiement direct possible). */
export async function applyHrefFor(profile: Profile | null): Promise<string | null> {
  const settings = await getRepo().getLancementSettings();
  if (settings.membershipMode === "direct") return null;
  if (!profile) return isRealMode() ? "/inscription?parcours=adhesion" : null;
  return (await membershipGate(profile)) ? "/candidature" : null;
}

/**
 * Après l'échange du code du lien magique (mode réel) : rattache le code de parrainage saisi à
 * l'inscription (même ouvert sur un autre appareil) et envoie vers l'onboarding à la première connexion.
 */
export async function afterMagicLink(supabase: SupabaseClient, user: User, dest: string): Promise<string> {
  try {
    const typed = typeof user.user_metadata?.referral_code === "string" ? user.user_metadata.referral_code : null;
    if (typed) await (await import("../engagement/referral")).claimReferral(user.id, typed);
    if (dest.startsWith("/invitation/") || dest.startsWith("/bienvenue")) return dest;
    const { data, error } = await supabase.rpc("my_onboarding");
    if (error || !data) return dest;
    const row = data as { completed_at: string | null; skipped_at: string | null };
    if (onboardingPending({ completedAt: row.completed_at, skippedAt: row.skipped_at })) return `/bienvenue?suite=${encodeURIComponent(dest)}`;
    return dest;
  } catch (e) {
    console.error("[lancement] après le lien magique :", e instanceof Error ? e.message : e);
    return dest;
  }
}

const ROLE_INVITE_LABEL: Record<InvitableRole, string> = { moderator: "modératrice", partner: "partenaire", pro: "professionnelle du carnet" };

export function invitationRoleLabel(role: InvitableRole): string {
  return ROLE_INVITE_LABEL[role] ?? ROLE_LABEL[role];
}

/** E-mail d'invitation (le lien n'est envoyé qu'ici et montré une fois à l'admin). */
export async function emailInvitation(input: { to: string; link: string; role: InvitableRole; inviter: string; expiresAt: string; note: string | null; organization: string | null }): Promise<boolean> {
  return sendEmail({
    template: "role_invitation",
    to: input.to,
    data: {
      link: input.link,
      role: input.role,
      roleLabel: invitationRoleLabel(input.role),
      inviterName: input.inviter,
      organization: input.organization,
      note: input.note,
      expiresAt: input.expiresAt,
      subject: `${input.inviter} t’invite sur l’appli du Nomad Club`,
    },
  });
}

/** E-mail de réponse à une candidature. */
export async function emailApplicationDecision(to: string | null, firstName: string, app: MembershipApplication, siteUrl: string): Promise<boolean> {
  if (!to) return false;
  const accepted = app.status === "accepted";
  return sendEmail({
    template: accepted ? "application_accepted" : "application_refused",
    to,
    data: {
      firstName,
      message: app.decisionMessage,
      link: accepted ? `${siteUrl}/formules` : `${siteUrl}/candidature`,
      subject: accepted ? "Ta candidature au Nomad Club est acceptée" : "Réponse à ta candidature au Nomad Club",
    },
  });
}
