import Link from "next/link";
import { ymdLong } from "@/lib/format";
import { effectiveStatus, PRO_PLANS, SUBSCRIPTION_LABEL } from "@/lib/modules/partenaires/domain";
import type { ProSubscription, SubscriptionPayment } from "@/lib/modules/partenaires/types";
import { Icon } from "../ui/Icon";
import { SubscriptionActions } from "./OrgForms";
// --- Vague 2 · paiements ---
import { PortalButton } from "../paiements/client";
import { HistoryTable } from "../paiements/MyPaymentsBody";
import type { HistoryRow } from "@/lib/modules/paiements/views";
import { formatMoney } from "@/lib/modules/paiements/money";

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
          {formatMoney(sub.monthlyPrice)}
          <small className="muted" style={{ fontSize: 16 }}> / mois</small>
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

/** --- Vague 2 · paiements --- : état du paiement de l'établissement (prestataire, carte enregistrée, reçus). */
export type ProPay = { provider: "stripe" | "transfer" | "simulated"; canManageCard: boolean; rows: HistoryRow[]; testMode: boolean };

export function SubscriptionManager({ organizationId, sub, payments, todayYmd, pay }: { organizationId: string; sub: ProSubscription | null; payments: SubscriptionPayment[]; todayYmd: string; pay?: ProPay }) {
  const st = sub ? effectiveStatus(sub, todayYmd) : null;
  const mode = pay?.provider ?? "simulated";
  const autoBilled = mode === "stripe" && !!sub?.subscriptionRef && sub.provider === "stripe" && st !== "cancelled";
  return (
    <>
      <section className="card">
        <div className="card-h">
          <h2>Formule et paiement</h2>
          <span className="muted">
            {mode === "stripe"
              ? `Prélèvement mensuel par carte (Stripe${pay?.testMode ? ", mode test" : ""})`
              : mode === "transfer"
                ? "Règlement par virement avec les fondatrices"
                : "Paiement simulé (démo)"}
          </span>
        </div>
        {autoBilled && st !== "active" && (
          <p className="rule">
            <Icon name="bell" />
            <span>Le dernier prélèvement n’est pas passé. Mets ta carte à jour : Stripe relance le paiement automatiquement.</span>
          </p>
        )}
        <SubscriptionActions organizationId={organizationId} current={sub?.plan ?? null} cancelAtPeriodEnd={sub?.cancelAtPeriodEnd ?? false} needsPayment={!!st && st !== "active"} hasSubscription={!!sub} mode={mode} autoBilled={autoBilled} />
        {pay?.canManageCard && (
          <div className="btn-row" style={{ marginTop: 12 }}>
            <PortalButton organizationId={organizationId} label="Gérer ma carte, mes factures, résilier" />
          </div>
        )}
      </section>
      {pay && pay.rows.length > 0 && (
        <section className="card">
          <div className="card-h">
            <h2>Reçus et factures</h2>
          </div>
          <HistoryTable rows={pay.rows} />
        </section>
      )}
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
                    <td>{formatMoney(p.amount)}</td>
                    <td>{p.status === "paid" ? "Payé" : "Refusé"}{p.method === "card" ? " · carte" : p.method === "transfer" ? " · virement" : ""}</td>
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
