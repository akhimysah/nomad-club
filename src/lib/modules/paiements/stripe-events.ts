/**
 * Traduction des événements Stripe (webhook) en événements normalisés (types.ts → NormalizedEvent).
 * Pure : aucun appel réseau. Lit les objets de façon tolérante pour fonctionner avec plusieurs versions
 * de l'API Stripe (ex. « clover » : la souscription d'une facture est dans invoice.parent.subscription_details).
 */
import { fromMinor } from "./money.ts";
import type { NormalizedEvent } from "./types";

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
/** Identifiant d'un champ qui peut être une chaîne ou un objet développé ({ id }). */
const ref = (v: unknown): string | null => str(v) ?? (isObj(v) ? str(v.id) : null);
const numOr = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const ymd = (unix: unknown): string | null => (typeof unix === "number" && unix > 0 ? new Date(unix * 1000).toISOString().slice(0, 10) : null);
const meta = (v: unknown): Obj => (isObj(v) ? v : {});

/** Événements Stripe utiles (à cocher dans le tableau de bord Stripe > Webhooks). */
export const STRIPE_EVENT_TYPES = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.expired",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "charge.refunded",
] as const;

function invoiceSubscription(inv: Obj): { subscriptionRef: string | null; metadata: Obj } {
  const parent = meta(inv.parent);
  const details = meta(parent.subscription_details);
  const legacy = meta(inv.subscription_details);
  const lines = meta(inv.lines);
  const first = Array.isArray(lines.data) && isObj(lines.data[0]) ? (lines.data[0] as Obj) : {};
  const subscriptionRef = ref(details.subscription) ?? ref(inv.subscription) ?? ref(first.subscription);
  const metadata = { ...meta(first.metadata), ...meta(legacy.metadata), ...meta(details.metadata), ...meta(inv.metadata) };
  return { subscriptionRef, metadata };
}

function invoicePeriod(inv: Obj): { start: string | null; end: string | null } {
  const lines = meta(inv.lines);
  const first = Array.isArray(lines.data) && isObj(lines.data[0]) ? (lines.data[0] as Obj) : {};
  const period = meta(first.period);
  return { start: ymd(period.start) ?? ymd(inv.period_start), end: ymd(period.end) ?? ymd(inv.period_end) };
}

function invoiceCharge(inv: Obj): string | null {
  const payments = meta(inv.payments);
  const p0 = Array.isArray(payments.data) && isObj(payments.data[0]) ? meta((payments.data[0] as Obj).payment) : {};
  return ref(inv.payment_intent) ?? ref(p0.payment_intent) ?? ref(inv.charge) ?? ref(p0.charge);
}

const SUB_STATUS: Record<string, Extract<NormalizedEvent, { type: "subscription.updated" }>["status"]> = {
  active: "active",
  trialing: "active",
  past_due: "past_due",
  unpaid: "unpaid",
  canceled: "canceled",
  incomplete: "incomplete",
  incomplete_expired: "canceled",
  paused: "other",
};

/** Un événement Stripe (déjà vérifié) → zéro, un ou plusieurs événements normalisés. */
export function normalizeStripeEvent(event: { type: string; data: { object: unknown } }): NormalizedEvent[] {
  const o = meta(event.data?.object);
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const m = meta(o.metadata);
      const paid = str(o.payment_status) === "paid" || str(o.payment_status) === "no_payment_required";
      return [
        {
          type: "checkout.completed",
          checkoutId: str(m.nc_checkout) ?? str(o.client_reference_id),
          sessionRef: str(o.id) ?? "",
          mode: str(o.mode) === "subscription" ? "subscription" : "payment",
          paid,
          amount: typeof o.amount_total === "number" ? fromMinor(o.amount_total) : null,
          subscriptionRef: ref(o.subscription),
          customerRef: ref(o.customer),
          paymentRef: ref(o.payment_intent),
        },
      ];
    }
    case "checkout.session.expired": {
      const m = meta(o.metadata);
      return [{ type: "checkout.expired", checkoutId: str(m.nc_checkout) ?? str(o.client_reference_id), sessionRef: str(o.id) ?? "" }];
    }
    case "invoice.paid": {
      const { subscriptionRef, metadata } = invoiceSubscription(o);
      const period = invoicePeriod(o);
      if (!str(o.id)) return [];
      return [
        {
          type: "invoice.paid",
          checkoutId: str(metadata.nc_checkout),
          subscriptionRef,
          invoiceRef: str(o.id)!,
          amount: fromMinor(numOr(o.amount_paid, numOr(o.total))),
          customerRef: ref(o.customer),
          chargeRef: invoiceCharge(o),
          hostedUrl: str(o.hosted_invoice_url),
          pdfUrl: str(o.invoice_pdf),
          periodStart: period.start,
          periodEnd: period.end,
        },
      ];
    }
    case "invoice.payment_failed": {
      const { subscriptionRef, metadata } = invoiceSubscription(o);
      if (!str(o.id)) return [];
      const lastErr = meta(o.last_finalization_error);
      return [
        {
          type: "invoice.failed",
          checkoutId: str(metadata.nc_checkout),
          subscriptionRef,
          invoiceRef: str(o.id)!,
          amount: fromMinor(numOr(o.amount_due, numOr(o.total))),
          error: str(lastErr.message) ?? null,
          attempt: numOr(o.attempt_count, 1),
          nextAttempt: typeof o.next_payment_attempt === "number" ? new Date(o.next_payment_attempt * 1000).toISOString() : null,
          hostedUrl: str(o.hosted_invoice_url),
        },
      ];
    }
    case "customer.subscription.updated": {
      if (!str(o.id)) return [];
      const items = meta(o.items);
      const item0 = Array.isArray(items.data) && isObj(items.data[0]) ? (items.data[0] as Obj) : {};
      return [
        {
          type: "subscription.updated",
          checkoutId: str(meta(o.metadata).nc_checkout),
          subscriptionRef: str(o.id)!,
          status: SUB_STATUS[str(o.status) ?? ""] ?? "other",
          cancelAtPeriodEnd: o.cancel_at_period_end === true || typeof o.cancel_at === "number",
          currentPeriodEnd: ymd(item0.current_period_end) ?? ymd(o.current_period_end),
        },
      ];
    }
    case "customer.subscription.deleted":
      return str(o.id) ? [{ type: "subscription.deleted", checkoutId: str(meta(o.metadata).nc_checkout), subscriptionRef: str(o.id)! }] : [];
    case "charge.refunded": {
      const refunds = meta(o.refunds);
      const r0 = Array.isArray(refunds.data) && isObj(refunds.data[0]) ? (refunds.data[0] as Obj) : {};
      return [
        {
          type: "charge.refunded",
          chargeRef: str(o.id),
          paymentRef: ref(o.payment_intent),
          invoiceRef: ref(o.invoice),
          amountRefunded: fromMinor(numOr(o.amount_refunded)),
          refundRef: str(r0.id),
        },
      ];
    }
    default:
      return [];
  }
}
