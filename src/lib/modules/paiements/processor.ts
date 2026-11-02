/**
 * Traitement des événements de paiement normalisés (webhook Stripe, paiement simulé, plus tard CMI).
 * UN SEUL endroit met la base à jour après un paiement. Chaque traitement est idempotent : rejouer un
 * événement (doublon Stripe, rejeu par une admin) ne crée ni double encaissement ni double accès.
 *
 * Dépendances injectées (testable sans serveur) : le stockage (PaiementsRepo) et les effets sur le reste
 * de l'appli (réservation payée, adhésion ouverte, achat, abonnement pro, notifications, e-mails).
 */
import type { SubscriptionActivated } from "../../payment-hooks";
import type { NotificationInput } from "../../data/repo";
import type { EmailMessage } from "../../mail-hook";
import { longDate, METHOD_LABEL, PAYMENT_EMAILS } from "./emails.ts";
import { formatMoney } from "./money.ts";
import type { PaiementsRepo } from "./repo";
import { addMonths, graceEndsOn, nextUnpaid, planStatus } from "./schedule.ts";
import type { Checkout, Contact, InstallmentPlan, NormalizedEvent, ProviderId, Transaction } from "./types";

export type { Contact };
export type ProStatusSync = "active" | "past_due" | "suspended" | "cancelled";

export interface PaymentEffects {
  markBookingPaid(ref: string, bookingId: string): Promise<void>;
  releaseBooking(bookingId: string): Promise<void>;
  /** Valide la ligne « payments » de l'adhésion et ouvre l'adhésion (idempotent). */
  activateMembership(ref: string, paymentId: string): Promise<void>;
  /** Donne accès à la ressource (idempotent) ; renvoie son titre. */
  grantPurchase(input: { productId: string; profileId: string; amount: number; reference: string }): Promise<{ title: string } | null>;
  linkProSubscription(input: { organizationId: string; provider: ProviderId; subscriptionRef: string | null; customerRef: string | null }): Promise<void>;
  recordProPayment(input: {
    organizationId: string;
    plan: string | null;
    amount: number;
    reference: string;
    periodStart: string;
    periodEnd: string;
    status: "paid" | "failed";
    provider: ProviderId;
  }): Promise<{ activated: boolean; plan: string; planLabel: string } | null>;
  syncProSubscription(input: { subscriptionRef: string; organizationId?: string | null; status?: ProStatusSync; cancelAtPeriodEnd?: boolean; currentPeriodEnd?: string | null }): Promise<{ organizationId: string } | null>;
  findProBySubscription(subscriptionRef: string): Promise<{ organizationId: string; plan: string } | null>;
  contact(profileId: string): Promise<Contact | null>;
  /** Propriétaires et équipe de l'établissement. */
  orgContacts(organizationId: string): Promise<Contact[]>;
  notify(rows: NotificationInput[]): Promise<void>;
  email(message: EmailMessage): Promise<void>;
  subscriptionActivated(event: SubscriptionActivated): Promise<void>;
}

export type ProcessorDeps = {
  repo: PaiementsRepo;
  effects: PaymentEffects;
  /** Limite l'abonnement chez le prestataire à N prélèvements (adhésion en plusieurs fois). */
  limitSubscription?: (subscriptionRef: string, count: number) => Promise<void>;
  graceDays: number;
  today: () => string;
  now: () => string;
};

export type ProcessOutcome = "done" | "ignored";

const PLAN_NAME = { member: "Membre", premium: "Premium" } as const;
const ACTION_NAME = { join: "Adhésion", renew: "Renouvellement", upgrade: "Passage à Premium" } as const;

/** « Adhésion Membre · échéance 2/3 » ou « Renouvellement Premium · 1 an ». */
export function installmentLabel(plan: Pick<InstallmentPlan, "plan" | "action" | "count">, seq: number): string {
  const head = plan.action === "upgrade" ? ACTION_NAME.upgrade : `${ACTION_NAME[plan.action]} ${PLAN_NAME[plan.plan]}`;
  return plan.count > 1 ? `${head} · échéance ${seq}/${plan.count}` : `${head} · 1 an`;
}

async function findCheckout(repo: PaiementsRepo, by: { checkoutId?: string | null; sessionRef?: string | null; subscriptionRef?: string | null }): Promise<Checkout | null> {
  if (by.checkoutId) {
    const c = await repo.payGetCheckout(by.checkoutId);
    if (c) return c;
  }
  if (by.sessionRef) {
    const c = await repo.payFindCheckout({ providerRef: by.sessionRef });
    if (c) return c;
  }
  if (by.subscriptionRef) return repo.payFindCheckout({ subscriptionRef: by.subscriptionRef });
  return null;
}

