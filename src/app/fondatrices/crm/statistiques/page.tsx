import type { Metadata } from "next";
import { BarChart, HBars } from "@/components/crm/Charts";
import { Icon } from "@/components/ui/Icon";
import { money } from "@/lib/format";
import { loadDealOutcomes } from "@/lib/modules/crm/business-source";
import { loadCrm } from "@/lib/modules/crm/load";
import { computeStats } from "@/lib/modules/crm/stats";

export const metadata: Metadata = { title: "Statistiques" };
export const dynamic = "force-dynamic";

const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)} %`);

/** Statistiques : conversion, renouvellement, revenus, cohortes, retombées des deals. */
export default async function StatsPage() {
  const { data, rows, snapshot, today } = await loadCrm();
  const outcomes = await loadDealOutcomes(today);
  const s = computeStats({ data, rows, profiles: snapshot.profiles, payments: snapshot.payments, today, outcomes });
  const c = s.conversion;
  return (
    <>
      <div className="crm-head">
        <div>
          <div className="eyebrow">12 derniers mois</div>
          <h1>Statistiques</h1>
        </div>
      </div>

      <div className="skpis">
        <section className="card skpi">
          <div className="lbl">Conversion prospects → adhérentes</div>
          <div className="val">{pct(c.rate)}</div>
          <div className="sub">
            {c.won} gagnées, {c.lost} perdues · {c.open} en cours
          </div>
        </section>
        <section className="card skpi">
          <div className="lbl">Taux de renouvellement</div>
          <div className="val">{pct(s.renewal.rate)}</div>
          <div className="sub">
            {s.renewal.renewed} renouvelées, {s.renewal.lapsed} non renouvelées · {s.renewal.due30} à renouveler sous 30 j
          </div>
        </section>
        <section className="card skpi">
          <div className="lbl">Revenus encaissés</div>
          <div className="val">
            {Math.round(s.revenue.total12 / 1000)}
            <small>k$</small>
          </div>
          <div className="sub">{money(s.revenue.total12)} en 12 mois</div>
        </section>
        <section className="card skpi">
          <div className="lbl">Pipeline ouvert</div>
          <div className="val">
            {Math.round(c.openValue / 100) / 10}
            <small>k$</small>
          </div>
          <div className="sub">{money(c.wonValue)} déjà gagnés</div>
        </section>
      </div>

      <div className="sgrid">
        <section className="card">
          <div className="card-h">
            <h2>Revenus par mois</h2>
            <span className="muted">adhésions et billets</span>
          </div>
          <BarChart
            label="Revenus par mois, adhésions et billets"
            points={s.revenue.months.map((m) => ({ label: m.label, adh: m.adh, bil: m.bil }))}
            series={[
              { key: "adh", label: "Adhésions", color: "#333333" },
              { key: "bil", label: "Billets", color: "#c5c5c5" },
            ]}
          />
        </section>

        <section className="card">
          <div className="card-h">
            <h2>Revenus par formule</h2>
            <span className="muted">12 mois</span>
          </div>
          <HBars items={s.revenue.byPlan.map((p, i) => ({ label: p.label, value: p.amount, sub: `${p.count} paiement${p.count > 1 ? "s" : ""}`, light: i === 2 }))} />
        </section>

        <section className="card">
          <div className="card-h">
            <h2>Conversion par mois</h2>
            <span className="muted">opportunités créées et gagnées</span>
          </div>
          <BarChart
            label="Opportunités créées et gagnées par mois"
            mode="group"
            unit="count"
            height={200}
            points={c.byMonth.map((m) => ({ label: m.label, created: m.created, won: m.won }))}
            series={[
              { key: "created", label: "Nouvelles opportunités", color: "#c5c5c5" },
              { key: "won", label: "Adhésions gagnées", color: "#333333" },
            ]}
          />
        </section>

        <section className="card">
          <div className="card-h">
            <h2>Conversion par source</h2>
            <span className="muted">gagnées / opportunités</span>
          </div>
          <HBars unit="pct" items={c.bySource.map((x) => ({ label: x.label, value: x.rate ?? 0, sub: `${x.won}/${x.total}` }))} />
          {c.lostReasons.length > 0 && (
            <>
              <h3 className="mini-h">Motifs de perte</h3>
              <HBars unit="count" items={c.lostReasons.map((x) => ({ label: x.reason, value: x.count, light: true }))} />
            </>
          )}
        </section>

        <section className="card">
          <div className="card-h">
            <h2>Cohortes</h2>
            <span className="muted">année d’arrivée → encore adhérentes</span>
          </div>
          <table className="cohorts">
            <thead>
              <tr>
                <th>Arrivées en</th>
                <th className="num">Adhérentes</th>
                <th className="num">Encore là</th>
                <th style={{ width: "40%" }}>Fidélité</th>
              </tr>
            </thead>
            <tbody>
              {s.cohorts.map((k) => (
                <tr key={k.year}>
                  <td>{k.year}</td>
                  <td className="num">{k.joined}</td>
                  <td className="num">{k.active}</td>
                  <td>
                    <span className="hbars" style={{ display: "block", margin: 0 }}>
                      <span className="track" style={{ display: "block" }}>
                        <i style={{ width: `${k.rate * 100}%` }} />
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card">
          <div className="card-h">
            <h2>Retombées des deals</h2>
            {s.deals.sample && <span className="sample">Exemples</span>}
          </div>
          {!s.deals.available ? (
            <div className="empty">
              <Icon name="spark" />
              Les deals déclarés par les membres (Espace Business) apparaîtront ici dès que le module sera branché.
            </div>
          ) : (
            <>
              <p className="muted" style={{ margin: "0 0 6px", fontSize: 14 }}>
                {money(s.deals.total)} de chiffre d’affaires déclaré entre membres · {s.deals.count} deals · aucune commission prélevée par le club.
              </p>
              <BarChart label="Retombées des deals par mois" height={180} points={s.deals.months.map((m) => ({ label: m.label, amount: m.amount }))} series={[{ key: "amount", label: "Deals", color: "#333333" }]} />
              <h3 className="mini-h">Par secteur</h3>
              <HBars items={s.deals.bySector.map((x) => ({ label: x.sector, value: x.amount }))} />
            </>
          )}
        </section>
      </div>
    </>
  );
}
