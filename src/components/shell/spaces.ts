import { SPACE_ACCESS, spaceOfPath, type Space } from "@/lib/permissions";
import type { IconName } from "../IconSprite";

export const SPACES: Record<Space, { label: string; sub: string; home: string; icon: IconName }> = {
  visit: { label: "Compte gratuit", sub: "Sans adhésion", home: "/", icon: "user" },
  member: { label: "Membre", sub: "Compte payant", home: SPACE_ACCESS.member.prefix, icon: "card" },
  partner: { label: "Partenaire", sub: "Établissement", home: SPACE_ACCESS.partner.prefix, icon: "gift" },
  pro: { label: "Pro", sub: "Carnet d’adresses", home: SPACE_ACCESS.pro.prefix, icon: "star" },
  founders: { label: "Fondatrices", sub: "Admin", home: SPACE_ACCESS.founders.prefix, icon: "grid" },
};

export const spaceOf = spaceOfPath;

const KEY = "nc:last:";
export function rememberPath(space: Space, path: string) {
  try {
    localStorage.setItem(KEY + space, path);
  } catch {
    /* stockage indisponible : sans importance */
  }
}
export function lastPath(space: Space): string {
  try {
    const p = localStorage.getItem(KEY + space);
    // ne revient que sur une adresse du même espace
    return p && spaceOfPath(p) === space ? p : SPACES[space].home;
  } catch {
    return SPACES[space].home;
  }
}
