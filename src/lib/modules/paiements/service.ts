/**
 * Point d'entrée UNIQUE pour créer un paiement ou un abonnement, quel que soit le prestataire
 * (Stripe, virement, simulé en démo). Les actions et les routes n'appellent que ces fonctions.
 *
 * Principe : on crée d'abord une session de paiement (payment_checkouts) côté appli, puis on lance le
 * prestataire avec son identifiant. Rien n'est accordé ici : l'accès (adhésion, ressource, fiche pro,
 * billet) n'est donné qu'à la confirmation du paiement, par processor.ts (webhook ou paiement simulé).
 */
import { randomUUID } from "node:crypto";
import { nowIso, today } from "../../clock";
import { getRepo } from "../../data";
import { fullName } from "../../format";
import { audit } from "../../audit";
import type { MembershipAction, PaidPlan, Payment, Profile } from "../../types";
import { PRO_PLANS } from "../partenaires/domain";
import type { ProPlan } from "../partenaires/types";
import { installmentOptions, membershipGraceDays, stripeProPriceId } from "./config";
import { appEffects } from "./effects";
import { currency, formatMoney, round2 } from "./money";
import { ingestEvent, installmentLabel, type ProcessorDeps } from "./processor";
import { getProvider } from "./providers";
import { simulatedInvoice } from "./providers/simulated";
import type { PaymentProvider, StartCheckoutInput } from "./providers/types";
import { addMonths, buildSchedule, nextUnpaid, splitAmount } from "./schedule";
import type { Checkout, Owner, ProviderId, Transaction } from "./types";

export type StartResult =
  | { ok: true; type: "redirect"; url: string }
  | { ok: true; type: "done"; checkoutId: string }
  | { ok: true; type: "manual"; paymentId?: string }
  | { ok: false; error: string };

/** Dépendances du traitement des événements, pour un prestataire donné. */
export function processorDeps(provider: PaymentProvider = getProvider()): ProcessorDeps {
  return {
    repo: getRepo(),
    effects: appEffects(),
    limitSubscription: provider.limitSubscription ? (ref, n) => provider.limitSubscription!(ref, n) : undefined,
    graceDays: membershipGraceDays(),
    today,
    now: nowIso,
  };
}

async function launch(provider: PaymentProvider, checkout: Checkout, input: Omit<StartCheckoutInput, "checkout">): Promise<StartResult> {
  const repo = getRepo();
  let r;
  try {
    r = await provider.startCheckout({ ...input, checkout });
  } catch (e) {
    console.error("[paiements] lancement", provider.id, e instanceof Error ? e.message : e);
    await repo.payUpdateCheckout(checkout.id, { status: "failed" });
    return { ok: false, error: "Le paiement n’a pas pu démarrer. Réessaie dans un instant." };
  }
  if (r.type === "error") {
    await repo.payUpdateCheckout(checkout.id, { status: "failed" });
    return { ok: false, error: r.error };
  }
  if (r.type === "manual") return { ok: true, type: "manual" };
  await repo.payUpdateCheckout(checkout.id, { providerRef: r.sessionRef });
  if (r.type === "redirect") return { ok: true, type: "redirect", url: r.url };
  // paiement immédiat (simulé) : même traitement que le webhook
  await ingestEvent(processorDeps(provider), { provider: provider.id, eventId: `sim_evt_${checkout.id}`, type: "simulated.checkout", payload: r.events, events: r.events });
  return { ok: true, type: "done", checkoutId: checkout.id };
}

/* =====================================================================
   Billets
   ===================================================================== */

