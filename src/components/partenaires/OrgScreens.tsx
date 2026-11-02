import Link from "next/link";
import { getRepo } from "@/lib/data";
import { num } from "@/lib/format";
import { QUARTIERS, sumStats } from "@/lib/modules/partenaires/domain";
import { loadOrgContext } from "@/lib/modules/partenaires/server";
import { inCircle } from "@/lib/permissions";
import type { OrganizationKind } from "@/lib/types";
import { FHead } from "../founders/parts";
import { Icon } from "../ui/Icon";
import { Screen } from "../ui/Screen";
import { MonthKpis, NoOrg, OffersList, OrgPicker, StatsBlock, TeamCard } from "./OrgBlocks";
import { EstablishmentForm } from "./OrgForms";

const BASE = { partner: "/partenaire", pro: "/pro" } as const;

/** Statistiques d'un établissement (partenaire : vues et codes ; pro : vues et clics de contact). */
export async function OrgStatsScreen({ kind, org, index }: { kind: OrganizationKind; org?: string; index: number }) {
  const base = `${BASE[kind]}/statistiques`;
  const { orgs, entry } = await loadOrgContext(kind, base, org);
  const id = entry?.organization.id ?? null;
  const repo = getRepo();
  const [rows, offers, offerStats] = id ? await Promise.all([repo.orgMonthlyStats(id, 6), kind === "partner" ? repo.listOffers({ organizationId: id }) : Promise.resolve([]), kind === "partner" ? repo.offerStats(id) : Promise.resolve([])]) : [[], [], []];
  const tot = sumStats(rows);
  return (
    <Screen group={kind} index={index} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title="Statistiques" sub={kind === "partner" ? "Vues de ta fiche et utilisation des offres" : "Ta visibilité dans le carnet"} />
        <OrgPicker orgs={orgs} current={id} base={base} />
        {!id ? (
          <NoOrg />
        ) : (
          <>
            <MonthKpis rows={rows} mode={kind} offersActive={offers.filter((o) => o.status === "active").length} />
            <div className="f-grid">
              <StatsBlock rows={rows} mode={kind} />
              <div className="f-col">
                <section className="card">
                  <div className="card-h">
                    <h2>Sur 6 mois</h2>
                  </div>
                  <div className="kv">
                    <span>Vues de la fiche</span>
                    <b>{num(tot.views)}</b>
                  </div>
                  {kind === "partner" ? (
                    <>
                      <div className="kv">
                        <span>Codes générés</span>
                        <b>{num(tot.codesGenerated)}</b>
                      </div>
                      <div className="kv">
                        <span>Codes validés en caisse</span>
                        <b>
                          {num(tot.codesValidated)}
                          {tot.codesGenerated ? ` · ${Math.round((tot.codesValidated / tot.codesGenerated) * 100)} %` : ""}
                        </b>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="kv">
                        <span>Clics contact</span>
                        <b>{num(tot.contactClicks)}</b>
                      </div>
                      <div className="kv">
                        <span>Clics WhatsApp</span>
                        <b>{num(tot.whatsappClicks)}</b>
                      </div>
                    </>
                  )}
                  <div className="kv">
                    <span>Itinéraires demandés</span>
                    <b>{num(tot.directionsClicks)}</b>
                  </div>
                </section>
                {kind === "partner" && (
                  <section className="card">
                    <div className="card-h">
                      <h2>Par offre</h2>
                    </div>
                    <OffersList offers={offers} stats={offerStats} orgId={id} compact />
                  </section>
                )}
                <p className="rule">
                  <Icon name="lock" />
                  <span>Seule ton équipe voit ces chiffres. Les visites de ton équipe sur ta propre fiche ne sont pas comptées.</span>
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </Screen>
  );
}

/** Fiche de l'établissement : formulaire complet + équipe (partenaire) ou fiche carnet (pro). */
export async function OrgSheetScreen({ kind, org, index }: { kind: OrganizationKind; org?: string; index: number }) {
  const base = kind === "partner" ? "/partenaire/etablissement" : "/pro/fiche";
  const { viewer, orgs, entry, establishment } = await loadOrgContext(kind, base, org);
  const repo = getRepo();
  const id = establishment?.id ?? null;
  const [members, invites] = id ? await Promise.all([repo.listOrganizationMembers(id), repo.listOrgInvites(id)]) : [[], []];
  const canInvite = entry?.role === "owner" || entry?.role === null;
  return (
    <Screen group={kind} index={index} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title={kind === "partner" ? "Établissement" : "Ma fiche"} sub={establishment?.name ?? "Fiche"} />
        <OrgPicker orgs={orgs} current={id} base={base} />
        {!establishment ? (
          <NoOrg />
        ) : (
          <div className="f-grid">
            <EstablishmentForm e={establishment} areas={QUARTIERS.map((q) => q.name)} pro={kind === "pro" || establishment.kinds.includes("pro")} />
            <div className="f-col">
              <section className="card">
                <div className="card-h">
                  <h2>{establishment.name}</h2>
                  <span className="chip">{establishment.category}</span>
                </div>
                <p className="muted" style={{ margin: "6px 0 12px", fontSize: 15 }}>
                  Le nom, la catégorie et le statut sont gérés par Julia et Nora. Tout le reste se modifie ici.
                </p>
                {inCircle(viewer.profile) && (
                  <Link className="btn btn-ghost btn-sm" href={`/espace/fiche/${establishment.slug}`}>
                    <Icon name="arrow-r" />
                    Voir la fiche comme une membre
                  </Link>
                )}
              </section>
              <TeamCard members={members} invites={invites} orgId={establishment.id} canInvite={canInvite} />
            </div>
          </div>
        )}
      </div>
    </Screen>
  );
}
