import Link from "next/link";
import { DraftFillRow, Dues, FHead, FillRow, Legend, Spark, Summary, TodoGroups } from "@/components/founders/parts";
import { RevenueChart } from "@/components/founders/RevenueChart";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { TweenNumber } from "@/components/ui/TweenNumber";
import { cap, monthLongName, money } from "@/lib/format";
import { loadDashboard } from "@/lib/founders-view";

export const dynamic = "force-dynamic";

export default async function FoundersOverview() {
  const { d } = await loadDashboard();
  const [, mm, dd] = d.today.split("-").map(Number);
  const dayLabel = `${dd === 1 ? "1er" : dd} ${monthLongName(mm - 1)}`;
  const weekday = new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "UTC" }).format(new Date(d.today + "T12:00:00Z"));
  return (
    <Screen group="founders" index={0} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title="Vue d’ensemble" sub={`Données au ${weekday} ${dayLabel}`} withNew />
        <Summary d={d} />
        <div className="kpis">
          <Link className="card kpi" href="/fondatrices/membres">
            <span className="lbl">
              <Icon name="users" />
              Adhérentes actives
            </span>
            <div className="val">
              <TweenNumber value={d.activeMembers} />
            </div>
            <div className="sub">
              +{d.newIn12Months} en 12 mois · {d.premiumMembers} Premium
              <br />
              {d.pendingMemberships} adhésion{d.pendingMemberships > 1 ? "s" : ""} en attente
            </div>
            <Spark values={d.growth} />
          </Link>
          <Link className="card kpi" href="/fondatrices/encaissements">
            <span className="lbl">
              <Icon name="wallet" />
              Encaissé au {dayLabel}
            </span>
            <div className="val">
              <TweenNumber value={d.cashThisMonth} format="money" />
            </div>
            <div className="sub">
              {cap(d.prevMonth.label)} : {money(d.prevMonth.total)}
            </div>
          </Link>
          <Link className="card kpi" href="/fondatrices/a-traiter">
            <span className="lbl">
              <Icon name="refresh" />
              À renouveler sous 30 j
            </span>
            <div className="val">
              <TweenNumber value={d.renew30.count} />
            </div>
            <div className="sub">
              {money(d.renew30.amount)} en jeu · {d.renew30.reminded} relancée{d.renew30.reminded > 1 ? "s" : ""}
            </div>
          </Link>
          <Link className="card kpi urgent" href="/fondatrices/a-traiter">
            <span className="lbl">
              <Icon name="bell" />
              Urgentes
            </span>
            <div className="val">
              <TweenNumber value={d.urgent} />
            </div>
            <div className="sub">
              sur <TweenNumber value={d.total} /> actions à traiter
            </div>
          </Link>
        </div>
        <div className="f-grid">
          <div className="f-col">
            <section className="card">
              <div className="card-h">
                <h2>À traiter</h2>
                <span className="muted">
                  <TweenNumber value={d.total} /> actions · un geste chacune
                </span>
              </div>
              <TodoGroups d={d} full={false} />
            </section>
          </div>
          <div className="f-col">
            <section className="card">
              <div className="card-h">
                <h2>Prochains rendez-vous</h2>
                <Link className="link" href="/fondatrices/evenements">
                  Tous <Icon name="arrow-r" />
                </Link>
              </div>
              {d.fills.map((f) => (
                <FillRow key={f.event.id} event={f.event} stats={f.stats} />
              ))}
              {d.draftFills.map((x) => (
                <DraftFillRow key={x.id} d={x} />
              ))}
              <Legend />
            </section>
            <section className="card">
              <div className="card-h">
                <h2>Relances automatiques</h2>
              </div>
              <div className="auto-stats">
                <div>
                  <b>{d.auto.sent30}</b>
                  <span>messages envoyés · 30 j</span>
                </div>
                <div>
                  <b>{d.auto.noAnswer.length}</b>
                  <span>personnes sans réponse</span>
                </div>
                <div>
                  <b>{d.auto.scheduled.length}</b>
                  <span>prévues · 14 j</span>
                </div>
              </div>
              {d.auto.noAnswer.length > 0 && (
                <>
                  <div className="mini-h">Sans réponse</div>
                  <ul className="mini-list">
                    {d.auto.noAnswer.map((r, i) => (
                      <li key={i}>
                        <span>
                          {r.name} · {r.reason}
                        </span>
                        <span>{r.daysAgo === 0 ? "aujourd’hui" : `il y a ${r.daysAgo} j`}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {d.auto.scheduled.length > 0 && (
                <>
                  <div className="mini-h">Prévues</div>
                  <ul className="mini-list">
                    {d.auto.scheduled.map((r, i) => (
                      <li key={i}>
                        <span>
                          <b>{r.date}</b> {r.name}
                        </span>
                        <span>{r.label}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div className="rule">
                <Icon name="clock" />
                <span>
                  <b>La règle :</b> un mois, une semaine et la veille de l’échéance. Échue ou billet impayé sans réponse : J+3 puis J+7. Jamais deux messages le même jour à la même personne.
                </span>
              </div>
            </section>
          </div>
        </div>
        <div className="f-grid" style={{ marginTop: 22, gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr)" }}>
          <section className="card">
            <div className="card-h">
              <h2>Encaissements · 12 derniers mois</h2>
              <span className="muted">
                <b className="big-num" style={{ fontSize: 30, color: "var(--tx)" }}>
                  <TweenNumber value={d.yearTotal} format="money" />
                </b>
              </span>
            </div>
            <div className="legend" style={{ marginTop: 0 }}>
              <span>
                <i className="lg-adh" />
                Adhésions
              </span>
              <span>
                <i className="lg-bil" />
                Billets
              </span>
              <span className="muted">{cap(monthLongName(mm - 1))} en cours</span>
            </div>
            <RevenueChart months={d.months} height={250} id="ov" />
          </section>
          <section className="card">
            <div className="card-h">
              <h2>Échéances d’adhésion</h2>
              <span className="muted">à venir</span>
            </div>
            <Dues d={d} />
            <p className="muted" style={{ fontSize: 14.5, margin: "14px 0 0" }}>
              {d.duesTotal} adhésions arrivent à échéance d’ici {d.duesUntil}. Les relances partent toutes seules.
            </p>
          </section>
        </div>
      </div>
    </Screen>
  );
}