/** Paiement par carte d'une place retenue (« pending ») : la place est confirmée par le webhook, libérée si la session expire. */
export async function startBookingPayment(input: {
  bookingId: string;
  ticketCode: string;
  eventTitle: string;
  eventSlug: string;
  amount: number;
  profile: Profile | null;
  base: string;
}): Promise<StartResult> {
  const provider = getProvider();
  if (!provider.supports.hosted && provider.id !== "simulated") return { ok: false, error: "Le paiement en ligne n’est pas activé." };
  const repo = getRepo();
  const label = `Billet · ${input.eventTitle}`;
  const checkout = await repo.payCreateCheckout({
    provider: provider.id, kind: "booking", profileId: input.profile?.id ?? null, organizationId: null, targetId: input.bookingId, plan: null, installments: 1,
    amount: input.amount, currency: currency(), metadata: { label, ticket: input.ticketCode },
  });
  const r = await launch(provider, checkout, {
    mode: "payment", label, customerEmail: input.profile?.email ?? null, customerRef: input.profile ? await repo.payGetCustomer(provider.id, { profileId: input.profile.id }) : null,
    successUrl: `${input.base}/billet/${input.ticketCode}?paye=1`, cancelUrl: `${input.base}/rendez-vous/${input.eventSlug}`, expiresInMinutes: 30,
  });
  if (r.ok && r.type === "redirect") await repo.setBookingStripeSession(input.bookingId, (await repo.payGetCheckout(checkout.id))?.providerRef ?? checkout.id).catch(() => {});
  return r;
}

/* =====================================================================
   Adhésion annuelle (1, 3 ou 12 fois)
   ===================================================================== */

export type MembershipPayInput = {
  profile: Profile;
  action: MembershipAction;
  plan: PaidPlan;
  amount: number;
  installments: number;
  base: string;
  successUrl: string;
  cancelUrl: string;
};

/** Nombres d'échéances possibles avec le prestataire actif (le virement et le passage Premium : comptant). */
export function allowedInstallments(action: MembershipAction, provider: PaymentProvider = getProvider()): number[] {
  if (action === "upgrade" || !provider.supports.installments) return [1];
  return installmentOptions();
}

/**
 * Adhésion, renouvellement ou passage Premium : enregistre la demande (ligne « payments » en attente),
 * l'échéancier (1 à 12 échéances), puis lance le paiement. L'adhésion s'ouvre au premier encaissement.
 */
export async function startMembershipPayment(input: MembershipPayInput): Promise<StartResult> {
  const provider = getProvider();
  const repo = getRepo();
  const n = Math.round(input.installments) || 1;
  if (!allowedInstallments(input.action, provider).includes(n)) return { ok: false, error: "Ce nombre d’échéances n’est pas proposé." };

  if (provider.id === "transfer") {
    const pay = await repo.recordMembership({ profileId: input.profile.id, payerName: fullName(input.profile), action: input.action, plan: input.plan, amount: input.amount, method: "transfer", status: "declared" });
    return { ok: true, type: "manual", paymentId: pay.id };
  }

  const pay = await repo.recordMembership({ profileId: input.profile.id, payerName: fullName(input.profile), action: input.action, plan: input.plan, amount: input.amount, method: "card", status: "declared" });
  const label = installmentLabel({ plan: input.plan, action: input.action, count: n }, 1).replace(/ · échéance 1\/\d+$/, ` · ${n} fois`);
  const checkout = await repo.payCreateCheckout({
    provider: provider.id, kind: "membership", profileId: input.profile.id, organizationId: null, targetId: pay.id, plan: input.plan, installments: n,
    amount: input.amount, currency: currency(), metadata: { label, action: input.action },
  });
  const plan = await repo.payCreatePlan(
    { profileId: input.profile.id, paymentId: pay.id, plan: input.plan, action: input.action, count: n, totalAmount: input.amount, currency: currency(), provider: provider.id, checkoutId: checkout.id },
    buildSchedule(input.amount, n, today()),
  );
  await repo.payUpdateCheckout(checkout.id, { planId: plan.id });
  const parts = splitAmount(input.amount, n);
  const customerRef = await repo.payGetCustomer(provider.id, { profileId: input.profile.id });
  return launch(provider, { ...checkout, planId: plan.id }, {
    mode: n > 1 ? "subscription" : "payment",
    label,
    customerEmail: input.profile.email,
    customerRef,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    expiresInMinutes: n > 1 ? undefined : 60,
    recurring: n > 1 ? { amount: parts[1], firstExtra: round2(parts[0] - parts[1]), label: `${label} (${formatMoney(parts[1])} / mois)` } : undefined,
  });
}