async function findPlan(repo: PaiementsRepo, c: Checkout | null, subscriptionRef: string | null): Promise<InstallmentPlan | null> {
  if (c?.planId) {
    const p = await repo.payGetPlan(c.planId);
    if (p) return p;
  }
  if (subscriptionRef) return repo.payFindPlan({ subscriptionRef });
  return null;
}

/** E-mail « payment_receipt » (données mises en forme, schéma du chantier e-mails). */
function receiptEmail(t: Transaction, link: string, installment = ""): { template: string; data: Record<string, unknown> } {
  return {
    template: PAYMENT_EMAILS.receipt,
    data: { amount: formatMoney(t.amount, { currency: t.currency }), label: t.description, method: METHOD_LABEL[t.provider] ?? t.provider, paidAt: longDate(t.createdAt), reference: t.receiptNumber, installment, link },
  };
}

async function tellMember(d: ProcessorDeps, profileId: string, n: Omit<NotificationInput, "recipientId">, email: { template: string; data: Record<string, unknown> } | null) {
  await d.effects.notify([{ recipientId: profileId, ...n }]);
  if (!email) return;
  const c = await d.effects.contact(profileId);
  if (c?.email) await d.effects.email({ template: email.template, to: c.email, data: { firstName: c.firstName, ...email.data } });
}

async function tellOrg(d: ProcessorDeps, organizationId: string, n: Omit<NotificationInput, "recipientId">, email: { template: string; data: Record<string, unknown> } | null) {
  const people = await d.effects.orgContacts(organizationId);
  await d.effects.notify(people.map((p) => ({ recipientId: p.profileId, ...n })));
  if (!email) return;
  for (const p of people) if (p.email) await d.effects.email({ template: email.template, to: p.email, data: { firstName: p.firstName, ...email.data } });
}

/**
 * Règle une échéance de l'échéancier (la prochaine non payée), ouvre l'adhésion au premier encaissement,
 * rétablit l'accès si l'échéancier était suspendu. Idempotent par référence de facture.
 */
export async function settleInstallment(
  d: ProcessorDeps,
  provider: ProviderId,
  plan: InstallmentPlan,
  info: { ref: string; amount: number | null; chargeRef: string | null; invoiceUrl: string | null; invoicePdf: string | null },
): Promise<ProcessOutcome> {
  const already = plan.installments.find((i) => i.invoiceRef === info.ref);
  const wasActive = plan.installments.some((i) => i.status === "paid");
  // l'ouverture de l'adhésion est idempotente : on la (re)tente aussi lors d'un rejeu
  if (plan.paymentId && (wasActive || !already)) await d.effects.activateMembership(info.ref, plan.paymentId);
  if (already) return "done";
  const target = nextUnpaid(plan.installments);
  if (!target) {
    await d.repo.payAudit({ actorId: null, action: "payment.event_replay", targetType: "payment", targetId: plan.id, summary: `Encaissement en trop sur un échéancier soldé (${info.ref})`, details: { ref: info.ref } });
    return "ignored";
  }
  const updated = await d.repo.payUpdateInstallment(
    target.id,
    { status: "paid", paidAt: d.now(), invoiceRef: info.ref, invoiceUrl: info.invoiceUrl, invoicePdf: info.invoicePdf, lastError: null },
    ["scheduled", "failed", "late"],
  );
  if (!updated) return "done";
  const amount = info.amount ?? target.amount;
  const label = installmentLabel(plan, target.seq);
  const { fresh, transaction } = await d.repo.payRecordTransaction({
    provider, kind: plan.count > 1 ? "installment" : "membership", profileId: plan.profileId, organizationId: null, amount, currency: plan.currency,
    description: label, providerRef: info.ref, chargeRef: info.chargeRef, invoiceUrl: info.invoiceUrl, invoicePdf: info.invoicePdf,
    relatedType: "installment_plan", relatedId: plan.id,
  });

  const fresh_plan = (await d.repo.payGetPlan(plan.id)) ?? plan;
  const status = planStatus(fresh_plan, d.today(), d.graceDays);
  await d.repo.payUpdatePlan(plan.id, { status, ...(status !== "suspended" ? { suspendedAt: null } : {}) });
  if (plan.status === "suspended" && status !== "suspended") {
    await d.repo.paySetMemberAccess(plan.profileId, true);
    await d.repo.payAudit({ actorId: null, action: "membership.reinstate", targetType: "profile", targetId: plan.profileId, summary: `Accès membre rétabli après paiement (${label})`, details: { plan: plan.id } });
    await tellMember(d, plan.profileId, { type: "payment_receipt", title: "Ton accès est rétabli", body: "Merci, ton paiement est bien arrivé : tu retrouves tout ton espace membre.", link: "/mes-paiements" }, null /* relayée par e-mail (notification) */);
  }
  if (fresh) {
    const next = nextUnpaid(fresh_plan.installments);
    await tellMember(
      d, plan.profileId,
      { type: "payment_receipt", title: `Paiement reçu · ${formatMoney(amount)}`, body: `${label}.${next ? ` Prochaine échéance le ${next.dueDate.split("-").reverse().join(".")} : ${formatMoney(next.amount)}.` : ""}`, link: "/mes-paiements" },
      receiptEmail(transaction, "/mes-paiements", plan.count > 1 ? `${target.seq}/${plan.count}` : ""),
    );
  }
  if (!wasActive) {
    const c = await d.effects.contact(plan.profileId);
    await d.effects.subscriptionActivated({
      kind: "membership", profileId: plan.profileId, organizationId: null, plan: plan.plan, amount: plan.totalAmount, currency: plan.currency,
      installments: plan.count, startsAt: d.today(), endsAt: c?.planEndsAt ?? null, reference: plan.id,
    });
  }
  return "done";
}

