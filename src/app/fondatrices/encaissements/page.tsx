import type { Metadata } from "next";
import { ValidateAllButton } from "@/components/founders/ActionButton";
import { Dues, FHead, VirRow } from "@/components/founders/parts";
import { RevenueChart } from "@/components/founders/RevenueChart";
import { Icon } from "@/components/ui/Icon";
import { Lingering } from "@/components/ui/Lingering";
import { Screen } from "@/components/ui/Screen";
import { TweenNumber } from "@/components/ui/TweenNumber";
import { money } from "@/lib/format";
import { loadDashboard } from "@/lib/founders-view";

export const metadata: Metadata = { title: "Encaissements" };
export const dynamic = "force-dynamic";

export default async function MoneyPage() {
  const { d } = await loadDashboard();
  const adh = d.months.reduce((a, m) => a + m.adh, 0);
  const bil = d.months.reduce((a, m) => a + m.bil, 0);
  const tot = Math.max(1, adh + bil);
  const sumVir = d.vir.reduce((a, r) => a + r.amount, 0);
  const first = d.months[0]?.ym;
  const LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  return (
    <Screen group="founders" index={4} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title="Encaissements" sub="12 derniers mois · adhésions et billets" />
        <div className="kpis" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
          <div className="card kpi">
            <span className="lbl">Total 12 mois</span>
            <div className="val">
              <TweenNumber value={adh + bil} format="money" />
            </div>
            <div className="sub">{first ? `${LONG[Number(first.slice(5, 7)) - 1]} à ${LONG[Number(d.today.slice(5, 7)) - 1]}` : ""}</div>
          </div>
          <div className="card kpi">
            <span className="lbl">
              <i className="lg-adh" style={{ width: 12, height: 12, borderRadius: 4, display: "inline-block" }} />
              Adhésions
            </span>
            <div className="val">
              <TweenNumber value={adh} format="money" />
            </div>
            <div className="sub">{Math.round((adh / tot) * 100)} % du total</div>
          </div>
          <div className="card kpi">
            <span className="lbl">
              <i className="lg-bil" style={{ width: 12, height: 12, borderRadius: 4, display: "inline-block" }} />
              Billets
            </span>
            <div className="val">
              <TweenNumber value={bil} format="money" />
            </div>
            <div className="sub">{Math.round((bil / tot) * 100)} % du total</div>
          </div>
        </div>
        <section className="card">
          <div className="card-h">
            <h2>Par mois</h2>
            <div className="legend" style={{ margin: 0 }}>
              <span>
                <i className="lg-adh" />
                Adhésions
              </span>
              <span>
                <i className="lg-bil" />
                Billets
              </span>
            </div>
          </div>
          <RevenueChart months={d.months} height={300} id="money" />
        </section>
        <div className="f-grid" style={{ marginTop: 22 }}>
          <section className="card">
            <div className="card-h">
              <h2>Virements à valider</h2>
              <span className="muted">
                <TweenNumber value={sumVir} format="money" />
              </span>
            </div>
            <p className="muted" style={{ fontSize: 14.5, margin: "0 0 6px" }}>
              Vérifiez chaque virement sur le compte avant de valider.
            </p>
            <Lingering
              items={d.vir.map((r) => ({ key: `vir:${r.id}`, node: <VirRow r={r} /> }))}
              empty={
                <div className="empty">
                  <Icon name="check" />
                  Tous les virements sont validés.
                </div>
              }
            />
            {d.vir.length > 1 && (
              <div className="tg-foot">
                <span className="muted" style={{ fontSize: 14 }}>
                  {d.vir.length} virements déclarés
                </span>
                <ValidateAllButton keys={d.vir.map((r) => `vir:${r.id}`)} />
              </div>
            )}
          </section>
          <section className="card">
            <div className="card-h">
              <h2>Derniers encaissements</h2>
            </div>
            <ul className="mini-list pay-list">
              {d.recent.map((r, i) => (
                <li key={i}>
                  <span>
                    <b>{r.date}</b> {r.label}
                  </span>
                  <span>{money(r.amount)}</span>
                </li>
              ))}
            </ul>
            <div className="mini-h">Échéances d’adhésion à venir</div>
            <Dues d={d} />
          </section>
        </div>
      </div>
    </Screen>
  );
}