/* =====================================================================
   Boutique (paiement unique ; l'accès n'est donné qu'à la confirmation)
   ===================================================================== */

export async function startShopPayment(input: { productId: string; productTitle: string; productSlug: string; amount: number; profile: Profile; base: string }): Promise<StartResult> {
  const provider = getProvider();
  if (provider.id === "transfer") return { ok: false, error: "Le paiement en ligne de la boutique n’est pas encore activé. Écris aux fondatrices pour recevoir ce guide." };
  const repo = getRepo();
  const label = input.productTitle;
  const checkout = await repo.payCreateCheckout({
    provider: provider.id, kind: "shop", profileId: input.profile.id, organizationId: null, targetId: input.productId, plan: null, installments: 1,
    amount: input.amount, currency: currency(), metadata: { label },
  });
  return launch(provider, checkout, {
    mode: "payment", label: `Boutique · ${label}`, customerEmail: input.profile.email, customerRef: await repo.payGetCustomer(provider.id, { profileId: input.profile.id }),
    successUrl: `${input.base}/espace/boutique/${input.productSlug}?paiement=ok`, cancelUrl: `${input.base}/espace/boutique/${input.productSlug}`, expiresInMinutes: 60,
  });
}

/* =====================================================================
   Abonnement mensuel des pros (carnet)
   ===================================================================== */

export async function startProSubscription(input: { organizationId: string; plan: ProPlan; profile: Profile; base: string }): Promise<StartResult> {
  const provider = getProvider();
  if (!provider.supports.subscriptions) return { ok: false, error: "Le paiement en ligne n’est pas activé : écris aux fondatrices pour régler ton abonnement par virement." };
  const repo = getRepo();
  const price = PRO_PLANS[input.plan].price;
  const label = `Carnet d’adresses · ${PRO_PLANS[input.plan].label}`;
  const checkout = await repo.payCreateCheckout({
    provider: provider.id, kind: "pro_subscription", profileId: input.profile.id, organizationId: input.organizationId, targetId: input.organizationId, plan: input.plan,
    installments: 1, amount: price, currency: currency(), metadata: { label },
  });
  return launch(provider, checkout, {
    mode: "subscription", label, customerEmail: input.profile.email, customerRef: await repo.payGetCustomer(provider.id, { organizationId: input.organizationId }),
    successUrl: `${input.base}/pro/abonnement?org=${input.organizationId}&paiement=ok`, cancelUrl: `${input.base}/pro/abonnement?org=${input.organizationId}`,
    recurring: { amount: price, priceId: provider.id === "stripe" ? stripeProPriceId(input.plan) : null, label },
  });
}

/** Changement de formule d'un abonnement existant : appliqué à la prochaine échéance chez le prestataire. */
export async function changeProPlan(organizationId: string, plan: ProPlan): Promise<{ ok: boolean; error?: string }> {
  const repo = getRepo();
  const sub = await repo.getSubscription(organizationId);
  if (sub?.subscriptionRef && sub.provider && sub.provider !== "simulated") {
    const provider = getProvider(sub.provider as ProviderId);
    if (!provider.changeSubscriptionAmount) return { ok: false, error: "Ce prestataire ne permet pas de changer de formule en ligne." };
    await provider.changeSubscriptionAmount(sub.subscriptionRef, PRO_PLANS[plan].price, provider.id === "stripe" ? stripeProPriceId(plan) : null);
  }
  return { ok: true };
}