async function onCheckoutCompleted(d: ProcessorDeps, provider: ProviderId, e: Extract<NormalizedEvent, { type: "checkout.completed" }>): Promise<ProcessOutcome> {
  const c = await findCheckout(d.repo, { checkoutId: e.checkoutId, sessionRef: e.sessionRef });
  if (!c) return "ignored";
  if (e.mode === "payment" && !e.paid) return "ignored"; // paiement différé : « async_payment_succeeded » suivra
  await d.repo.payUpdateCheckout(c.id, {
    status: "completed",
    completedAt: c.completedAt ?? d.now(),
    ...(c.providerRef ? {} : { providerRef: e.sessionRef }),
    ...(e.subscriptionRef ? { subscriptionRef: e.subscriptionRef } : {}),
    ...(e.customerRef ? { customerRef: e.customerRef } : {}),
  });
  if (e.customerRef) {
    if (c.organizationId) await d.repo.paySetCustomer(provider, { organizationId: c.organizationId }, e.customerRef);
    else if (c.profileId) await d.repo.paySetCustomer(provider, { profileId: c.profileId }, e.customerRef);
  }
  const amount = e.amount ?? c.amount;
  switch (c.kind) {
    case "booking": {
      if (!c.targetId) return "ignored";
      await d.effects.markBookingPaid(e.sessionRef, c.targetId);
      const label = c.metadata.label ?? "Billet";
      const { fresh, transaction } = await d.repo.payRecordTransaction({
        provider, kind: "booking", profileId: c.profileId, organizationId: null, amount, currency: c.currency, description: label,
        providerRef: e.sessionRef, chargeRef: e.paymentRef, relatedType: "booking", relatedId: c.targetId,
      });
      if (fresh && c.profileId) await tellMember(d, c.profileId, { type: "payment_receipt", title: `Paiement reçu · ${formatMoney(amount)}`, body: `${label}. Ton reçu est dans « Mes paiements ».`, link: "/mes-paiements" }, receiptEmail(transaction, "/mes-paiements"));
      return "done";
    }
    case "membership": {
      const plan = await findPlan(d.repo, c, e.subscriptionRef);
      if (!plan) return "ignored";
      if (e.mode === "subscription") {
        if (e.subscriptionRef && plan.subscriptionRef !== e.subscriptionRef) await d.repo.payUpdatePlan(plan.id, { subscriptionRef: e.subscriptionRef });
        // N prélèvements, pas un de plus : l'abonnement s'arrête tout seul après la dernière échéance
        if (e.subscriptionRef && d.limitSubscription) await d.limitSubscription(e.subscriptionRef, plan.count);
        return "done"; // l'encaissement arrive par « invoice.paid »
      }
      return settleInstallment(d, provider, plan, { ref: e.sessionRef, amount, chargeRef: e.paymentRef, invoiceUrl: null, invoicePdf: null });
    }
    case "shop": {
      if (!c.targetId || !c.profileId) return "ignored";
      const g = await d.effects.grantPurchase({ productId: c.targetId, profileId: c.profileId, amount, reference: e.sessionRef });
      const label = `Boutique · ${g?.title ?? c.metadata.label ?? "ressource"}`;
      const { fresh, transaction } = await d.repo.payRecordTransaction({
        provider, kind: "shop", profileId: c.profileId, organizationId: null, amount, currency: c.currency, description: label,
        providerRef: e.sessionRef, chargeRef: e.paymentRef, relatedType: "product", relatedId: c.targetId,
      });
      if (fresh) await tellMember(d, c.profileId, { type: "payment_receipt", title: `Paiement reçu · ${formatMoney(amount)}`, body: `${label}. Ta ressource est dans « Mes ressources ».`, link: "/espace/boutique/mes-ressources" }, receiptEmail(transaction, "/espace/boutique/mes-ressources"));
      return "done";
    }
    case "pro_subscription": {
      if (!c.organizationId) return "ignored";
      await d.effects.linkProSubscription({ organizationId: c.organizationId, provider, subscriptionRef: e.subscriptionRef, customerRef: e.customerRef });
      return "done"; // l'encaissement arrive par « invoice.paid »
    }
  }
}

