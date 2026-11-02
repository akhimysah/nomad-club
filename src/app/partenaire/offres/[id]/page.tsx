import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FHead } from "@/components/founders/parts";
import { OfferForm, OfferStatusButton } from "@/components/partenaires/OrgForms";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { getRepo } from "@/lib/data";
import { num } from "@/lib/format";
import { loadOrgContext } from "@/lib/modules/partenaires/server";

export const metadata: Metadata = { title: "Modifier l’offre" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ org?: string }> };

export default async function Page({ params, searchParams }: Props) {
  const [{ id }, { org }] = await Promise.all([params, searchParams]);
  const repo = getRepo();
  const offer = await repo.getOffer(id);
  const { orgs } = await loadOrgContext("partner", "/partenaire/offres", org);
  // seule l'équipe de l'établissement (ou une administratrice) ouvre l'offre
  if (!offer?.organizationId || !orgs.some((o) => o.organization.id === offer.organizationId)) notFound();
  const st = (await repo.offerStats(offer.organizationId)).find((s) => s.offerId === offer.id);
  return (
    <Screen group="partner" index={1} className="fscreen scroller on">
      <div className="f-inner" style={{ maxWidth: 820 }}>
        <Link className="btn btn-ghost btn-xs" href={`/partenaire/offres?org=${offer.organizationId}`} style={{ marginBottom: 16 }}>
          <Icon name="chev-l" />
          Offres
        </Link>
        <FHead title={offer.title} sub={`${offer.status === "paused" ? "En pause" : "En ligne"} · ${num(st?.generated ?? 0)} codes générés, ${num(st?.validated ?? 0)} validés`} />
        <div className="btn-row" style={{ marginBottom: 18 }}>
          <OfferStatusButton offerId={offer.id} paused={offer.status === "paused"} />
        </div>
        <OfferForm organizationId={offer.organizationId} offer={offer} />
      </div>
    </Screen>
  );
}
