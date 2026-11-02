/**
 * Lot 3 — paiement de l'abonnement mensuel des pros du carnet.
 *
 * PAIEMENT SIMULÉ : c'est le seul point d'entrée pour encaisser un abonnement. Le Lot 2 remplacera
 * `charge()` par le vrai prestataire (Stripe, CMI…) sans toucher aux pages ni aux actions :
 * elles n'appellent que `paySubscription()`.
 */
import { randomUUID } from "node:crypto";
import { today } from "../../clock";
import { getRepo } from "../../data";
import { nextPeriod, PRO_PLANS } from "./domain";
import type { ProPlan, ProSubscription } from "./types";

export type PayResult = { ok: true; subscription: ProSubscription; reference: string; amount: number } | { ok: false; error: string };

/** Simulation de l'encaissement. `fail` permet de tester le refus de paiement (carte refusée). */
async function charge(input: { organizationId: string; amount: number; fail?: boolean }): Promise<{ ok: true; reference: string } | { ok: false; reference: string; error: string }> {
  const reference = `SIM-${input.organizationId.replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;
  if (input.fail) return { ok: false, reference, error: "Paiement refusé par la banque (simulation)." };
  return { ok: true, reference };
}

/**
 * Paie le mois suivant de l'abonnement (ou le premier mois) avec la formule donnée :
 * encaisse, enregistre le paiement et remet la fiche en ligne jusqu'à la nouvelle échéance.
 */
export async function paySubscription(organizationId: string, plan: ProPlan, opts: { fail?: boolean } = {}): Promise<PayResult> {
  const repo = getRepo();
  const t = today();
  const current = await repo.getSubscription(organizationId);
  const amount = PRO_PLANS[plan].price;
  const period = nextPeriod(current, t);
  const res = await charge({ organizationId, amount, fail: opts.fail });
  try {
    const subscription = await repo.recordSubscriptionPayment({
      organizationId, plan, amount, monthlyPrice: amount, status: res.ok ? "paid" : "failed",
      reference: res.reference, periodStart: period.start, periodEnd: period.end,
    });
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true, subscription, reference: res.reference, amount };
  } catch (e) {
    return { ok: false, error: res.ok ? (e instanceof Error ? e.message : "Paiement impossible.") : res.error };
  }
}