/** Arrêt (ou reprise) de l'abonnement à la fin de la période en cours, chez le prestataire. */
export async function setProCancelAtPeriodEnd(organizationId: string, cancel: boolean): Promise<void> {
  const sub = await getRepo().getSubscription(organizationId);
  if (sub?.subscriptionRef && sub.provider && sub.provider !== "simulated") {
    const provider = getProvider(sub.provider as ProviderId);
    await provider.setCancelAtPeriodEnd?.(sub.subscriptionRef, cancel);
  }
}

/** Démo : encaisse (ou refuse) le mois suivant d'un abonnement pro simulé, par le même traitement que le webhook. */
export async function simulateProInvoice(organizationId: string, opts: { fail?: boolean } = {}): Promise<{ ok: boolean; error?: string }> {
  const provider = getProvider();
  if (provider.id !== "simulated") return { ok: false, error: "Réservé à la démo." };
  const repo = getRepo();
  const sub = await repo.getSubscription(organizationId);
  if (!sub) return { ok: false, error: "Aucun abonnement en cours." };
  let ref = sub.subscriptionRef ?? null;
  if (!ref) {
    // abonnement d'exemple (données de démo) : on lui crée une session simulée pour le relier
    ref = `sim_sub_${randomUUID().slice(0, 12)}`;
    const c = await repo.payCreateCheckout({ provider: "simulated", kind: "pro_subscription", profileId: null, organizationId, targetId: organizationId, plan: sub.plan, installments: 1, amount: sub.monthlyPrice, currency: currency(), metadata: { label: `Carnet d’adresses · ${PRO_PLANS[sub.plan].label}` } });
    await repo.payUpdateCheckout(c.id, { status: "completed", subscriptionRef: ref, completedAt: nowIso() });
    await repo.updateSubscription(organizationId, { provider: "simulated", subscriptionRef: ref });
  }
  const start = sub.currentPeriodEnd >= today() ? sub.currentPeriodEnd : today();
  const event = simulatedInvoice({ subscriptionRef: ref, checkoutId: null, amount: PRO_PLANS[sub.plan].price, periodStart: start, fail: opts.fail });
  await ingestEvent(processorDeps(provider), { provider: "simulated", eventId: `sim_evt_${randomUUID()}`, type: event.type, payload: event, events: [event] });
  return { ok: true };
}

/** Démo : encaisse (ou refuse) la prochaine échéance d'un échéancier simulé. */
export async function simulateNextInstallment(planId: string, opts: { fail?: boolean } = {}): Promise<{ ok: boolean; error?: string }> {
  const repo = getRepo();
  const plan = await repo.payGetPlan(planId);
  if (!plan || plan.provider !== "simulated") return { ok: false, error: "Réservé aux échéanciers de la démo." };
  const next = nextUnpaid(plan.installments);
  if (!next) return { ok: false, error: "Échéancier soldé." };
  const ref = plan.subscriptionRef ?? `sim_sub_${plan.id.slice(0, 8)}`;
  if (!plan.subscriptionRef) await repo.payUpdatePlan(plan.id, { subscriptionRef: ref });
  const event = simulatedInvoice({ subscriptionRef: ref, checkoutId: plan.checkoutId, amount: next.amount, periodStart: next.dueDate, fail: opts.fail });
  await ingestEvent(processorDeps(getProvider("simulated")), { provider: "simulated", eventId: `sim_evt_${randomUUID()}`, type: event.type, payload: event, events: [event] });
  return { ok: true };
}

/* =====================================================================
   Portail client, remboursements, rejeu, virements validés
   ===================================================================== */

/** Adresse du portail client du prestataire (changer de carte, factures, résilier), ou null. */
export async function portalUrl(owner: Owner, returnUrl: string): Promise<string | null> {
  const provider = getProvider();
  if (!provider.portalUrl) return null;
  const customer = await getRepo().payGetCustomer(provider.id, owner);
  if (!customer) return null;
  return provider.portalUrl(customer, returnUrl);
}