async function onInvoicePaid(d: ProcessorDeps, provider: ProviderId, e: Extract<NormalizedEvent, { type: "invoice.paid" }>): Promise<ProcessOutcome> {
  const c = await findCheckout(d.repo, { checkoutId: e.checkoutId, subscriptionRef: e.subscriptionRef });
  const plan = c?.kind === "pro_subscription" ? null : await findPlan(d.repo, c, e.subscriptionRef);
  if (plan) {
    if (e.subscriptionRef && !plan.subscriptionRef) await d.repo.payUpdatePlan(plan.id, { subscriptionRef: e.subscriptionRef });
    return settleInstallment(d, provider, plan, { ref: e.invoiceRef, amount: e.amount, chargeRef: e.chargeRef, invoiceUrl: e.hostedUrl, invoicePdf: e.pdfUrl });
  }
  const pro = c?.organizationId ? { organizationId: c.organizationId, plan: c.plan } : e.subscriptionRef ? await d.effects.findProBySubscription(e.subscriptionRef) : null;
  if (!pro) return "ignored";
  if (await d.repo.payFindTransaction({ providerRef: e.invoiceRef, system: true })) return "done";
  if (e.subscriptionRef) await d.effects.linkProSubscription({ organizationId: pro.organizationId, provider, subscriptionRef: e.subscriptionRef, customerRef: e.customerRef });
  const start = e.periodStart ?? d.today();
  const r = await d.effects.recordProPayment({
    organizationId: pro.organizationId, plan: pro.plan, amount: e.amount, reference: e.invoiceRef, periodStart: start, periodEnd: e.periodEnd ?? addMonths(start, 1), status: "paid", provider,
  });
  const label = `Carnet d’adresses · ${r?.planLabel ?? "abonnement"} · mois du ${start.split("-").reverse().join(".")}`;
  const { fresh, transaction } = await d.repo.payRecordTransaction({
    provider, kind: "pro_subscription", profileId: c?.profileId ?? null, organizationId: pro.organizationId, amount: e.amount, currency: c?.currency ?? "USD",
    description: label, providerRef: e.invoiceRef, chargeRef: e.chargeRef, invoiceUrl: e.hostedUrl, invoicePdf: e.pdfUrl, relatedType: "organization", relatedId: pro.organizationId,
  });
  if (fresh) await tellOrg(d, pro.organizationId, { type: "payment_receipt", title: `Paiement reçu · ${formatMoney(e.amount)}`, body: `${label}. Ta fiche reste en ligne.`, link: "/pro/abonnement" }, receiptEmail(transaction, "/pro/abonnement"));
  if (r?.activated) {
    const owner = c?.profileId ?? (await d.effects.orgContacts(pro.organizationId))[0]?.profileId;
    if (owner)
      await d.effects.subscriptionActivated({
        kind: "pro_listing", profileId: owner, organizationId: pro.organizationId, plan: r.plan, amount: e.amount, currency: c?.currency ?? "USD", installments: 1,
        startsAt: start, endsAt: null, reference: e.subscriptionRef ?? e.invoiceRef,
      });
  }
  return "done";
}

