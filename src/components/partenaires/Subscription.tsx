import Link from "next/link";
import { ymdLong } from "@/lib/format";
import { effectiveStatus, PRO_PLANS, SUBSCRIPTION_LABEL } from "@/lib/modules/partenaires/domain";
import type { ProSubscription, SubscriptionPayment } from "@/lib/modules/partenaires/types";
import { Icon } from "../ui/Icon";
import { SubscriptionActions } from "./OrgForms";

/** État de l'abonnement d'une pro : formule, statut (actif / en retard / suspendu), prochaine échéance, visibilité. */
export function SubscriptionSummary({ sub, todayYmd, href }: { sub: ProSubscription | null; todayYmd: string; href?: string }) {
  if (!sub) {
    return (
      <section className="card">
        <div className="card-h">
          <h2>Abonnement</h2>
          <span className="chip rose">Aucun</span>
        </div>
        <p className="muted">Ta fiche n’est pas encore visible dans le carnet. Choisis une formule pour la mettre en ligne.</p>
        {href && (
          <Link className="btn btn-ink btn-sm" href={href}>
            Choisir une formule <Icon name="arrow-r" />
          </Link>
        )}
      </section>
    );
  }
  const st = effectiveStatus(sub, todayYmd);
  const l = SUBSCRIPTION_LABEL[st];
  return (
    <section className="card">
      <div className="card-h">
        <h2>Abonnement {PRO_PLANS[sub.plan].label}</h2>
        <span className={l.cls}>{l.label}</span>
      </div>
      <div className="sub-head">
        <span className="big-num">
          {sub.monthlyPrice} $<small className="muted" style={{ fontSize: 16 }}> / mois</small>
        </span>
        <span className="muted">
          {st === "active" ? (sub.cancelAtPeriodEnd ? "S’arrête le " : "Prochaine échéance le ") : "Échéance dépassée depuis le "}
          <b style={{ color: "var(--tx)" }}>{ymdLong(sub.currentPeriodEnd)}</b>
        </span>
      </div>
      <p className="rule" style={{ marginTop: 14 }}>
        <Icon name={st === "active" ? "check" : "lock"} />
        <span>{l.hint}</span>
      </p>
      {href && (
        <Link className="btn btn-ghost btn-sm" href={href} style={{ marginTop: 14 }}>
          Gérer l’abonnement <Icon name="arrow-r" />
        </Link>
      )}
    </section>
  );
}

export function SubscriptionManager({ organizationId, sub, payments, todayYmd }: { organizationId: string; sub: ProSubscription | null; payments: SubscriptionPayment[]; todayYmd: string }) {
  const st = sub ? effectiveStatus(sub, todayYmd) : null;
  return (
    <>
      <section className="card">
        <div className="card-h">
          <h2>Formule et paiement</h2>
          <span className="muted">Paiement simulé (le vrai paiement arrive avec le lot 2)</span>
        </div>
        <SubscriptionActions organizationId={organizationId} current={sub?.plan ?? null} cancelAtPeriodEnd={sub?.cancelAtPeriodEnd ?? false} needsPayment={!!st && st !== "active"} hasSubscription={!!sub} />
      </section>
      <section className="card">
        <div className="card-h">
          <h2>Historique des paiements</h2>
        </div>
        {payments.length ? (
          <div className="table-scroll">
            <table className="stat-table plain">
              <thead>
                <tr>
                  <th>Période</th>
                  <th>Formule</th>
                  <th>Montant</th>
                  <th>Statut</th>
                  <th>Référence</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {ymdLong(p.periodStart)} → {ymdLong(p.periodEnd)}
                    </td>
                    <td>{PRO_PLANS[p.plan]?.label ?? p.plan}</td>
                    <td>{p.amount} $</td>
                    <td>{p.status === "paid" ? "Payé" : "Refusé"}</td>
                    <td style={{ fontWeight: 400 }}>{p.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">Aucun paiement pour l’instant.</div>
        )}
      </section>
    </>
  );
}
