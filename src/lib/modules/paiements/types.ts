/**
 * Vague 2 · 2a — types du module paiements (reflètent supabase/migrations/0009_paiements.sql en camelCase).
 * Montants en unités de la devise (ex. 223.33), jamais en centimes : la conversion se fait chez le prestataire.
 */
import type { MembershipAction, PaidPlan } from "../../types";

/** Prestataires : Stripe (carte), virement déclaré, simulé (démo uniquement), CMI (prévu, non implémenté). */
export type ProviderId = "stripe" | "transfer" | "simulated" | "cmi";

export type CheckoutKind = "booking" | "membership" | "shop" | "pro_subscription";
export type CheckoutStatus = "open" | "completed" | "expired" | "failed";

/** Une session de paiement lancée par l'appli. Le prestataire ne reçoit que son identifiant (`nc_checkout`). */
export type Checkout = {
  id: string;
  provider: ProviderId;
  kind: CheckoutKind;
  profileId: string | null;
  organizationId: string | null;
  /** Réservation, paiement d'adhésion (payments.id), produit… */
  targetId: string | null;
  plan: string | null;
  installments: number;
  amount: number;
  currency: string;
  status: CheckoutStatus;
  providerRef: string | null;
  subscriptionRef: string | null;
  customerRef: string | null;
  planId: string | null;
  metadata: Record<string, string>;
  createdAt: string;
  completedAt: string | null;
};

export type NewCheckout = Pick<Checkout, "provider" | "kind" | "profileId" | "organizationId" | "targetId" | "plan" | "installments" | "amount" | "currency"> & {
  planId?: string | null;
  metadata?: Record<string, string>;
};

export type CheckoutPatch = Partial<Pick<Checkout, "status" | "providerRef" | "subscriptionRef" | "customerRef" | "planId" | "completedAt" | "targetId">>;

/* ---------- échéanciers ---------- */

export type InstallmentStatus = "scheduled" | "paid" | "failed" | "late" | "cancelled" | "refunded";
export type PlanStatus = "pending" | "active" | "late" | "suspended" | "completed" | "cancelled";

export type Installment = {
  id: string;
  planId: string;
  profileId: string;
  seq: number;
  amount: number;
  /** AAAA-MM-JJ */
  dueDate: string;
  status: InstallmentStatus;
  paidAt: string | null;
  attempts: number;
  lastError: string | null;
  invoiceRef: string | null;
  invoiceUrl: string | null;
  invoicePdf: string | null;
  lastReminderAt: string | null;
};

export type InstallmentPlan = {
  id: string;
  profileId: string;
  /** Ligne « payments » de l'adhésion (validée au premier encaissement). */
  paymentId: string | null;
  plan: PaidPlan;
  action: MembershipAction;
  count: number;
  totalAmount: number;
  currency: string;
  provider: ProviderId;
  checkoutId: string | null;
  subscriptionRef: string | null;
  status: PlanStatus;
  suspendedAt: string | null;
  createdAt: string;
  updatedAt: string;
  installments: Installment[];
};

export type NewPlan = Pick<InstallmentPlan, "profileId" | "paymentId" | "plan" | "action" | "count" | "totalAmount" | "currency" | "provider"> & { checkoutId?: string | null };
export type NewInstallment = Pick<Installment, "seq" | "amount" | "dueDate">;
export type PlanPatch = Partial<Pick<InstallmentPlan, "status" | "subscriptionRef" | "checkoutId" | "suspendedAt" | "paymentId">>;
export type InstallmentPatch = Partial<Pick<Installment, "status" | "paidAt" | "attempts" | "lastError" | "invoiceRef" | "invoiceUrl" | "invoicePdf" | "lastReminderAt">>;

/* ---------- grand livre ---------- */

export type TransactionKind = "membership" | "installment" | "booking" | "pro_subscription" | "shop";
export type TransactionStatus = "succeeded" | "refunded" | "partially_refunded";

