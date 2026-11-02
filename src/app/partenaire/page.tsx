import Link from "next/link";
import { FHead } from "@/components/founders/parts";
import { OrgCard } from "@/components/org/OrgParts";
import { ContractsCard } from "@/components/contrats/ContractsCard"; // --- Vague 2 · Contrats ---
import { MonthKpis, NoOrg, OffersList, OrgPicker } from "@/components/partenaires/OrgBlocks";
import { ValidateCodeForm } from "@/components/partenaires/OrgForms";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { getRepo } from "@/lib/data";
import { loadOrgContext } from "@/lib/modules/partenaires/server";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ org?: string }> };

const at = (iso: string) => new Date(iso).toLocaleString("fr-FR", { timeZone: "Africa/Casablanca", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Dashboard partenaire (Lot 3) : chiffres du mois, validation d'un code, offres, dernières utilisations. */
export default async function Page({ searchParams }: Props) {
  const { org } = await searchParams;
  const { viewer, orgs, entry, asAdmin } = await loadOrgContext("partner", "/partenaire", org);
  const repo = getRepo();
  const id = entry?.organization.id ?? null;
  const [stats, offers, offerStats, recent] = id
    ? await Promise.all([repo.orgMonthlyStats(id, 6), repo.listOffers({ organizationId: id }), repo.offerStats(id), repo.listOrgCodes(id, { validatedOnly: true, limit: 6 })])
    : [[], [], [], []];
  return (
    <Screen group="partner" index={0} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title={`Bonjour ${viewer.profile.firstName}`} sub={entry ? `Espace partenaire · ${entry.organization.name}` : "Espace partenaire"} />
        {asAdmin && (
          <p className="rule" style={{ marginBottom: 18 }}>
            <Icon name="lock" />
            <span>Tu vois cet espace en tant qu’administratrice : choisis un établissement.</span>
          </p>
        )}
        <OrgPicker orgs={orgs} current={id} base="/partenaire" />
        {!entry ? (
          <NoOrg />
        ) : (
          <>
            <MonthKpis rows={stats} mode="partner" offersActive={offers.filter((o) => o.status === "active").length} />
            <div className="f-grid">
              <div className="f-col">
                <ValidateCodeForm initialCode="" />
                <section className="card">
                  <div className="card-h">
                    <h2>Mes offres</h2>
                    <Link className="btn btn-ghost btn-xs" href={`/partenaire/offres?org=${id}`}>
                      Gérer <Icon name="arrow-r" />
                    </Link>
                  </div>
                  <OffersList offers={offers} stats={offerStats} orgId={id!} compact />
                </section>
              </div>
              <div className="f-col">
                <section className="card">
                  <div className="card-h">
                    <h2>Dernières utilisations</h2>
                    <Link className="muted" href={`/partenaire/statistiques?org=${id}`}>
                      Statistiques
                    </Link>
                  </div>
                  <ul className="mini-list">
                    {recent.map((c) => (
                      <li key={c.id}>
                        <span>
                          <b>{c.code}</b> · {offers.find((o) => o.id === c.offerId)?.title ?? "Offre"}
                        </span>
                        <span>{c.validatedAt ? at(c.validatedAt) : ""}</span>
                      </li>
                    ))}
                  </ul>
                  {!recent.length && <div className="empty">Aucun code validé pour l’instant.</div>}
                </section>
                <OrgCard entry={entry} href={`/partenaire/etablissement?org=${id}`} />
                {/* --- Vague 2 · Contrats --- */}
                <ContractsCard kind="partner" organizationId={id} profileId={viewer.profile.id} href={`/partenaire/contrats?org=${id}`} title="Contrat partenaire" />
              </div>
            </div>
          </>
        )}
      </div>
    </Screen>
  );
}
