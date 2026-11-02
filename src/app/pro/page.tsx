import Link from "next/link";
import { FHead } from "@/components/founders/parts";
import { SoonCards } from "@/components/org/SoonCards";
import { MonthKpis, NoOrg, OrgPicker } from "@/components/partenaires/OrgBlocks";
import { SubscriptionSummary } from "@/components/partenaires/Subscription";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { today } from "@/lib/clock";
import { getRepo } from "@/lib/data";
import { CATEGORY_LABEL, isListed } from "@/lib/modules/partenaires/domain";
import { loadOrgContext } from "@/lib/modules/partenaires/server";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ org?: string }> };

/** Dashboard pro du carnet (Lot 3) : visibilité de la fiche, abonnement, chiffres du mois. */
export default async function Page({ searchParams }: Props) {
  const { org } = await searchParams;
  const { viewer, orgs, establishment: e, asAdmin } = await loadOrgContext("pro", "/pro", org);
  const repo = getRepo();
  const t = today();
  await repo.refreshSubscriptions(t);
  const [sub, stats] = e ? await Promise.all([repo.getSubscription(e.id), repo.orgMonthlyStats(e.id, 6)]) : [null, []];
  const listed = isListed(sub, t);
  return (
    <Screen group="pro" index={0} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title={`Bonjour ${viewer.profile.firstName}`} sub={e ? `Espace pro · ${e.name}` : "Espace professionnelle du carnet"} />
        {asAdmin && (
          <p className="rule" style={{ marginBottom: 18 }}>
            <Icon name="lock" />
            <span>Tu vois cet espace en tant qu’administratrice : choisis une fiche.</span>
          </p>
        )}
        <OrgPicker orgs={orgs} current={e?.id ?? null} base="/pro" />
        {!e ? (
          <NoOrg />
        ) : (
          <>
            <MonthKpis rows={stats} mode="pro" />
            <div className="f-grid">
              <div className="f-col">
                <section className="card org-card">
                  <div>
                    <div className="eyebrow">{e.category}</div>
                    <h2>{e.name}</h2>
                    {e.description && <p className="muted" style={{ margin: 0 }}>{e.description}</p>}
                    <div className="org-meta">
                      {e.area && (
                        <span>
                          <Icon name="pin" />
                          {e.area}
                        </span>
                      )}
                      {e.details.carnetCategory && (
                        <span>
                          <Icon name="book" />
                          {CATEGORY_LABEL[e.details.carnetCategory]}
                        </span>
                      )}
                      {e.details.memberDiscount && (
                        <span>
                          <Icon name="gift" />
                          {e.details.memberDiscount}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
                    <span className={listed ? "chip solid" : "chip rose"}>{listed ? "Visible dans le carnet" : "Masquée"}</span>
                    <Link className="btn btn-ghost btn-sm" href={`/pro/fiche?org=${e.id}`}>
                      Modifier <Icon name="arrow-r" />
                    </Link>
                  </div>
                </section>
                <section className="card">
                  <div className="card-h">
                    <h2>Ta fiche, côté membres</h2>
                  </div>
                  <p className="muted" style={{ margin: "6px 0 0", fontSize: 15 }}>
                    {listed
                      ? "Elle apparaît dans le carnet avec le badge « Pro du réseau », sur la carte, et chaque clic (téléphone, WhatsApp, itinéraire) est compté dans tes statistiques."
                      : "Elle est masquée tant que l’abonnement n’est pas réglé. Rien n’est perdu : elle revient dès le paiement."}
                  </p>
                  <div className="btn-row" style={{ marginTop: 14 }}>
                    <Link className="btn btn-ghost btn-sm" href={`/pro/statistiques?org=${e.id}`}>
                      <Icon name="spark" />
                      Statistiques
                    </Link>
                  </div>
                </section>
              </div>
              <div className="f-col">
                <SubscriptionSummary sub={sub} todayYmd={t} href={`/pro/abonnement?org=${e.id}`} />
                <SoonCards items={[{ icon: "edit", title: "Contrat", text: "Contrat généré, accepté en ligne et archivé ici en PDF.", lot: "lot 2" }]} />
              </div>
            </div>
          </>
        )}
      </div>
    </Screen>
  );
}
