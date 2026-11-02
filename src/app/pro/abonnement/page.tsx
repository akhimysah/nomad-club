import type { Metadata } from "next";
import { FHead } from "@/components/founders/parts";
import { NoOrg, OrgPicker } from "@/components/partenaires/OrgBlocks";
import { SubscriptionManager, SubscriptionSummary } from "@/components/partenaires/Subscription";
import { Screen } from "@/components/ui/Screen";
import { today } from "@/lib/clock";
import { getRepo } from "@/lib/data";
import { loadOrgContext } from "@/lib/modules/partenaires/server";

export const metadata: Metadata = { title: "Abonnement" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ org?: string }> };

/** Abonnement mensuel du carnet : formule, statut, échéance, paiement (simulé), historique. */
export default async function Page({ searchParams }: Props) {
  const { org } = await searchParams;
  const { orgs, establishment: e } = await loadOrgContext("pro", "/pro/abonnement", org);
  const repo = getRepo();
  const t = today();
  await repo.refreshSubscriptions(t);
  const [sub, payments] = e ? await Promise.all([repo.getSubscription(e.id), repo.listSubscriptionPayments(e.id)]) : [null, []];
  return (
    <Screen group="pro" index={2} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title="Abonnement" sub={e ? `Référencement de ${e.name} dans le carnet` : "Référencement"} />
        <OrgPicker orgs={orgs} current={e?.id ?? null} base="/pro/abonnement" />
        {!e ? (
          <NoOrg />
        ) : (
          <div className="f-col">
            <SubscriptionSummary sub={sub} todayYmd={t} />
            <SubscriptionManager organizationId={e.id} sub={sub} payments={payments} todayYmd={t} />
          </div>
        )}
      </div>
    </Screen>
  );
}
