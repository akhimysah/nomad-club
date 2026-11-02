/**
 * Prestataire SIMULÉ — démo uniquement (refusé en mode réel par config.ts) : aucun argent ne bouge.
 * Il fabrique les mêmes événements normalisés que le webhook Stripe, traités par le même code
 * (processor.ts) : la démo et les tests exercent donc le vrai parcours.
 */
import { randomBytes } from "node:crypto";
import { addMonths } from "../schedule.ts";
import type { NormalizedEvent } from "../types";
import type { PaymentProvider } from "./types";

const ref = (prefix: string) => `${prefix}_${randomBytes(6).toString("hex")}`;

/** Facture simulée d'un abonnement (échéance suivante, ou refus de carte). */
export function simulatedInvoice(input: { subscriptionRef: string; checkoutId: string | null; amount: number; periodStart: string; fail?: boolean }): NormalizedEvent {
  const invoiceRef = ref("sim_in");
  if (input.fail) {
    return { type: "invoice.failed", checkoutId: input.checkoutId, subscriptionRef: input.subscriptionRef, invoiceRef, amount: input.amount, error: "Carte refusée (simulation).", attempt: 1, nextAttempt: null };
  }
  return {
    type: "invoice.paid",
    checkoutId: input.checkoutId,
    subscriptionRef: input.subscriptionRef,
    invoiceRef,
    amount: input.amount,
    customerRef: null,
    chargeRef: ref("sim_pi"),
    hostedUrl: null,
    pdfUrl: null,
    periodStart: input.periodStart,
    periodEnd: addMonths(input.periodStart, 1),
  };
}

export function simulatedProvider(opts: { today: () => string; fail?: boolean }): PaymentProvider {
  return {
    id: "simulated",
    label: "Paiement simulé (démo)",
    supports: { installments: true, subscriptions: true, portal: false, refunds: true, hosted: false },
    async startCheckout(input) {
      if (opts.fail) return { type: "error", error: "Paiement refusé par la banque (simulation)." };
      const sessionRef = ref("sim_cs");
      const c = input.checkout;
      if (input.mode === "payment") {
        return {
          type: "events",
          sessionRef,
          events: [{ type: "checkout.completed", checkoutId: c.id, sessionRef, mode: "payment", paid: true, amount: c.amount, subscriptionRef: null, customerRef: null, paymentRef: ref("sim_pi") }],
        };
      }
      const subscriptionRef = ref("sim_sub");
      const first = Math.round(((input.recurring?.amount ?? c.amount) + (input.recurring?.firstExtra ?? 0)) * 100) / 100;
      return {
        type: "events",
        sessionRef,
        events: [
          { type: "checkout.completed", checkoutId: c.id, sessionRef, mode: "subscription", paid: true, amount: first, subscriptionRef, customerRef: ref("sim_cus"), paymentRef: null },
          simulatedInvoice({ subscriptionRef, checkoutId: c.id, amount: first, periodStart: opts.today() }),
        ],
      };
    },
    async limitSubscription() {},
    async setCancelAtPeriodEnd() {},
    async changeSubscriptionAmount() {},
    async refund() {
      return { refundRef: ref("sim_re") };
    },
  };
}
