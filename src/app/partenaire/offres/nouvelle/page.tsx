import type { Metadata } from "next";
import Link from "next/link";
import { FHead } from "@/components/founders/parts";
import { NoOrg } from "@/components/partenaires/OrgBlocks";
import { OfferForm } from "@/components/partenaires/OrgForms";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { loadOrgContext } from "@/lib/modules/partenaires/server";

export const metadata: Metadata = { title: "Nouvelle offre" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ org?: string }> };

export default async function Page({ searchParams }: Props) {
  const { org } = await searchParams;
  const { entry } = await loadOrgContext("partner", "/partenaire/offres", org);
  return (
    <Screen group="partner" index={1} className="fscreen scroller on">
      <div className="f-inner" style={{ maxWidth: 820 }}>
        <Link className="btn btn-ghost btn-xs" href={`/partenaire/offres${entry ? `?org=${entry.organization.id}` : ""}`} style={{ marginBottom: 16 }}>
          <Icon name="chev-l" />
          Offres
        </Link>
        <FHead title="Nouvelle offre" sub={entry?.organization.name ?? ""} />
        {entry ? <OfferForm organizationId={entry.organization.id} offer={null} /> : <NoOrg />}
      </div>
    </Screen>
  );
}