async function onInvoiceFailed(d: ProcessorDeps, provider: ProviderId, e: Extract<NormalizedEvent, { type: "invoice.failed" }>): Promise<ProcessOutcome> {
  const c = await findCheckout(d.repo, { checkoutId: e.checkoutId, subscriptionRef: e.subscriptionRef });
  const plan = c?.kind === "pro_subscription" ? null : await findPlan(d.repo, c, e.subscriptionRef);
  if (plan) {
    const target = nextUnpaid(plan.installments);
    if (!target) return "ignored";
    const ok = await d.repo.payUpdateInstallment(target.id, { status: "failed", attempts: target.attempts + 1, lastError: e.error ?? "Paiement refusé.", ...(e.hostedUrl ? { invoiceUrl: e.hostedUrl } : {}) }, ["scheduled", "failed", "late"]);
    if (!ok) return "done";
    const fresh = (await d.repo.payGetPlan(plan.id)) ?? plan;
    const status = planStatus(fresh, d.today(), d.graceDays);
    if (status !== plan.status) await d.repo.payUpdatePlan(plan.id, { status });
    const grace = graceEndsOn(fresh.installments, d.today(), d.graceDays);
    const label = installmentLabel(plan, target.seq);
    await tellMember(
      d, plan.profileId,
      { type: "payment_failed", title: "Ton paiement n’est pas passé", body: `${label} · ${formatMoney(target.amount)}. Mets ta carte à jour${grace ? ` avant le ${grace.split("-").reverse().join(".")}` : ""} pour garder ton accès.`, link: "/mes-paiements" },
      { template: PAYMENT_EMAILS.failed, data: { label, amount: formatMoney(target.amount), dueDate: longDate(target.dueDate), reason: e.error ?? "Carte refusée par la banque.", payUrl: e.hostedUrl ?? "/mes-paiements" } },
    );
    return "done";
  }
  const pro = c?.organizationId ? { organizationId: c.organizationId, plan: c.plan } : e.subscriptionRef ? await d.effects.findProBySubscription(e.subscriptionRef) : null;
  if (!pro) return "ignored";
  const start = d.today();
  await d.effects.recordProPayment({ organizationId: pro.organizationId, plan: pro.plan, amount: e.amount, reference: e.invoiceRef, periodStart: start, periodEnd: addMonths(start, 1), status: "failed", provider });
  await tellOrg(
    d, pro.organizationId,
    { type: "payment_failed", title: "Le paiement de ton abonnement n’est pas passé", body: `${formatMoney(e.amount)}. Mets ta carte à jour depuis « Abonnement » pour garder ta fiche en ligne.`, link: "/pro/abonnement" },
    { template: PAYMENT_EMAILS.failed, data: { label: "ton abonnement au carnet d’adresses", amount: formatMoney(e.amount), dueDate: longDate(d.today()), reason: e.error ?? "Carte refusée par la banque.", payUrl: e.hostedUrl ?? "/pro/abonnement" } },
  );
  return "done";
}

const PRO_STATUS: Partial<Record<Extract<NormalizedEvent, { type: "subscription.updated" }>["status"], ProStatusSync>> = {
  active: "active",
  past_due: "past_due",
  unpaid: "suspended",
  canceled: "cancelled",
};

async function onSubscriptionChange(d: ProcessorDeps, e: Extract<NormalizedEvent, { type: "subscription.updated" | "subscription.deleted" }>): Promise<ProcessOutcome> {
  const c = await findCheckout(d.repo, { checkoutId: e.checkoutId, subscriptionRef: e.subscriptionRef });
  const plan = c?.kind === "pro_subscription" ? null : await findPlan(d.repo, c, e.subscriptionRef);
  if (plan) {
    // fin normale après la dernière échéance, ou arrêt par Stripe après ses relances : le statut se
    // déduit des échéances (la tâche quotidienne suspend si besoin)
    const status = planStatus(plan, d.today(), d.graceDays);
    if (status !== plan.status) await d.repo.payUpdatePlan(plan.id, { status });
    return "done";
  }
  const status = e.type === "subscription.deleted" ? "cancelled" : PRO_STATUS[e.status];
  const r = await d.effects.syncProSubscription({
    subscriptionRef: e.subscriptionRef,
    organizationId: c?.organizationId ?? null,
    status,
    ...(e.type === "subscription.updated" ? { cancelAtPeriodEnd: e.cancelAtPeriodEnd, currentPeriodEnd: e.currentPeriodEnd } : {}),
  });
  if (!r) return "ignored";
  if (status === "suspended")
    await tellOrg(
      d, r.organizationId,
      { type: "payment_failed", title: "Ta fiche est suspendue", body: "Ton abonnement est impayé : ta fiche n’apparaît plus dans le carnet. Mets ta carte à jour pour la remettre en ligne.", link: "/pro/abonnement" },
      null /* relayée par e-mail (notification) */,
    );
  return "done";
}

