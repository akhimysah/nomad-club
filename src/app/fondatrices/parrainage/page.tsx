import type { Metadata } from "next";
import { DeliverGrantButton, RewardEditor } from "@/components/engagement/admin";
import { FHead } from "@/components/founders/parts";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { dayMonthShort } from "@/lib/format";
import { referralStats } from "@/lib/modules/engagement/stats";
import "@/styles/engagement.css";

export const metadata: Metadata = { title: "Parrainage" };
export const dynamic = "force-dynamic";

/** Parrainage (fondatrices) : suivi, récompenses à remettre, configuration des récompenses. */
export default async function AdminReferralPage() {
  await requireCapability("referral.manage", { next: "/fondatrices/parrainage" });
  const repo = getRepo();
  const [refs, rewards] = await Promise.all([repo.listReferrals(), repo.listRewards({ all: true })]);
  const st = referralStats(refs);
  const toDeliver = refs.flatMap((r) => r.grants.filter((g) => g.status === "granted").map((g) => ({ g, r })));
  return (
    <Screen group="founders" index={11} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title="Parrainage" sub="Les membres font entrer leurs amies" />
        <div className="kpis">
          <div className="card kpi">
            <span className="lbl">
              <Icon name="users" />
              Inscriptions parrainées
            </span>
            <div className="val">{st.total}</div>
          </div>
          <div className="card kpi">
            <span className="lbl">
              <Icon name="check" />
              Devenues membres
            </span>
            <div className="val">{st.members}</div>
            <div className="sub">{st.rate} % de conversion</div>
          </div>
          <div className={"card kpi" + (st.toDeliver ? " urgent" : "")}>
            <span className="lbl">
              <Icon name="gift" />
              À remettre
            </span>
            <div className="val">{st.toDeliver}</div>
            <div className="sub">récompense(s)</div>
          </div>
          <div className="card kpi">
            <span className="lbl">
              <Icon name="star" />
              Récompenses actives
            </span>
            <div className="val">{rewards.filter((r) => r.active).length}</div>
          </div>
        </div>
        <div className="f-grid">
          <div className="eg-stack">
            {toDeliver.length > 0 && (
              <section className="card">
                <h2 className="h-sm" style={{ marginBottom: 6 }}>
                  Récompenses à remettre
                </h2>
                {toDeliver.map(({ g, r }) => (
                  <div key={g.id} className="eg-row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                    <span>
                      <b>
                        {g.label} pour {r.referrerName}
                      </b>
                      <span className="sub">
                        Filleule : {r.referredName} · membre le {dayMonthShort(r.convertedAt ?? r.createdAt)}
                      </span>
                    </span>
                    <span className="end">
                      <DeliverGrantButton id={g.id} />
                    </span>
                  </div>
                ))}
              </section>
            )}
            <section className="card">
              <h2 className="h-sm" style={{ marginBottom: 6 }}>
                Tous les parrainages
              </h2>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Marraine</th>
                      <th>Filleule</th>
                      <th>Statut</th>
                      <th className="num">Inscrite</th>
                    </tr>
                  </thead>
                  <tbody>
                    {refs.map((r) => (
                      <tr key={r.id}>
                        <td>{r.referrerName}</td>
                        <td>{r.referredName}</td>
                        <td>
                          <span className={"st" + (r.status === "member" ? " ok" : r.status === "cancelled" ? " no" : "")}>
                            {r.status === "member" ? "Membre" : r.status === "cancelled" ? "Annulé" : "Compte gratuit"}
                          </span>
                        </td>
                        <td className="num">{dayMonthShort(r.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
          <div className="eg-stack">
            <section className="card">
              <h2 className="h-sm">Meilleures marraines</h2>
              {st.topReferrers.map((x, i) => (
                <div key={x.name + i} className="eg-row">
                  <span className={"rank" + (i < 3 ? " top" : "")}>{i + 1}</span>
                  <span>
                    <b>{x.name}</b>
                    <span className="sub">{x.total} inscription(s)</span>
                  </span>
                  <span className="end">
                    <b>{x.members} membre(s)</b>
                  </span>
                </div>
              ))}
            </section>
            <section className="card">
              <h2 className="h-sm">Récompenses</h2>
              <p className="w-empty">Attribuées automatiquement à la marraine quand sa filleule devient membre. Les points sont crédités tout de suite ; les autres sont à remettre.</p>
              {rewards.map((r) => (
                <RewardEditor key={r.id} reward={r} />
              ))}
              <RewardEditor reward={null} />
            </section>
          </div>
        </div>
      </div>
    </Screen>
  );
}
