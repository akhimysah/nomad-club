import Link from "next/link";
import { ymdShortYear } from "@/lib/format";
import { formatMoney } from "@/lib/modules/paiements/money";
import { loadMemberPayments, type HistoryRow } from "@/lib/modules/paiements/views";
import { Icon } from "../ui/Icon";
import { PayNowButtons, PortalButton } from "./client";
import "@/styles/paiements.css";

export function HistoryTable({ rows, empty = "Aucun paiement pour l’instant." }: { rows: HistoryRow[]; empty?: string }) {
  if (!rows.length) return <div className="empty">{empty}</div>;
  return (
    <div className="pay-scroll">
      <table className="pay-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Objet</th>
            <th className="num">Montant</th>
            <th className="opt">Statut</th>
            <th>Reçu</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{ymdShortYear(r.date)}</td>
              <td>
                {r.label}
                <span className="sub">
                  {r.method}
                  {r.receiptNumber ? ` · ${r.receiptNumber}` : ""}
                </span>
              </td>
              <td className="num">
                {formatMoney(r.amount)}
                {r.refunded > 0 && <span className="sub">− {formatMoney(r.refunded)} remboursé</span>}
              </td>
              <td className="opt">{r.status}</td>
              <td>
                {r.receiptHref ? (
                  <a className="link" href={r.receiptHref} download>
                    PDF
                  </a>
                ) : (
                  <span className="muted">—</span>
                )}
                {r.invoiceUrl && (
                  <>
                    {" · "}
                    <a className="link" href={r.invoiceUrl} target="_blank" rel="noopener noreferrer">
                      Facture
                    </a>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * « Mes paiements » : alerte de retard (délai de grâce, régularisation), échéanciers, échéances à venir,
 * historique avec reçus et factures. Commun à /espace/paiements et /mes-paiements (accessible même
 * quand l'accès membre est suspendu, pour régulariser).
 */
export async function MyPaymentsBody({ profileId, demo }: { profileId: string; demo: boolean }) {
  const d = await loadMemberPayments(profileId);
  const late = d.worst;
  const payUrl = late?.installments.find((i) => i.overdue && i.payUrl)?.payUrl ?? null;
  return (
    <>
      {late && (
        <div className="pay-alert" role="alert">
          <Icon name={late.status === "suspended" ? "lock" : "bell"} />
          <div>
            <b>{late.status === "suspended" ? "Ton accès membre est suspendu" : "Une échéance est en retard"}</b>
            <p>
              {late.status === "suspended"
                ? "Une échéance de ton adhésion reste impayée au-delà du délai de grâce. Dès qu’elle est réglée, tu retrouves tout ton espace."
                : `Ton accès est maintenu${late.graceEndsOn ? ` jusqu’au ${ymdShortYear(late.graceEndsOn)}` : ""}. Mets ta carte à jour ou règle l’échéance pour éviter la suspension.`}
            </p>
            <div className="btn-row">
              {payUrl && (
                <a className="btn btn-ink btn-sm" href={payUrl} target="_blank" rel="noopener noreferrer">
                  <Icon name="wallet" />
                  Régler l’échéance
                </a>
              )}
              {d.canManageCard && <PortalButton label="Mettre ma carte à jour" />}
            </div>
            <PayNowButtons planId={late.id} demo={demo} />
          </div>
        </div>
      )}
      <div className="pay-grid">
        <div className="pay-col">
          {d.plans.map((p) => (
            <section className="card" key={p.id}>
              <div className="card-h">
                <h2>{p.title}</h2>
                <span className={p.statusLabel.cls}>{p.statusLabel.label}</span>
              </div>
              <div className="kv">
                <span>Total</span>
                <b>{formatMoney(p.total)}</b>
              </div>
              {p.remaining > 0 && (
                <div className="kv">
                  <span>Reste à payer</span>
                  <b>{formatMoney(p.remaining)}</b>
                </div>
              )}
              <ol className="pay-steps" aria-label="Échéances">
                {p.installments.map((i) => (
                  <li key={i.id} className={i.paid ? "paid" : i.overdue ? "late" : undefined}>
                    <span className="muted">
                      {i.count > 1 ? `${i.seq}/${i.count}` : "Comptant"} · {ymdShortYear(i.dueDate)}
                    </span>
                    <b>{formatMoney(i.amount)}</b>
                    <span>{i.status}</span>
                  </li>
                ))}
              </ol>
              {!late && p.status !== "completed" && p.status !== "pending" && demo && <PayNowButtons planId={p.id} demo={demo} />}
            </section>
          ))}
          <section className="card">
            <div className="card-h">
              <h2>Historique</h2>
              {d.canManageCard && <PortalButton />}
            </div>
            <HistoryTable rows={d.rows} />
          </section>
        </div>
        <div className="pay-col">
          <section className="card">
            <div className="card-h">
              <h2>Échéances à venir</h2>
            </div>
            {d.upcoming.length ? (
              <ul className="mini-list pay-list">
                {d.upcoming.slice(0, 8).map((i) => (
                  <li key={i.id}>
                    <span>
                      <b>{ymdShortYear(i.dueDate)}</b> {i.count > 1 ? `Échéance ${i.seq}/${i.count}` : "Comptant"}
                      {i.overdue ? " · en retard" : ""}
                    </span>
                    <span>{formatMoney(i.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty">
                <Icon name="check" />
                Rien à payer pour l’instant.
              </div>
            )}
            <p className="muted" style={{ fontSize: 14, margin: "14px 0 0" }}>
              Les échéances sont prélevées automatiquement sur ta carte. En cas de refus, tu es prévenue et ton accès reste ouvert pendant le délai de grâce.
            </p>
          </section>
          <section className="card">
            <div className="card-h">
              <h2>Adhésion</h2>
            </div>
            <p className="muted" style={{ margin: "0 0 12px" }}>
              Renouvellement, passage Premium, paiement en 1, 3 ou 12 fois : tout se fait depuis ta carte de membre.
            </p>
            <Link className="btn btn-ghost btn-sm" href="/espace/moi">
              Ma carte et mon adhésion <Icon name="arrow-r" />
            </Link>
            {d.testMode && <p className="pay-test" style={{ marginTop: 14 }}>Paiements en mode test (Stripe)</p>}
          </section>
        </div>
      </div>
    </>
  );
}