async function onChargeRefunded(d: ProcessorDeps, e: Extract<NormalizedEvent, { type: "charge.refunded" }>): Promise<ProcessOutcome> {
  let tx = null;
  if (e.paymentRef) tx = await d.repo.payFindTransaction({ chargeRef: e.paymentRef, system: true });
  if (!tx && e.chargeRef) tx = await d.repo.payFindTransaction({ chargeRef: e.chargeRef, system: true });
  if (!tx && e.invoiceRef) tx = await d.repo.payFindTransaction({ providerRef: e.invoiceRef, system: true });
  if (!tx) return "ignored";
  const total = Math.min(tx.amount, Math.max(tx.amountRefunded, e.amountRefunded));
  if (total <= tx.amountRefunded) return "done";
  const delta = Math.round((total - tx.amountRefunded) * 100) / 100;
  await d.repo.payUpdateTransaction(tx.id, { amountRefunded: total, status: total >= tx.amount ? "refunded" : "partially_refunded" });
  const { fresh } = await d.repo.payRecordRefund({ transactionId: tx.id, amount: delta, reason: "Remboursement Stripe", providerRef: e.refundRef, createdBy: null });
  if (fresh && tx.profileId)
    await tellMember(d, tx.profileId, { type: "refund_issued", title: `Remboursement · ${formatMoney(delta)}`, body: `${tx.description}. Le montant revient sur ta carte sous quelques jours.`, link: "/mes-paiements" }, null /* relayée par e-mail (notification) */);
  return "done";
}

async function onCheckoutExpired(d: ProcessorDeps, e: Extract<NormalizedEvent, { type: "checkout.expired" }>): Promise<ProcessOutcome> {
  const c = await findCheckout(d.repo, { checkoutId: e.checkoutId, sessionRef: e.sessionRef });
  if (!c || c.status !== "open") return c ? "done" : "ignored";
  await d.repo.payUpdateCheckout(c.id, { status: "expired" });
  if (c.kind === "booking" && c.targetId) await d.effects.releaseBooking(c.targetId);
  if (c.planId) await d.repo.payUpdatePlan(c.planId, { status: "cancelled" });
  return "done";
}

/** Point d'entrée unique du traitement d'un événement normalisé. */
export async function processEvent(d: ProcessorDeps, provider: ProviderId, e: NormalizedEvent): Promise<ProcessOutcome> {
  switch (e.type) {
    case "checkout.completed":
      return onCheckoutCompleted(d, provider, e);
    case "checkout.expired":
      return onCheckoutExpired(d, e);
    case "invoice.paid":
      return onInvoicePaid(d, provider, e);
    case "invoice.failed":
      return onInvoiceFailed(d, provider, e);
    case "subscription.updated":
    case "subscription.deleted":
      return onSubscriptionChange(d, e);
    case "charge.refunded":
      return onChargeRefunded(d, e);
  }
}

/**
 * Enregistre puis traite un événement de prestataire, une seule fois.
 * - nouveau : traité, marqué « processed » (ou « ignored » s'il ne concerne pas l'appli) ;
 * - déjà traité : rien n'est refait (« duplicate ») ;
 * - échec : marqué « failed » avec l'erreur, puis l'erreur remonte (le prestataire réessaiera, une admin peut rejouer).
 */
export async function ingestEvent(
  d: ProcessorDeps,
  input: { provider: ProviderId; eventId: string; type: string; payload: unknown; events: NormalizedEvent[] },
  opts: { replay?: boolean } = {},
): Promise<"processed" | "ignored" | "duplicate"> {
  const { fresh, event } = await d.repo.payRecordEvent({ provider: input.provider, eventId: input.eventId, type: input.type, payload: input.payload });
  if (!fresh && !opts.replay && (event.status === "processed" || event.status === "ignored")) return "duplicate";
  try {
    let any = false;
    for (const e of input.events) if ((await processEvent(d, input.provider, e)) === "done") any = true;
    const status = any ? "processed" : "ignored";
    await d.repo.payFinishEvent(input.provider, input.eventId, status, null);
    return status;
  } catch (err) {
    await d.repo.payFinishEvent(input.provider, input.eventId, "failed", err instanceof Error ? err.message.slice(0, 500) : String(err));
    throw err;
  }
}
