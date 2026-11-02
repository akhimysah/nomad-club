import { viewerSpaces } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { fullName } from "@/lib/format";
import { loadOrgSpace } from "@/lib/org-space";
import type { OrganizationKind } from "@/lib/types";
import { BodyClass } from "../ui/BodyClass";
import { OrgChrome, type OrgNavItem } from "./OrgChrome";

const CONF: Record<OrganizationKind, { title: string; space: "partner" | "pro"; nav: OrgNavItem[] }> = {
  partner: {
    title: "Espace partenaire",
    space: "partner",
    nav: [
      { href: "/partenaire", icon: "grid", label: "Accueil" },
      { href: "/partenaire/etablissement", icon: "pin", label: "Établissement" },
      { href: "/partenaire/notifications", icon: "bell", label: "Notifications" },
      { href: "/partenaire#offres", icon: "gift", label: "Offres", soon: true },
      { href: "/partenaire#statistiques", icon: "spark", label: "Statistiques", soon: true },
      { href: "/partenaire#contrats", icon: "edit", label: "Contrats", soon: true },
    ],
  },
  pro: {
    title: "Espace pro",
    space: "pro",
    nav: [
      { href: "/pro", icon: "grid", label: "Accueil" },
      { href: "/pro/fiche", icon: "pin", label: "Ma fiche" },
      { href: "/pro/notifications", icon: "bell", label: "Notifications" },
      { href: "/pro#abonnement", icon: "card", label: "Abonnement", soon: true },
      { href: "/pro#statistiques", icon: "spark", label: "Statistiques", soon: true },
      { href: "/pro#contrat", icon: "edit", label: "Contrat", soon: true },
    ],
  },
};

/** Layout commun des espaces Partenaire et Pro (version jour, ordinateur et téléphone). */
export async function OrgSpaceLayout({ kind, children }: { kind: OrganizationKind; children: React.ReactNode }) {
  const { viewer, orgs, asAdmin } = await loadOrgSpace(kind);
  const notifs = await getRepo().countUnreadNotifications(viewer.profile.id);
  const c = CONF[kind];
  const orgName = asAdmin ? "Accès administratrice" : orgs.map((o) => o.organization.name).join(", ") || "Aucun établissement relié";
  return (
    <section className="space day on" aria-label={c.title}>
      <BodyClass name="is-day" />
      <OrgChrome
        space={c.space}
        title={c.title}
        nav={c.nav}
        name={fullName(viewer.profile)}
        orgName={orgName}
        notifs={notifs}
        spaces={viewer.mode === "real" ? viewerSpaces(viewer) : []}
      />
      <div className="f-main">{children}</div>
    </section>
  );
}
