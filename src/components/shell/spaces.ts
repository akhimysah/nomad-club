import type { Space } from "@/app/actions/space";
import type { IconName } from "../IconSprite";

export const SPACES: Record<Space, { label: string; sub: string; home: string; icon: IconName }> = {
  visit: { label: "Compte gratuit", sub: "Sans adhésion", home: "/", icon: "user" },
  member: { label: "Membre", sub: "Compte payant", home: "/espace", icon: "card" },
  founders: { label: "Fondatrices", sub: "Votre espace", home: "/fondatrices", icon: "grid" },
};

export function spaceOf(pathname: string): Space {
  if (pathname.startsWith("/espace")) return "member";
  if (pathname.startsWith("/fondatrices")) return "founders";
  return "visit";
}

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
    return localStorage.getItem(KEY + space) || SPACES[space].home;
  } catch {
    return SPACES[space].home;
  }
}
