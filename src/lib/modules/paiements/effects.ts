/**
 * Effets d'un paiement confirmé sur le reste de l'appli, pour processor.ts :
 * réservation payée, adhésion ouverte, achat de la boutique, abonnement pro, notifications, e-mails,
 * point d'extension « souscription activée » (contrats). Tout passe par le Repo.
 * Le webhook n'a pas de session : les lectures utilisent les méthodes serveur de PaiementsRepo
 * (payContact, payOrgContacts, payProSubscription) et les écritures les fonctions de confiance existantes.
 */
import { getRepo } from "../../data";
import { sendEmail } from "../../mail-hook";
import { notify, waitlistSpot } from "../../notify";
import { emitSubscriptionActivated } from "../../payment-hooks";
import { inCircle } from "../../permissions";
import { isProPlan, PRO_PLANS } from "../partenaires/domain";
import type { PaymentEffects } from "./processor";

export function appEffects(): PaymentEffects {
  const repo = getRepo();
  const findPro = async (subscriptionRef: string) => {
    const c = await repo.payFindCheckout({ subscriptionRef });
    if (c?.kind === "pro_subscription" && c.organizationId) return { organizationId: c.organizationId, plan: c.plan ?? "essentiel" };
    return null;
  };
  return {
    async markBookingPaid(ref, bookingId) {
      await repo.markStripeSessionPaid(ref, { kind: "booking", id: bookingId });
    },
    async releaseBooking(bookingId) {
      const { eventId, waitlistProfileId } = await repo.cancelBooking(bookingId, null);
      if (eventId && waitlistProfileId) {
        const ev = await repo.getEventById(eventId);
        const next = await repo.payContact(waitlistProfileId);
        const prof = next ? await repo.getProfile(waitlistProfileId).catch(() => null) : null;
        if (ev) await waitlistSpot(waitlistProfileId, ev, prof ? inCircle(prof) : false);
      }
    },
    async activateMembership(ref, paymentId) {
      await repo.markStripeSessionPaid(ref, { kind: "membership", id: paymentId });
    },
    async grantPurchase(input) {
      const product = await repo.getProduct({ id: input.productId }).catch(() => null);
      await repo.recordPurchase({ productId: input.productId, profileId: input.profileId, amount: input.amount, method: "card", paymentRef: input.reference });
      return product ? { title: product.title } : null;
    },
    async linkProSubscription(input) {
      const sub = await repo.payProSubscription(input.organizationId);
      if (!sub) return; // l'abonnement sera créé au premier encaissement (invoice.paid)
      if (sub.subscriptionRef === input.subscriptionRef && (!input.customerRef || sub.customerRef === input.customerRef)) return;
      await repo.updateSubscription(input.organizationId, {
        provider: input.provider,
        ...(input.subscriptionRef ? { subscriptionRef: input.subscriptionRef } : {}),
        ...(input.customerRef ? { customerRef: input.customerRef } : {}),
      });
    },
    async recordProPayment(input) {
      const before = await repo.payProSubscription(input.organizationId);
      const wanted = input.plan ?? before?.plan ?? "essentiel";
      const plan = isProPlan(wanted) ? wanted : "essentiel";
      try {
        await repo.recordSubscriptionPayment({
          organizationId: input.organizationId, plan, amount: input.amount, monthlyPrice: input.status === "paid" ? input.amount : PRO_PLANS[plan].price,
          status: input.status, reference: input.reference, periodStart: input.periodStart, periodEnd: input.periodEnd,
          method: input.provider === "simulated" ? "simulated" : input.provider === "transfer" ? "transfer" : "card", provider: input.provider,
        });
      } catch (e) {
        if (input.status === "failed") return null; // refus avant tout abonnement : rien à enregistrer côté carnet
        throw e;
      }
      return { activated: input.status === "paid" && (!before || before.status !== "active"), plan, planLabel: PRO_PLANS[plan].label };
    },
    async syncProSubscription(input) {
      const pro = input.organizationId ? { organizationId: input.organizationId } : await findPro(input.subscriptionRef);
      if (!pro) return null;
      if (!(await repo.payProSubscription(pro.organizationId))) return null;
      await repo.updateSubscription(pro.organizationId, {
        subscriptionRef: input.subscriptionRef,
        ...(input.status ? { status: input.status } : {}),
        ...(input.cancelAtPeriodEnd !== undefined ? { cancelAtPeriodEnd: input.cancelAtPeriodEnd } : {}),
        ...(input.currentPeriodEnd && input.status !== "cancelled" ? { currentPeriodEnd: input.currentPeriodEnd } : {}),
      });
      return { organizationId: pro.organizationId };
    },
    findProBySubscription: findPro,
    contact: (profileId) => repo.payContact(profileId),
    orgContacts: (organizationId) => repo.payOrgContacts(organizationId),
    async notify(rows) {
      await notify(rows);
    },
    async email(message) {
      await sendEmail(message);
    },
    async subscriptionActivated(event) {
      await emitSubscriptionActivated(event);
    },
  };
}
