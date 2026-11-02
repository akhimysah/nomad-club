/**
 * Autorisations centralisées : rôles cumulables → capacités nommées.
 *
 * Ce module est pur (aucun accès aux cookies ni à la base) : il est importé par le middleware,
 * les layouts, les server actions et les composants. Les gardes serveur qui s'appuient dessus
 * (requireCapability, viewerCan) sont dans src/lib/auth.ts.
 * La même matrice existe côté base sous forme de politiques RLS (supabase/migrations/0003_socle.sql).
 */
import type { GrantableRole, Profile, Role } from "./types";

export const CAPABILITIES = [
  // espaces
  "space.member",
  "space.partner",
  "space.pro",
  "space.admin",
  // rendez-vous
  "events.book",
  "events.manage",
  // adhésions et paiements
  "payments.validate",
  "reminders.send",
  // membres et rôles
  "members.view_directory",
  "members.manage",
  "roles.manage",
  // messagerie
  "messages.post",
  "messages.moderate",
  // carnet, offres, établissements
  "carnet.view",
  "offers.view",
  "offers.manage_own",
  "offers.manage_all",
  "listing.manage_own",
  "organizations.manage_own",
  "organizations.manage_all",
  // pilotage
  "crm.access",
  "audit.view",
  // --- Lot 5 ---
  /** Exporter des contacts (données personnelles) en CSV. Administratrices uniquement. */
  "crm.export",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const MEMBER: Capability[] = ["space.member", "events.book", "members.view_directory", "messages.post", "carnet.view", "offers.view"];

/** Matrice rôle → capacités. Les capacités se cumulent quand une personne a plusieurs rôles. */
export const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  guest: ["events.book"],
  member: MEMBER,
  moderator: [...MEMBER, "messages.moderate"],
  partner: ["events.book", "space.partner", "offers.manage_own", "organizations.manage_own"],
  pro: ["events.book", "space.pro", "listing.manage_own", "organizations.manage_own"],
  admin: CAPABILITIES,
};

export const GRANTABLE_ROLES: GrantableRole[] = ["member", "moderator", "admin", "partner", "pro"];

export const ROLE_LABEL: Record<Role, string> = {
  guest: "Compte gratuit",
  member: "Membre",
  moderator: "Modératrice",
  admin: "Administratrice",
  partner: "Partenaire",
  pro: "Professionnelle",
};

export const ROLE_HINT: Record<GrantableRole, string> = {
  member: "Adhérente : espace membre, salon, carnet, annuaire.",
  moderator: "Modère la messagerie (en plus de l’espace membre).",
  admin: "Gestion complète : fondatrices.",
  partner: "Établissement partenaire : offres et statistiques.",
  pro: "Professionnelle du carnet : fiche, abonnement, visibilité.",
};

export function isGrantableRole(v: unknown): v is GrantableRole {
  return typeof v === "string" && (GRANTABLE_ROLES as string[]).includes(v);
}

/** Rôles effectifs d'un profil (["guest"] s'il n'en a aucun). */
export function effectiveRoles(p: Pick<Profile, "roles"> | null | undefined): Role[] {
  return p && p.roles.length ? p.roles : ["guest"];
}

export function hasRole(p: Pick<Profile, "roles"> | null | undefined, role: Role): boolean {
  return effectiveRoles(p).includes(role);
}

export function hasAnyRole(p: Pick<Profile, "roles"> | null | undefined, roles: readonly Role[]): boolean {
  const mine = effectiveRoles(p);
  return roles.some((r) => mine.includes(r));
}

export const isAdmin = (p: Pick<Profile, "roles"> | null | undefined) => hasRole(p, "admin");
/** Compte gratuit : aucun rôle. */
export const isGuest = (p: Pick<Profile, "roles"> | null | undefined) => !p || p.roles.length === 0;
/** Fait partie du cercle (annuaire, salon) : membre, modératrice ou administratrice. */
export const inCircle = (p: Pick<Profile, "roles"> | null | undefined) => hasAnyRole(p, ["member", "moderator", "admin"]);

export function capabilitiesOf(roles: readonly Role[]): Set<Capability> {
  const out = new Set<Capability>();
  for (const r of roles.length ? roles : (["guest"] as Role[])) ROLE_CAPABILITIES[r]?.forEach((c) => out.add(c));
  return out;
}

export function rolesCan(roles: readonly Role[], cap: Capability): boolean {
  return capabilitiesOf(roles).has(cap);
}

/* ---------- espaces ---------- */

export type Space = "visit" | "member" | "partner" | "pro" | "founders";

export const SPACE_ORDER: Space[] = ["visit", "member", "partner", "pro", "founders"];

/** Préfixe d'adresse et capacité requise de chaque espace. */
export const SPACE_ACCESS: Record<Space, { prefix: string; capability: Capability | null }> = {
  visit: { prefix: "/", capability: null },
  member: { prefix: "/espace", capability: "space.member" },
  partner: { prefix: "/partenaire", capability: "space.partner" },
  pro: { prefix: "/pro", capability: "space.pro" },
  founders: { prefix: "/fondatrices", capability: "space.admin" },
};

function underPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

export function spaceOfPath(pathname: string): Space {
  for (const s of SPACE_ORDER) if (s !== "visit" && underPrefix(pathname, SPACE_ACCESS[s].prefix)) return s;
  return "visit";
}

/** Capacité exigée pour ouvrir une adresse (null = public). */
export function requiredCapability(pathname: string): Capability | null {
  return SPACE_ACCESS[spaceOfPath(pathname)].capability;
}

/** Espaces accessibles avec ces rôles (l'espace visiteuse est toujours là). */
export function spacesFor(roles: readonly Role[]): Space[] {
  const caps = capabilitiesOf(roles);
  return SPACE_ORDER.filter((s) => {
    const c = SPACE_ACCESS[s].capability;
    return !c || caps.has(c);
  });
}

/* ---------- personnages du mode démo ---------- */

/** Personnage incarné par le sélecteur d'espace en démo (cookie nc_demo_role). */
export type DemoPersona = "guest" | "member" | "partner" | "pro" | "admin";

export const PERSONA_OF_SPACE: Record<Space, DemoPersona> = { visit: "guest", member: "member", partner: "partner", pro: "pro", founders: "admin" };

export function parsePersona(v: string | undefined): DemoPersona {
  if (v === "founder") return "admin"; // ancien cookie
  return v === "member" || v === "partner" || v === "pro" || v === "admin" ? v : "guest";
}
