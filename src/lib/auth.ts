import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getRepo } from "./data";
import { isTicketCode } from "./domain/tickets";
import { isRealMode } from "./env";
import { effectiveRoles, parsePersona, rolesCan, spacesFor, type Capability, type DemoPersona, type Space } from "./permissions";
import { DEMO_FOUNDER_ID, DEMO_MEMBER_ID, DEMO_PARTNER_ID, DEMO_PRO_ID } from "./seed";
import type { Profile, Viewer } from "./types";

/** Cookie du sélecteur d'espace (mode démo uniquement) : personnage incarné. */
export const ROLE_COOKIE = "nc_demo_role";
/** Billets réservés sans compte, pour retrouver « Ta place est réservée ». */
export const TICKETS_COOKIE = "nc_billets";

const PERSONA_PROFILE: Record<DemoPersona, string | null> = {
  guest: null,
  member: DEMO_MEMBER_ID,
  partner: DEMO_PARTNER_ID,
  pro: DEMO_PRO_ID,
  admin: DEMO_FOUNDER_ID,
};

export const getViewer = cache(async (): Promise<Viewer> => {
  const jar = await cookies();
  const guestTickets = (jar.get(TICKETS_COOKIE)?.value ?? "").split(",").filter(isTicketCode);
  if (!isRealMode()) {
    const id = PERSONA_PROFILE[parsePersona(jar.get(ROLE_COOKIE)?.value)];
    const profile = id ? await getRepo().getProfile(id) : null;
    return { roles: effectiveRoles(profile), profile, guestTickets, mode: "demo" };
  }
  const { getSessionProfile } = await import("./supabase/session");
  const profile = await getSessionProfile();
  // --- Lot 6 --- sans double authentification (AAL2), une administratrice n'a pas ses droits d'admin
  const { enforceAdminMfa } = await import("./modules/securite/mfa");
  return { roles: await enforceAdminMfa(effectiveRoles(profile)), profile, guestTickets, mode: "real" };
});

/** La personne qui regarde a-t-elle cette capacité ? */
export function viewerCan(v: Pick<Viewer, "roles">, cap: Capability): boolean {
  return rolesCan(v.roles, cap);
}

/** Espaces accessibles à la personne qui regarde (pour le sélecteur d'espace). */
export function viewerSpaces(v: Pick<Viewer, "roles">): Space[] {
  return spacesFor(v.roles);
}

type Authed = Viewer & { profile: Profile };

/**
 * Garde serveur des layouts et des pages : exige une capacité, sinon redirige
 * (connexion si personne n'est connecté, sinon `fallback`).
 */
export async function requireCapability(cap: Capability, opts: { next?: string; fallback?: string } = {}): Promise<Authed> {
  const v = await getViewer();
  if (!v.profile) redirect(`/connexion?suite=${encodeURIComponent(opts.next ?? "/espace")}`);
  if (!viewerCan(v, cap)) redirect(opts.fallback ?? `/connexion?suite=${encodeURIComponent(opts.next ?? "/espace")}`);
  return { ...v, profile: v.profile };
}

/** Variante pour les server actions : renvoie null au lieu de rediriger. */
export async function checkCapability(cap: Capability): Promise<Authed | null> {
  const v = await getViewer();
  if (!v.profile || !viewerCan(v, cap)) return null;
  return { ...v, profile: v.profile };
}

/** Espace membre : adhérentes, modératrices et administratrices. */
export async function requireMember(next = "/espace") {
  return requireCapability("space.member", { next, fallback: "/formules" });
}

/** Espace fondatrices (administratrices). */
export async function requireFounder(next = "/fondatrices") {
  return requireCapability("space.admin", { next });
}
