/**
 * Lot 3 — aides côté serveur : droits d'une personne sur un établissement, établissement choisi dans un espace,
 * établissements visibles par les membres (pros abonnées seulement).
 */
import { checkCapability } from "../../auth";
import { today } from "../../clock";
import { getRepo } from "../../data";
import { loadOrgSpace, type OrgEntry } from "../../org-space";
import { rolesCan, type Capability } from "../../permissions";
import type { OrganizationKind, OrganizationMemberRole, Profile, Role } from "../../types";
import { isListed } from "./domain";
import type { Establishment, ProSubscription } from "./types";

export type OrgAccess = { profile: Profile; roles: Role[]; role: OrganizationMemberRole | "admin" };

/**
 * La personne connectée peut-elle agir sur cet établissement ? (server actions)
 * Équipe de l'établissement (propriétaire ou collaboratrice) ou administratrice. `owner` : propriétaire exigée.
 */
export async function orgAccess(organizationId: string, cap: Capability, opts: { owner?: boolean } = {}): Promise<OrgAccess | null> {
  const me = await checkCapability(cap);
  if (!me) return null;
  const mine = (await getRepo().listMyOrganizations(me.profile.id)).find((m) => m.organization.id === organizationId);
  if (mine) {
    if (opts.owner && mine.role !== "owner") return null;
    return { profile: me.profile, roles: me.roles, role: mine.role };
  }
  if (rolesCan(me.roles, "organizations.manage_all")) return { profile: me.profile, roles: me.roles, role: "admin" };
  return null;
}

/** Établissement de l'espace (le premier, ou celui demandé par ?org=) + la liste pour le sélecteur. */
export async function loadOrgContext(kind: OrganizationKind, next: string, orgId?: string) {
  const ctx = await loadOrgSpace(kind, next);
  const entry: OrgEntry | null = ctx.orgs.find((e) => e.organization.id === orgId) ?? ctx.orgs[0] ?? null;
  const establishment = entry ? await getRepo().getEstablishment(entry.organization.id) : null;
  return { ...ctx, entry, establishment };
}

export type PublicEstablishment = Establishment & { listed: boolean; subscription: ProSubscription | null };

/**
 * Établissements que voit une membre : partenaires actifs et pros dont l'abonnement est actif.
 * (Un compte à la fois pro et partenaire reste visible comme partenaire même si son abonnement pro est échu.)
 */
export async function visibleEstablishments(): Promise<PublicEstablishment[]> {
  const repo = getRepo();
  const t = today();
  await repo.refreshSubscriptions(t);
  const [all, subs] = await Promise.all([repo.listEstablishments({ activeOnly: true }), repo.listSubscriptions()]);
  return all
    .map((e) => {
      const subscription = subs.find((s) => s.organizationId === e.id) ?? null;
      return { ...e, subscription, listed: e.kinds.includes("pro") && isListed(subscription, t) };
    })
    .filter((e) => e.kinds.includes("partner") || e.listed);
}