export type Transaction = {
  id: string;
  provider: ProviderId;
  kind: TransactionKind;
  profileId: string | null;
  organizationId: string | null;
  amount: number;
  amountRefunded: number;
  currency: string;
  status: TransactionStatus;
  description: string;
  providerRef: string | null;
  chargeRef: string | null;
  invoiceUrl: string | null;
  invoicePdf: string | null;
  receiptNumber: string;
  relatedType: string | null;
  relatedId: string | null;
  createdAt: string;
};

export type NewTransaction = Pick<Transaction, "provider" | "kind" | "profileId" | "organizationId" | "amount" | "currency" | "description"> &
  Partial<Pick<Transaction, "providerRef" | "chargeRef" | "invoiceUrl" | "invoicePdf" | "relatedType" | "relatedId">>;

export type Refund = {
  id: string;
  transactionId: string;
  amount: number;
  reason: string | null;
  providerRef: string | null;
  createdBy: string | null;
  createdAt: string;
};
export type NewRefund = Pick<Refund, "transactionId" | "amount" | "reason" | "providerRef" | "createdBy">;

/* ---------- événements des prestataires ---------- */

export type EventStatus = "received" | "processed" | "failed" | "ignored";

export type StoredEvent = {
  provider: ProviderId;
  eventId: string;
  type: string;
  payload: unknown;
  status: EventStatus;
  attempts: number;
  error: string | null;
  receivedAt: string;
  processedAt: string | null;
};

/** Coordonnées utiles pour prévenir quelqu'un d'un paiement (lues côté serveur, sans session). */
export type Contact = { profileId: string; email: string | null; firstName: string; planEndsAt: string | null };

/** État minimal de l'abonnement d'un pro, lu côté serveur (webhook). */
export type ProSubscriptionLite = { organizationId: string; plan: string; status: string; subscriptionRef: string | null; customerRef: string | null };

/** Propriétaire d'un client chez le prestataire : une personne ou un établissement. */
export type Owner = { profileId: string; organizationId?: null } | { organizationId: string; profileId?: null };

/**
 * Événement normalisé, indépendant du prestataire : c'est tout ce que le traitement connaît.
 * Stripe est traduit par stripe-events.ts ; le paiement simulé fabrique directement ces événements ;
 * un prestataire marocain (CMI…) n'aura qu'à écrire sa traduction.
 */
export type NormalizedEvent =
  | {
      type: "checkout.completed";
      checkoutId: string | null;
      sessionRef: string;
      mode: "payment" | "subscription";
      paid: boolean;
      amount: number | null;
      subscriptionRef: string | null;
      customerRef: string | null;
      paymentRef: string | null;
    }
  | { type: "checkout.expired"; checkoutId: string | null; sessionRef: string }
  | {
      type: "invoice.paid";
      checkoutId: string | null;
      subscriptionRef: string | null;
      invoiceRef: string;
      amount: number;
      customerRef: string | null;
      chargeRef: string | null;
      hostedUrl: string | null;
      pdfUrl: string | null;
      periodStart: string | null;
      periodEnd: string | null;
    }
  | {
      type: "invoice.failed";
      checkoutId: string | null;
      subscriptionRef: string | null;
      invoiceRef: string;
      amount: number;
      error: string | null;
      attempt: number;
      nextAttempt: string | null;
      /** Page de paiement de la facture impayée (Stripe : hosted_invoice_url) pour régulariser soi-même. */
      hostedUrl: string | null;
    }
  | {
      type: "subscription.updated";
      checkoutId: string | null;
      subscriptionRef: string;
      status: "active" | "past_due" | "unpaid" | "canceled" | "incomplete" | "other";
      cancelAtPeriodEnd: boolean;
      currentPeriodEnd: string | null;
    }
  | { type: "subscription.deleted"; checkoutId: string | null; subscriptionRef: string }
  | { type: "charge.refunded"; chargeRef: string | null; paymentRef: string | null; invoiceRef: string | null; amountRefunded: number; refundRef: string | null };

export type PaiementsAuditAction = "payment.refund" | "payment.event_replay" | "membership.suspend" | "membership.reinstate" | "payment.portal";

export type PaiementsNotificationType = "payment_receipt" | "payment_failed" | "payment_reminder" | "membership_suspended" | "membership_renewal" | "refund_issued";
