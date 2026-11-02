import type { Metadata } from "next";
import Link from "next/link";
import { FHead } from "@/components/founders/parts";
import { RefundButton, ReplayButton, RunNowButton } from "@/components/paiements/client";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { ymdShortYear } from "@/lib/format";
import { formatMoney } from "@/lib/modules/paiements/money";
import { loadFounderPayments } from "@/lib/modules/paiements/views";
import "@/styles/paiements.css";

export const metadata: Metadata = { title: "Paiements" };
export const dynamic = "force-dynamic";

const EVENT_STATUS: Record<string, string> = { received: "Reçu", processed: "Traité", failed: "En échec", ignored: "Sans effet" };

/**
 * Vague 2 · paiements — pilotage : encaissements par type, échéances à venir, impayés (en retard / suspendus),
 * derniers encaissements avec remboursement, événements du prestataire (rejouables). Tout est journalisé.
 */
export default async function FounderPaymentsPage() {
  await requireCapability("payments.validate", { next: "/fondatrices/paiements" });
  const d = await loadFounderPayments();
  return (
    <Screen group="founders" index={4} className="fscreen scroller on">
      <div className="f-inner">
        <FHead title="Paiements" sub={`Prestataire : ${d.provider === "stripe" ? `Stripe${d.testMode ? " (mode test)" : ""}` : d.provider === "transfer" ? "virement déclaré" : "simulé (démo)"} · délai de grâce ${d.graceDays} jours`} />
        <div className="btn-row" style={{ marginBottom: 18 }}>
          <RunNowButton />
          <Link className="btn btn-ghost btn-sm" href="/fondatrices/encaissements">
            Encaissements et virements <Icon name="arrow-r" />
          </Link>
        </div>
        <div className="kpis" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
          <div className="card kpi">
            <span className="lbl">Encaissé ce mois</span>
            <div className="val">{formatMoney(d.monthTotal)}</div>
            <div className="sub">net des remboursements</div>
          </div>
          <div className="card kpi">
            <span className="lbl">12 derniers mois</span>
            <div className="val">{formatMoney(d.yearTotal)}</div>
            <div className="sub">toutes sources</div>
          </div>
          <div className="card kpi">
            <span className="lbl">Reste à encaisser</span>
            <div className="val">{formatMoney(d.outstanding)}</div>
            <div className="sub">échéances d’adhésion</div>
          </div>
        </div>

        <div className="pay-grid" style={{ marginTop: 22 }}>
          <div className="pay-col">
            <section className="card">
              <div className="card-h">
                <h2>Par type</h2>
              </div>
              <table className="pay-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th className="num">Ce mois</th>
                    <th className="num">12 mois</th>
                    <th className="num opt">Paiements</th>
                  </tr>
                </thead>
                <tbody>
                  {d.byKind.map((k) => (
                    <tr key={k.kind}>
                      <td>{k.label}</td>
                      <td className="num">{formatMoney(k.month)}</td>
                      <td className="num">{formatMoney(k.year)}</td>
                      <td className="num opt">{k.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="card">
              <div className="card-h">
                <h2>Impayés</h2>
                <span className="muted">{d.late.length ? `${d.late.length} adhérente${d.late.length > 1 ? "s" : ""}` : ""}</span>
              </div>
              {d.late.length ? (
                <div className="pay-scroll">
                  <table className="pay-table">
                    <thead>
                      <tr>
                        <th>Membre</th>
                        <th>Statut</th>
                        <th className="num">En retard</th>
                        <th className="num opt">Reste</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.late.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <Link className="link" href={`/fondatrices/crm/contacts?q=${encodeURIComponent(p.name)}`}>
                              {p.name}
                            </Link>
                            <span className="sub">{p.title}</span>
                          </td>
                          <td>
                            <span className={p.statusLabel.cls}>{p.statusLabel.label}</span>
                            {p.graceEndsOn && <span className="sub">accès jusqu’au {ymdShortYear(p.graceEndsOn)}</span>}
                          </td>
                          <td className="num">{formatMoney(p.overdue)}</td>
                          <td className="num opt">{formatMoney(p.remaining)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty">
                  <Icon name="check" />
                  Aucune échéance en retard.
                </div>
              )}
              <p className="muted" style={{ fontSize: 14, margin: "12px 0 0" }}>
                Relance automatique tous les quelques jours (notification et e-mail) ; accès suspendu après {d.graceDays} jours, rétabli dès le paiement.
              </p>
            </section>

            <section className="card">
              <div className="card-h">
                <h2>Derniers encaissements</h2>
              </div>
              {d.recent.length ? (
                <div className="pay-scroll">
                  <table className="pay-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Objet</th>
                        <th className="num">Montant</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.recent.map((r) => (
                        <tr key={r.id}>
                          <td>{ymdShortYear(r.date)}</td>
                          <td>
                            {r.who} · {r.label}
                            <span className="sub">
                              {r.method} · {r.receiptNumber} · {r.status}
                            </span>
                          </td>
                          <td className="num">
                            {formatMoney(r.amount)}
                            {r.refunded > 0 && <span className="sub">− {formatMoney(r.refunded)}</span>}
                          </td>
                          <td>
                            <div className="btn-row">
                              {r.receiptHref && (
                                <a className="link" href={r.receiptHref} download>
                                  Reçu
                                </a>
                              )}
                              {r.refundable && <RefundButton transactionId={r.id} left={r.left} label={r.label} />}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty">Aucun encaissement enregistré.</div>
              )}
            </section>
          </div>

          <div className="pay-col">
            <section className="card">
              <div className="card-h">
                <h2>Échéances à venir</h2>
              </div>
              {d.upcoming.length ? (
                <ul className="mini-list pay-list">
                  {d.upcoming.map((i) => (
                    <li key={i.id}>
                      <span>
                        <b>{ymdShortYear(i.dueDate)}</b> {i.name} · {i.seq}/{i.count}
                      </span>
                      <span>{formatMoney(i.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty">Aucune échéance prévue.</div>
              )}
            </section>

            <section className="card">
              <div className="card-h">
                <h2>Remboursements</h2>
              </div>
              {d.refunds.length ? (
                <ul className="mini-list pay-list">
                  {d.refunds.map((r) => (
                    <li key={r.id}>
                      <span>
                        <b>{ymdShortYear(r.createdAt.slice(0, 10))}</b> {r.label}
                        {r.reason ? ` · ${r.reason}` : ""}
                      </span>
                      <span>{formatMoney(r.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty">Aucun remboursement.</div>
              )}
            </section>

            <section className="card">
              <div className="card-h">
                <h2>Événements du prestataire</h2>
                {d.failedEvents.length > 0 && <span className="chip rose">{d.failedEvents.length} en échec</span>}
              </div>
              {d.events.length ? (
                <ul className="mini-list">
                  {d.events.map((e) => (
                    <li key={`${e.provider}:${e.eventId}`}>
                      <span>
                        <b>{e.type}</b> {EVENT_STATUS[e.status] ?? e.status}
                        {e.attempts > 1 ? ` · ${e.attempts} réceptions` : ""}
                        {e.error && <span className="sub">{e.error}</span>}
                      </span>
                      {(e.status === "failed" || e.status === "received") && <ReplayButton provider={e.provider} eventId={e.eventId} />}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty">Aucun événement reçu pour l’instant.</div>
              )}
              <p className="muted" style={{ fontSize: 14, margin: "12px 0 0" }}>
                Chaque événement n’est traité qu’une fois ; un doublon envoyé par le prestataire est ignoré.
              </p>
            </section>
          </div>
        </div>
      </div>
    </Screen>
  );
}