/** Remboursement (total ou partiel) d'un encaissement, chez le prestataire puis au grand livre. Journalisé. */
export async function refundTransaction(input: { transactionId: string; amount: number; reason: string | null; actorId: string }): Promise<{ ok: true; transaction: Transaction } | { ok: false; error: string }> {
  const repo = getRepo();
  const tx = await repo.payFindTransaction({ id: input.transactionId });
  if (!tx) return { ok: false, error: "Encaissement introuvable." };
  const left = round2(tx.amount - tx.amountRefunded);
  const amount = round2(input.amount);
  if (!(amount > 0) || amount > left) return { ok: false, error: `Montant entre 0,01 et ${formatMoney(left)}.` };
  const provider = getProvider(tx.provider);
  if (!provider.refund) return { ok: false, error: tx.provider === "transfer" ? "Un virement se rembourse par virement : faites-le depuis la banque, puis notez-le ici." : "Remboursement impossible avec ce prestataire." };
  let refundRef: string | null;
  try {
    refundRef = (await provider.refund(tx, amount, input.reason)).refundRef;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Remboursement refusé par le prestataire." };
  }
  const total = round2(tx.amountRefunded + amount);
  await repo.payUpdateTransaction(tx.id, { amountRefunded: total, status: total >= tx.amount ? "refunded" : "partially_refunded" });
  await repo.payRecordRefund({ transactionId: tx.id, amount, reason: input.reason, providerRef: refundRef, createdBy: input.actorId });
  await audit({
    actorId: input.actorId, action: "payment.refund", targetType: "payment", targetId: tx.id,
    summary: `Remboursement ${formatMoney(amount)} · ${tx.description} (${tx.receiptNumber})`, details: { amount, reason: input.reason, refundRef, provider: tx.provider },
  });
  if (tx.profileId) {
    const fx = appEffects();
    await fx.notify([{ recipientId: tx.profileId, type: "refund_issued", title: `Remboursement · ${formatMoney(amount)}`, body: `${tx.description}. Le montant revient sur ta carte sous quelques jours.`, link: "/mes-paiements" }]);
  }
  return { ok: true, transaction: { ...tx, amountRefunded: total, status: total >= tx.amount ? "refunded" : "partially_refunded" } };
}

/** Rejoue un événement de prestataire déjà reçu (après correction d'une erreur). Journalisé. */
export async function replayEvent(provider: ProviderId, eventId: string, actorId: string): Promise<{ ok: boolean; message: string }> {
  const repo = getRepo();
  const ev = await repo.payGetEvent(provider, eventId);
  if (!ev) return { ok: false, message: "Événement introuvable." };
  const p = getProvider(provider);
  const events = p.normalize ? p.normalize(ev.payload) : Array.isArray(ev.payload) ? (ev.payload as never[]) : [];
  try {
    const r = await ingestEvent(processorDeps(p), { provider, eventId, type: ev.type, payload: ev.payload, events }, { replay: true });
    await audit({ actorId, action: "payment.event_replay", targetType: "payment", targetId: null, summary: `Événement ${ev.type} rejoué (${eventId}) : ${r}`, details: { provider, eventId, result: r } });
    return { ok: true, message: r === "processed" ? "Événement traité." : "Événement sans effet pour l’appli." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Échec du traitement." };
  }
}

/** Virement validé par une fondatrice : inscrit l'encaissement au grand livre (reçu téléchargeable). */
export async function recordTransferValidated(pay: Payment, label: string): Promise<void> {
  try {
    await getRepo().payRecordTransaction({
      provider: "transfer", kind: pay.kind === "membership" ? "membership" : "booking", profileId: pay.profileId, organizationId: null, amount: pay.amount,
      currency: currency(), description: label, providerRef: `transfer:${pay.id}`, relatedType: "payment", relatedId: pay.id,
    });
  } catch (e) {
    console.error("[paiements] grand livre (virement)", e instanceof Error ? e.message : e);
  }
}

/** Prochaine échéance d'un mois (aide d'affichage). */
export function nextMonth(ymd: string): string {
  return addMonths(ymd, 1);
}
