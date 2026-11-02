import type { Metadata } from "next";
import Link from "next/link";
import { FHead } from "@/components/founders/parts";
import { NoOrg, OffersList, OrgPicker } from "@/components/partenaires/OrgBlocks";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { getRepo } from "@/lib/data";
import { loadOrgContext } from "@/lib/modules/partenaires/server";

export const metadata: Metadata = { title: "Offres" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ org?: string }> };

export default async function Page({ searchParams }: Props) {
  const { org } = await searchParams;
  const { orgs, entry } = await loadOrgContext("partner", "/partenaire/offres", org);
  const id = entry?.organization.id ?? null;
  const repo = getRepo();
  const [offers, stats] = id ? await Promise.all([repo.listOffers({ organizationId: id }), repo.offerStats(id)]) : [[], []];
  return (
    <Screen group="partner" index={1} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title="Offres" sub={entry ? `Ce que ${entry.organization.name} offre aux membres` : "Tes offres"} />
        <OrgPicker orgs={orgs} current={id} base="/partenaire/offres" />
        {!id ? (
          <NoOrg />
        ) : (
          <section className="card">
            <div className="card-h">
              <h2>
                {offers.filter((o) => o.status === "active").length} en ligne · {offers.filter((o) => o.status === "paused").length} en pause
              </h2>
              <Link className="btn btn-ink btn-sm" href={`/partenaire/offres/nouvelle?org=${id}`}>
                <Icon name="plus" />
                Nouvelle offre
              </Link>
            </div>
            <OffersList offers={offers} stats={stats} orgId={id} />
            <p className="rule" style={{ marginTop: 16 }}>
              <Icon name="ticket" />
              <span>Chaque membre obtient un code personnel horodaté (et son QR) en touchant « Utiliser l’offre ». Tu le valides dans l’onglet Valider : il ne sert qu’une fois.</span>
            </p>
          </section>
        )}
      </div>
    </Screen>
  );
}
