/**
 * Prestataire Stripe : Checkout (paiement unique et abonnements), Billing (échéances, relances de carte
 * automatiques de Stripe), portail client, remboursements, webhook signé.
 * Mode test tant que STRIPE_SECRET_KEY commence par sk_test_ ; rien ne change dans le code pour passer en live.
 */
import type Stripe from "stripe";
import { getStripe } from "../../../stripe.ts";
import { toMinor } from "../money.ts";
import { addMonths } from "../schedule.ts";
import { normalizeStripeEvent } from "../stripe-events.ts";
import type { PaymentProvider, StartCheckoutInput, StartCheckoutResult, VerifiedWebhook } from "./types";

/** Date (secondes Unix) `count` mois après `anchor`, à la même heure (jour ramené à la fin du mois si besoin). */
export function monthsAfterUnix(anchor: number, count: number): number {
  const d = new Date(anchor * 1000);
  const ymd = addMonths(d.toISOString().slice(0, 10), count);
  const t = Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
  return Math.floor(t / 1000);
}

/** Vérifie la signature d'un webhook avec une instance Stripe donnée (testable sans réseau). */
export function verifyStripeWebhook(stripe: Pick<Stripe, "webhooks">, rawBody: string, signature: string | null, secret: string | undefined): VerifiedWebhook {
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET manquant.");
  if (!signature) throw new Error("Signature Stripe manquante.");
  const event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  return { eventId: event.id, type: event.type, payload: event, events: normalizeStripeEvent(event) };
}

function lineItems(input: StartCheckoutInput): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const currency = input.checkout.currency.toLowerCase();
  if (input.mode === "payment") {
    return [{ quantity: 1, price_data: { currency, unit_amount: toMinor(input.checkout.amount), product_data: { name: `Nomad Club · ${input.label}` } } }];
  }
  const r = input.recurring;
  if (!r) throw new Error("Montant mensuel manquant.");
  const items: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    r.priceId
      ? { quantity: 1, price: r.priceId }
      : { quantity: 1, price_data: { currency, unit_amount: toMinor(r.amount), recurring: { interval: "month" }, product_data: { name: `Nomad Club · ${r.label ?? input.label}` } } },
  ];
  if (r.firstExtra && r.firstExtra > 0) {
    // une seule fois, sur la première facture : le centime d'arrondi de l'échéancier (670 = 223,34 + 223,33 × 2)
    items.push({ quantity: 1, price_data: { currency, unit_amount: toMinor(r.firstExtra), product_data: { name: "Arrondi de l’échéancier" } } });
  }
  return items;
}

export function stripeProvider(): PaymentProvider {
  return {
    id: "stripe",
    label: "Carte bancaire (Stripe)",
    supports: { installments: true, subscriptions: true, portal: true, refunds: true, hosted: true },

    async startCheckout(input): Promise<StartCheckoutResult> {
      const stripe = getStripe();
      const metadata = { nc_checkout: input.checkout.id, kind: input.checkout.kind };
      const params: Stripe.Checkout.SessionCreateParams = {
        mode: input.mode,
        line_items: lineItems(input),
        metadata,
        client_reference_id: input.checkout.id,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        locale: "fr",
      };
      if (input.customerRef) params.customer = input.customerRef;
      else if (input.customerEmail) params.customer_email = input.customerEmail;
      if (input.mode === "payment") {
        params.payment_intent_data = { metadata, description: `Nomad Club · ${input.label}` };
        if (!input.customerRef) params.customer_creation = "always";
        if (input.expiresInMinutes) params.expires_at = Math.floor(Date.now() / 1000) + Math.max(30, input.expiresInMinutes) * 60;
        if (process.env.STRIPE_INVOICE_ONE_TIME === "true") params.invoice_creation = { enabled: true, invoice_data: { metadata } };
      } else {
        params.subscription_data = { metadata, description: `Nomad Club · ${input.label}` };
      }
      const session = await stripe.checkout.sessions.create(params, { idempotencyKey: `nc-checkout-${input.checkout.id}` });
      if (!session.url) return { type: "error", error: "Stripe n’a pas renvoyé de page de paiement." };
      return { type: "redirect", url: session.url, sessionRef: session.id };
    },

    async limitSubscription(subscriptionRef, count) {
      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(subscriptionRef);
      const anchor = sub.billing_cycle_anchor || sub.start_date;
      await stripe.subscriptions.update(subscriptionRef, { cancel_at: monthsAfterUnix(anchor, count), proration_behavior: "none" });
    },

    async setCancelAtPeriodEnd(subscriptionRef, cancel) {
      await getStripe().subscriptions.update(subscriptionRef, { cancel_at_period_end: cancel });
    },

    async changeSubscriptionAmount(subscriptionRef, amount, priceId) {
      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(subscriptionRef);
      const item = sub.items.data[0];
      if (!item) throw new Error("Abonnement Stripe sans ligne.");
      const product = typeof item.price.product === "string" ? item.price.product : item.price.product.id;
      await stripe.subscriptions.update(subscriptionRef, {
        items: [priceId ? { id: item.id, price: priceId } : { id: item.id, price_data: { currency: item.price.currency, product, unit_amount: toMinor(amount), recurring: { interval: "month" } } }],
        proration_behavior: "none",
      });
    },

    async portalUrl(customerRef, returnUrl) {
      const s = await getStripe().billingPortal.sessions.create({ customer: customerRef, return_url: returnUrl, locale: "fr" });
      return s.url;
    },

    async refund(tx, amount, reason) {
      const stripe = getStripe();
      let paymentIntent: string | null = tx.chargeRef && tx.chargeRef.startsWith("pi_") ? tx.chargeRef : null;
      const charge = tx.chargeRef && tx.chargeRef.startsWith("ch_") ? tx.chargeRef : null;
      if (!paymentIntent && !charge && tx.providerRef?.startsWith("cs_")) {
        const s = await stripe.checkout.sessions.retrieve(tx.providerRef);
        paymentIntent = typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? null);
      }
      if (!paymentIntent && !charge && tx.providerRef?.startsWith("in_")) {
        const list = await stripe.invoicePayments.list({ invoice: tx.providerRef, limit: 1 });
        const p = list.data[0]?.payment;
        paymentIntent = p?.payment_intent ? (typeof p.payment_intent === "string" ? p.payment_intent : p.payment_intent.id) : null;
      }
      if (!paymentIntent && !charge) throw new Error("Paiement Stripe introuvable pour ce remboursement.");
      const r = await stripe.refunds.create({
        ...(paymentIntent ? { payment_intent: paymentIntent } : { charge: charge! }),
        amount: toMinor(amount),
        reason: "requested_by_customer",
        metadata: { nc_transaction: tx.id, ...(reason ? { note: reason.slice(0, 450) } : {}) },
      });
      return { refundRef: r.id };
    },

    verifyWebhook(rawBody, headers) {
      return verifyStripeWebhook(getStripe(), rawBody, headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET);
    },

    normalize(payload) {
      const e = payload as { type?: unknown; data?: { object?: unknown } };
      if (typeof e?.type !== "string" || !e.data) return [];
      return normalizeStripeEvent({ type: e.type, data: { object: e.data.object } });
    },
  };
}
