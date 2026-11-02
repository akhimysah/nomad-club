import { requireCapability } from "./auth";
import { getRepo } from "./data";
import { rolesCan } from "./permissions";
import type { OrganizationKind, OrganizationMemberRole, Organization } from "./types";

export type OrgEntry = { organization: Organization; role: OrganizationMemberRole | null };

const CAP = { partner: "space.partner", pro: "space.pro" } as const;
const HOME = { partner: "/partenaire", pro: "/pro" } as const;

/**
 * Espaces Partenaire et Pro : la personne connectée et ses établissements de ce type.
 * Une administratrice sans établissement voit tous ceux du type (role null = accès admin).
 */
export async function loadOrgSpace(kind: OrganizationKind, next: string = HOME[kind]) {
  const v = await requireCapability(CAP[kind], { next, fallback: "/" });
  const repo = getRepo();
  const mine: OrgEntry[] = (await repo.listMyOrganizations(v.profile.id)).filter((m) => m.organization.kinds.includes(kind));
  const asAdmin = !mine.length && rolesCan(v.roles, "organizations.manage_all");
  const orgs: OrgEntry[] = asAdmin ? (await repo.listOrganizations({ kind })).map((organization) => ({ organization, role: null })) : mine;
  return { viewer: v, orgs, asAdmin };
}
