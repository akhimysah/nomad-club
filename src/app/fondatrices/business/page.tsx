import type { Metadata } from "next";
import { BusinessSettingsForm } from "@/components/engagement/admin";
import { Bars } from "@/components/engagement/Bars";
import { FHead } from "@/components/founders/parts";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { today } from "@/lib/clock";
import { getRepo } from "@/lib/data";
import { dayMonthShort, money } from "@/lib/format";
import { businessStats } from "@/lib/modules/engagement/stats";
import type { DealCategory } from "@/lib/modules/engagement/types";
import "@/styles/engagement.css";

export const metadata: Metadata = { title: "Espace Business" };
export const dynamic = "force-dynamic";

const CAT: Record<DealCategory, string> = { prestation: "Prestations", vente: "Ventes", partenariat: "Partenariats", recommandation: "Recommandations", autre: "Autres" };
const STATUS = { pending: "En attente", confirmed: "Confirmé", refused: "Non confirmé" } as const;
const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(".0", "").replace(".", ",")} k$` : `${n} $`);

/** Espace Business (fondatrices) : retombées économiques du réseau, deals, barème. */
export default async function AdminBusinessPage() {
  await requireCapability("business.manage", { next: "/fondatrices/business" });
  const repo = getRepo();
  const [deals, settings, board] = await Promise.all([repo.listDeals(), repo.getEngagementSettings(), repo.leaderboard(5)]);
  const st = businessStats(deals, today());
  return (
    <Screen group="founders" index={12} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title="Espace Business" sub="Les affaires conclues entre membres" />
        <p className="no-fee">
          <Icon name="lock" />
          <span>Déclaratif : le club ne prélève aucune commission et n’est pas partie aux deals. Les montants sont estimés par les membres.</span>
        </p>
        <div className="kpis">
          <div className="card kpi">
            <span className="lbl">
              <Icon name="wallet" />
              Volume généré
            </span>
            <div className="val">{money(st.volume)}</div>
            <div className="sub">moyenne {money(st.average)} par deal</div>
          </div>
          <div className="card kpi">
            <span className="lbl">
              <Icon name="check" />
              Deals confirmés
            </span>
            <div className="val">{st.confirmed}</div>
            <div className="sub">{st.last30} sur 30 jours</div>
          </div>
          <div className="card kpi">
            <span className="lbl">
              <Icon name="users" />
              Membres actives
            </span>
            <div className="val">{st.activeMembers}</div>
            <div className="sub">ont conclu au moins un deal</div>
          </div>
          <div className="card kpi">
            <span className="lbl">
              <Icon name="clock" />
              En attente
            </span>
            <div className="val">{st.pending}</div>
            <div className="sub">{st.confirmRate} % confirmés</div>
          </div>
        </div>
        <div className="f-grid">
          <div className="eg-stack">
            <section className="card">
              <h2 className="h-sm">Volume confirmé sur 6 mois</h2>
              <Bars data={st.months} format={compact} />
            </section>
            <section className="card">
              <h2 className="h-sm" style={{ marginBottom: 6 }}>
                Tous les deals
              </h2>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Deal</th>
                      <th>Statut</th>
                      <th className="num">Montant</th>
                      <th className="num">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deals.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <b style={{ fontWeight: 600 }}>{d.nature}</b>
                          <div className="muted" style={{ fontSize: 13 }}>
                            {d.declaredByName} → {d.partnerName}
                          </div>
                        </td>
                        <td>
                          <span className={"st" + (d.status === "confirmed" ? " ok" : d.status === "refused" ? " no" : "")}>{STATUS[d.status]}</span>
                        </td>
                        <td className="num">{d.amount ? money(d.amount) : "—"}</td>
                        <td className="num">{dayMonthShort(d.dealDate + "T12:00:00Z")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
          <div className="eg-stack">
            <section className="card">
              <h2 className="h-sm" style={{ marginBottom: 6 }}>
                Par type
              </h2>
              {st.byCategory.map(([c, x]) => (
                <div key={c} className="kv">
                  <span>
                    {CAT[c]} · {x.count}
                  </span>
                  <b>{money(x.amount)}</b>
                </div>
              ))}
              {!st.byCategory.length && <p className="w-empty">Pas encore de deal confirmé.</p>}
            </section>
            <section className="card">
              <h2 className="h-sm">Les plus connectées</h2>
              {st.topConnectors.map(([id, x], i) => (
                <div key={id} className="eg-row">
                  <span className={"rank" + (i < 3 ? " top" : "")}>{i + 1}</span>
                  <span>
                    <b>{x.name}</b>
                    <span className="sub">{money(x.amount)}</span>
                  </span>
                  <span className="end">
                    <b>{x.count} deal(s)</b>
                  </span>
                </div>
              ))}
            </section>
            <section className="card">
              <h2 className="h-sm">Classement des points</h2>
              {board.map((r, i) => (
                <div key={r.profileId} className="kv">
                  <span>
                    {i + 1}. {r.name}
                  </span>
                  <b>{r.points} pts</b>
                </div>
              ))}
            </section>
            <section className="card">
              <h2 className="h-sm" style={{ marginBottom: 12 }}>
                Barème des points
              </h2>
              <BusinessSettingsForm s={settings} />
            </section>
          </div>
        </div>
      </div>
    </Screen>
  );
}
