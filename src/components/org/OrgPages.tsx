import { getRepo } from "@/lib/data";
import { loadOrgSpace } from "@/lib/org-space";
import type { OrganizationKind } from "@/lib/types";
import { FHead } from "../founders/parts";
import { Icon } from "../ui/Icon";
import { Screen } from "../ui/Screen";
import { OrgCard, OrgDetails } from "./OrgParts";
import { SoonCards, type SoonItem } from "./SoonCards";

const SOON: Record<OrganizationKind, SoonItem[]> = {
  partner: [
    { icon: "gift", title: "Offres", text: "Créer et modifier tes réductions et avantages pour les membres.", lot: "lot 3" },
    { icon: "ticket", title: "Code et QR à présenter", text: "Les membres présentent leur code en caisse ; tu valides en un geste.", lot: "lot 3" },
    { icon: "spark", title: "Statistiques d’utilisation", text: "Vues de ta fiche et utilisations de tes offres, mois par mois.", lot: "lot 3" },
    { icon: "edit", title: "Contrat partenaire", text: "Contrat généré, accepté en ligne et archivé ici en PDF.", lot: "lot 2" },
  ],
  pro: [
    { icon: "book", title: "Fiche dans le carnet", text: "Photos, horaires, services : ta fiche visible par toutes les membres.", lot: "lot 3" },
    { icon: "card", title: "Abonnement mensuel", text: "Ton référencement payant, ses échéances et tes factures.", lot: "lot 2" },
    { icon: "spark", title: "Statistiques de visibilité", text: "Vues de ta fiche, clics sur ton téléphone et ton site.", lot: "lot 3" },
    { icon: "edit", title: "Contrat", text: "Contrat généré, accepté en ligne et archivé ici en PDF.", lot: "lot 2" },
  ],
};

const SHEET = { partner: "/partenaire/etablissement", pro: "/pro/fiche" } as const;

/** Accueil des espaces Partenaire et Pro : l'établissement et les fonctions à venir. */
export async function OrgHome({ kind }: { kind: OrganizationKind }) {
  const { viewer, orgs, asAdmin } = await loadOrgSpace(kind);
  const group = kind === "partner" ? "partner" : "pro";
  return (
    <Screen group={group} index={0} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title={`Bonjour ${viewer.profile.firstName}`} sub={kind === "partner" ? "Espace partenaire" : "Espace professionnelle du carnet"} />
        {asAdmin && (
          <p className="rule" style={{ marginBottom: 18 }}>
            <Icon name="lock" />
            <span>Tu vois cet espace en tant qu’administratrice : voici tous les établissements de ce type.</span>
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {orgs.map((e) => (
            <OrgCard key={e.organization.id} entry={e} href={`${SHEET[kind]}?id=${e.organization.id}`} />
          ))}
          {!orgs.length && (
            <div className="empty">
              <Icon name="pin" />
              Aucun établissement n’est encore relié à ton compte. Julia et Nora s’en occupent.
            </div>
          )}
        </div>
        <h2 className="mini-h" id={kind === "partner" ? "offres" : "abonnement"} style={{ margin: "30px 0 12px" }}>
          Bientôt dans ton espace
        </h2>
        <SoonCards items={SOON[kind]} />
      </div>
    </Screen>
  );
}

/** Fiche détaillée de l'établissement (le premier, ou celui demandé par ?id=). */
export async function OrgSheet({ kind, id }: { kind: OrganizationKind; id?: string }) {
  const { orgs } = await loadOrgSpace(kind, SHEET[kind]);
  const group = kind === "partner" ? "partner" : "pro";
  const entry = orgs.find((e) => e.organization.id === id) ?? orgs[0];
  if (!entry) {
    return (
      <Screen group={group} index={1} className="fscreen scroller on">
        <div className="f-inner">
          <FHead title="Établissement" sub="Fiche" />
          <div className="empty">Aucun établissement relié à ton compte.</div>
        </div>
      </Screen>
    );
  }
  const repo = getRepo();
  const o = entry.organization;
  const [members, places, offers] = await Promise.all([
    repo.listOrganizationMembers(o.id),
    o.placeId ? repo.listPlaces() : Promise.resolve([]),
    o.kinds.includes("partner") ? repo.listPartnerOffers() : Promise.resolve([]),
  ]);
  return (
    <Screen group={group} index={1} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title={kind === "partner" ? "Établissement" : "Ma fiche"} sub={o.name} />
        <OrgDetails o={o} members={members} place={places.find((p) => p.id === o.placeId) ?? null} offers={offers.filter((x) => x.organizationId === o.id)} />
      </div>
    </Screen>
  );
}
