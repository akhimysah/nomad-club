import type { Metadata } from "next";
import { FHead } from "@/components/founders/parts";
import { NoOrg, OrgPicker } from "@/components/partenaires/OrgBlocks";
import { SubscriptionManager, SubscriptionSummary } from "@/components/partenaires/Subscription";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { today } from "@/lib/clock";
import { getRepo } from "@/lib/data";
import { loadProPayments } from "@/lib/modules/paiements/views"; // --- Vague 2 · paiements ---
import { loadOrgContext } from "@/lib/modules/partenaires/server";
import "@/styles/paiements.css";

export const metadata: Metadata = { title: "Abonnement" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ org?: string; paiement?: string }> };

/**
 * Abonnement mensuel du carnet : formule, statut, échéance, paiement, historique et reçus.
 * Vague 2 : paiement par le prestataire configuré (Stripe : abonnement mensuel, portail client).
 */
export default async function Page({ searchParams }: Props) {
  const { org, paiement } = await searchParams;
  const { orgs, establishment: e } = await loadOrgContext("pro", "/pro/abonnement", org);
  const repo = getRepo();
  const t = today();
  await repo.refreshSubscriptions(t);
  const [sub, payments, pay] = e ? await Promise.all([repo.getSubscription(e.id), repo.listSubscriptionPayments(e.id), loadProPayments(e.id)]) : [null, [], null];
  return (
    <Screen group="pro" index={2} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title="Abonnement" sub={e ? `Référencement de ${e.name} dans le carnet` : "Référencement"} />
        <OrgPicker orgs={orgs} current={e?.id ?? null} base="/pro/abonnement" />
        {!e ? (
          <NoOrg />
        ) : (
          <div className="f-col">
            {paiement === "ok" && sub?.status !== "active" && (
              <div className="flash" role="status">
                <Icon name="clock" />
                Paiement reçu, confirmation en cours : ta fiche passe en ligne dans quelques secondes (recharge la page).
              </div>
            )}
            <SubscriptionSummary sub={sub} todayYmd={t} />
            <SubscriptionManager
              organizationId={e.id}
              sub={sub}
              payments={payments}
              todayYmd={t}
              pay={pay ? { provider: pay.provider, canManageCard: pay.canManageCard, rows: pay.rows, testMode: pay.testMode } : undefined}
            />
          </div>
        )}
      </div>
    </Screen>
  );
}
