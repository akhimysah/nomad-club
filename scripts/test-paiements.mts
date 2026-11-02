// Vague 2 · 2a — tests du module paiements, sans serveur, sans base et sans réseau :
// échéancier (découpage, dates, statut, relances), affichage des montants, configuration,
// webhooks Stripe signés localement (vérification de signature, traduction), traitement idempotent
// des événements (processor + stockage en mémoire + effets factices).
// Utilisation : npm run test:paiements (Node 22 : --experimental-strip-types)
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const M = `${root}/src/lib/modules/paiements`;
const sched = await import(`${M}/schedule.ts`);
const money = await import(`${M}/money.ts`);
const config = await import(`${M}/config.ts`);
const events = await import(`${M}/stripe-events.ts`);
const proc = await import(`${M}/processor.ts`);
const mem = await import(`${M}/memory-repo.ts`);
const stripeProv = await import(`${M}/providers/stripe.ts`);

let fail = 0;
let pass = 0;
const ok = (c: unknown, m: string) => {
  if (c) pass++;
  else fail++;
  console.log(`${c ? "✓" : "✗"} ${m}`);
};
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const NB = " ";

/* =====================================================================
   1. Échéancier
   ===================================================================== */
console.log("\nÉchéancier");
ok(eq(sched.splitAmount(670, 3), [223.34, 223.33, 223.33]), "670 en 3 fois → 223,34 + 223,33 + 223,33");
ok(Math.round(sched.splitAmount(670, 3).reduce((a: number, b: number) => a + b, 0) * 100) === 67000, "…la somme fait exactement 670");
const p12 = sched.splitAmount(1250, 12);
ok(p12.length === 12 && Math.round(p12.reduce((a: number, b: number) => a + b, 0) * 100) === 125000 && p12[0] === 104.24 && p12[1] === 104.16, "1 250 en 12 fois → 104,24 puis 11 × 104,16");
ok(eq(sched.splitAmount(670, 1), [670]), "comptant : une seule échéance");
let threw = false;
try {
  sched.splitAmount(670, 0);
} catch {
  threw = true;
}
ok(threw, "0 échéance refusé");
ok(sched.addMonths("2026-01-31", 1) === "2026-02-28", "31 janvier + 1 mois → 28 février");
ok(sched.addMonths("2028-01-31", 1) === "2028-02-29", "…29 février les années bissextiles");
ok(sched.addMonths("2026-11-18", 2) === "2027-01-18", "changement d'année");
const s3 = sched.buildSchedule(670, 3, "2026-11-02");
ok(eq(s3.map((i: { dueDate: string }) => i.dueDate), ["2026-11-02", "2026-12-02", "2027-01-02"]), "échéances mensuelles, la première aujourd'hui");
ok(eq(s3.map((i: { seq: number }) => i.seq), [1, 2, 3]), "rangs 1, 2, 3");

const I = (seq: number, dueDate: string, status: string) => ({ seq, dueDate, status, amount: 223.33, lastReminderAt: null as string | null });
const plan = (st: string, list: ReturnType<typeof I>[]) => ({ status: st, installments: list });
ok(sched.planStatus(plan("pending", [I(1, "2026-11-02", "scheduled"), I(2, "2026-12-02", "scheduled")]), "2026-11-02", 15) === "pending", "rien de payé → en attente (adhésion pas encore ouverte)");
ok(sched.planStatus(plan("active", [I(1, "2026-11-02", "paid"), I(2, "2026-12-02", "scheduled")]), "2026-11-20", 15) === "active", "à jour → actif");
ok(sched.planStatus(plan("active", [I(1, "2026-11-02", "paid"), I(2, "2026-12-02", "scheduled")]), "2026-12-03", 15) === "active", "échéance du jour non encore prélevée : tolérance de 2 jours");
ok(sched.planStatus(plan("active", [I(1, "2026-11-02", "paid"), I(2, "2026-12-02", "scheduled")]), "2026-12-05", 15) === "late", "échéance passée non payée → en retard");
ok(sched.planStatus(plan("active", [I(1, "2026-11-02", "paid"), I(2, "2026-12-02", "failed")]), "2026-12-02", 15) === "late", "carte refusée → en retard tout de suite");
ok(sched.planStatus(plan("late", [I(1, "2026-11-02", "paid"), I(2, "2026-12-02", "failed")]), "2026-12-17", 15) === "late", "15 jours de retard : encore dans le délai de grâce");
ok(sched.planStatus(plan("late", [I(1, "2026-11-02", "paid"), I(2, "2026-12-02", "failed")]), "2026-12-18", 15) === "suspended", "16 jours : suspendu");
ok(sched.planStatus(plan("suspended", [I(1, "2026-11-02", "paid"), I(2, "2026-12-02", "paid"), I(3, "2027-01-02", "scheduled")]), "2026-12-20", 15) === "active", "régularisé → actif");
ok(sched.planStatus(plan("active", [I(1, "2026-11-02", "paid"), I(2, "2026-12-02", "paid")]), "2026-12-20", 15) === "completed", "tout payé → soldé");
ok(sched.planStatus(plan("cancelled", [I(1, "2026-11-02", "scheduled")]), "2027-06-01", 15) === "cancelled", "annulé reste annulé");
ok(sched.graceEndsOn([I(2, "2026-12-02", "failed")], "2026-12-05", 15) === "2026-12-17", "fin du délai de grâce = échéance + 15 jours");
ok(sched.remainingAmount([{ status: "paid", amount: 223.34 }, { status: "failed", amount: 223.33 }, { status: "scheduled", amount: 223.33 }]) === 446.66, "reste à payer");
ok(sched.reminderDue({ ...I(2, "2026-12-02", "failed"), lastReminderAt: null }, "2026-12-03", 3), "relance d'une échéance en retard");
ok(!sched.reminderDue({ ...I(2, "2026-12-02", "failed"), lastReminderAt: "2026-12-03T08:00:00Z" }, "2026-12-04", 3), "…pas deux relances en moins de 3 jours");
ok(sched.reminderDue({ ...I(2, "2026-12-02", "failed"), lastReminderAt: "2026-12-03T08:00:00Z" }, "2026-12-06", 3), "…puis de nouveau 3 jours après");
ok(sched.renewalReminderDay("2026-12-02", "2026-11-02", [30, 7, 1]) === 30, "rappel de renouvellement J-30");
ok(sched.renewalReminderDay("2026-12-02", "2026-12-01", [30, 7, 1]) === 1, "rappel J-1");
ok(sched.renewalReminderDay("2026-12-02", "2026-11-20", [30, 7, 1]) === null, "pas de rappel les autres jours");

/* =====================================================================
   2. Montants et configuration
   ===================================================================== */
console.log("\nMontants et configuration");
delete process.env.NEXT_PUBLIC_CURRENCY;
ok(money.formatMoney(1250) === `1${NB}250${NB}$`, "formatMoney(1250) → « 1 250 $ » (USD par défaut)");
ok(money.formatMoney(223.335) === `223,34${NB}$`, "centimes affichés seulement s'il y en a, arrondis");
ok(money.formatMoney(0) === `0${NB}$`, "zéro");
ok(money.formatMoney(1250, { currency: "EUR" }) === `1${NB}250${NB}€`, "euros");
process.env.NEXT_PUBLIC_CURRENCY = "MAD";
ok(money.currency() === "MAD" && money.formatMoney(6700) === `6${NB}700${NB}DH`, "NEXT_PUBLIC_CURRENCY=MAD → « 6 700 DH »");
process.env.NEXT_PUBLIC_CURRENCY = "nimporte";
ok(money.currency() === "USD", "devise invalide → USD");
delete process.env.NEXT_PUBLIC_CURRENCY;
ok(money.toMinor(223.33) === 22333 && money.fromMinor(22333) === 223.33, "conversion en centimes (Stripe)");

ok(eq(config.installmentOptions(), [1, 3, 12]), "échéances proposées par défaut : 1, 3, 12");
process.env.MEMBERSHIP_INSTALLMENTS = "12;3, 6";
ok(eq(config.installmentOptions(), [1, 3, 6, 12]), "MEMBERSHIP_INSTALLMENTS lu, comptant toujours proposé");
delete process.env.MEMBERSHIP_INSTALLMENTS;
ok(config.membershipGraceDays() === 15, "délai de grâce par défaut : 15 jours");
process.env.MEMBERSHIP_GRACE_DAYS = "7";
ok(config.membershipGraceDays() === 7, "MEMBERSHIP_GRACE_DAYS lu");
delete process.env.MEMBERSHIP_GRACE_DAYS;
ok(eq(config.membershipPrices(), { member: 670, premium: 1250, upgrade: 580 }), "tarifs par défaut 670 / 1 250 / 580");
process.env.NEXT_PUBLIC_PRICE_MEMBER = "700";
ok(config.membershipPrices().member === 700 && config.membershipPrices().upgrade === 550, "tarif configurable (et différence Premium recalculée)");
delete process.env.NEXT_PUBLIC_PRICE_MEMBER;

const envBackup = { ...process.env };
delete process.env.STRIPE_SECRET_KEY;
delete process.env.PAYMENT_PROVIDER;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
ok(config.resolveProviderId() === "simulated", "démo sans clé → paiement simulé");
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
ok(config.resolveProviderId() === "transfer", "mode réel sans Stripe → virement");
process.env.PAYMENT_PROVIDER = "simulated";
const warn = console.warn;
console.warn = () => {};
ok(config.resolveProviderId() === "transfer", "PAYMENT_PROVIDER=simulated refusé en mode réel (production)");
console.warn = warn;
process.env.PAYMENT_PROVIDER = "stripe";
ok(config.resolveProviderId() === "transfer", "PAYMENT_PROVIDER=stripe sans clé → repli sur le virement");
process.env.STRIPE_SECRET_KEY = "sk_test_123";
ok(config.resolveProviderId() === "stripe" && config.stripeKeyMode() === "test", "clé sk_test → Stripe en mode test");
process.env.STRIPE_SECRET_KEY = "sk_live_123";
ok(config.stripeKeyMode() === "live", "clé sk_live → mode live");
process.env = envBackup;

/* =====================================================================
   3. Webhooks Stripe signés localement
   ===================================================================== */
console.log("\nWebhooks Stripe (signature, traduction)");
const SECRET = "whsec_test_nomad_club_local";
const stripe = new Stripe("sk_test_local_sans_reseau");
let evtSeq = 0;
const sign = (type: string, object: Record<string, unknown>) => {
  const payload = JSON.stringify({ id: `evt_test_${++evtSeq}`, object: "event", api_version: "2025-09-30.clover", created: 1798000000, type, data: { object } });
  return { payload, header: stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET }) };
};
const unix = (ymd: string) => Math.floor(Date.parse(`${ymd}T10:00:00Z`) / 1000);

const s1 = sign("checkout.session.completed", { id: "cs_test_1", object: "checkout.session", mode: "payment", payment_status: "paid", amount_total: 3500, payment_intent: "pi_1", customer: "cus_1", metadata: { nc_checkout: "chk-1" } });
const v1 = stripeProv.verifyStripeWebhook(stripe, s1.payload, s1.header, SECRET);
ok(v1.eventId === "evt_test_1" && v1.type === "checkout.session.completed", "signature valide acceptée");
ok(v1.events.length === 1 && v1.events[0].type === "checkout.completed" && v1.events[0].checkoutId === "chk-1" && v1.events[0].amount === 35 && v1.events[0].paymentRef === "pi_1", "session payée → checkout.completed (35 $, référence du paiement)");
let bad = false;
try {
  stripeProv.verifyStripeWebhook(stripe, s1.payload.replace("3500", "1"), s1.header, SECRET);
} catch {
  bad = true;
}
ok(bad, "contenu modifié → signature refusée");
bad = false;
try {
  stripeProv.verifyStripeWebhook(stripe, s1.payload, s1.header, "whsec_autre");
} catch {
  bad = true;
}
ok(bad, "mauvais secret → refusé");
bad = false;
try {
  stripeProv.verifyStripeWebhook(stripe, s1.payload, null, SECRET);
} catch {
  bad = true;
}
ok(bad, "sans en-tête stripe-signature → refusé");

const invClover = {
  id: "in_test_1", object: "invoice", amount_paid: 22334, customer: "cus_2", hosted_invoice_url: "https://invoice.stripe.com/i/1", invoice_pdf: "https://pay.stripe.com/invoice/1/pdf",
  parent: { type: "subscription_details", subscription_details: { subscription: "sub_1", metadata: { nc_checkout: "chk-m" } } },
  lines: { data: [{ period: { start: unix("2026-11-02"), end: unix("2026-12-02") } }] },
  payments: { data: [{ payment: { payment_intent: "pi_inv_1" } }] },
};
const nInv = events.normalizeStripeEvent({ type: "invoice.paid", data: { object: invClover } })[0];
ok(nInv.type === "invoice.paid" && nInv.subscriptionRef === "sub_1" && nInv.checkoutId === "chk-m" && nInv.amount === 223.34, "facture (API « clover ») : abonnement et session retrouvés dans parent.subscription_details");
ok(nInv.type === "invoice.paid" && nInv.periodStart === "2026-11-02" && nInv.periodEnd === "2026-12-02" && nInv.chargeRef === "pi_inv_1" && nInv.pdfUrl?.endsWith("/pdf"), "…période, paiement et PDF de la facture");
const nLegacy = events.normalizeStripeEvent({ type: "invoice.paid", data: { object: { id: "in_old", amount_paid: 4900, subscription: "sub_old", subscription_details: { metadata: { nc_checkout: "chk-old" } } } } })[0];
ok(nLegacy.type === "invoice.paid" && nLegacy.subscriptionRef === "sub_old" && nLegacy.checkoutId === "chk-old", "facture (ancienne API) : invoice.subscription");
const nFail = events.normalizeStripeEvent({ type: "invoice.payment_failed", data: { object: { ...invClover, id: "in_f", amount_due: 22333, attempt_count: 2, hosted_invoice_url: "https://invoice.stripe.com/i/f" } } })[0];
ok(nFail.type === "invoice.failed" && nFail.attempt === 2 && nFail.amount === 223.33 && nFail.hostedUrl === "https://invoice.stripe.com/i/f", "échec de prélèvement → invoice.failed (lien pour régler)");
const nSub = events.normalizeStripeEvent({ type: "customer.subscription.updated", data: { object: { id: "sub_p", status: "past_due", cancel_at_period_end: false, items: { data: [{ current_period_end: unix("2026-12-05") }] }, metadata: {} } } })[0];
ok(nSub.type === "subscription.updated" && nSub.status === "past_due" && nSub.currentPeriodEnd === "2026-12-05", "abonnement en retard → subscription.updated past_due");
ok(events.normalizeStripeEvent({ type: "customer.created", data: { object: {} } }).length === 0, "événement inutile → ignoré");
ok(stripeProv.monthsAfterUnix(unix("2026-01-31"), 1) === unix("2026-02-28"), "fin d'un abonnement limité : même heure, fin de mois respectée");

/* =====================================================================
   4. Traitement idempotent (processor + mémoire + effets factices)
   ===================================================================== */
console.log("\nTraitement des événements (idempotence)");
type Call = { fn: string; args: unknown[] };
function setup(today = "2026-11-02") {
  const state = mem.emptyPaiementsState();
  const host = {
    profiles: [
      { id: "p-ines", firstName: "Inès", lastName: "L", email: "ines@exemple.com", roles: ["member"], plan: "member", planEndsAt: "2027-11-02" },
      { id: "p-loubna", firstName: "Loubna", lastName: "C", email: "loubna@exemple.com", roles: ["pro"], plan: "free", planEndsAt: null },
    ] as never[],
    reminders: [] as never[],
    organizationMembers: [{ organizationId: "org-1", profileId: "p-loubna", role: "owner" }],
    partenaires: { subscriptions: [] as { organizationId: string; plan: string; status: string; subscriptionRef?: string | null }[] },
  };
  const calls: Call[] = [];
  const clock = { today, n: 0 };
  const repo = mem.createMemoryPaiementsRepo({ state: () => state, host: () => host, now: () => `${clock.today}T10:00:${String(clock.n++ % 60).padStart(2, "0")}.000Z` });
  const rec = (fn: string) => async (...args: unknown[]) => {
    calls.push({ fn, args });
  };
  let breakOnce = false;
  const effects = {
    markBookingPaid: rec("markBookingPaid"),
    releaseBooking: rec("releaseBooking"),
    async activateMembership(...args: unknown[]) {
      if (breakOnce) {
        breakOnce = false;
        throw new Error("base indisponible");
      }
      calls.push({ fn: "activateMembership", args });
    },
    async grantPurchase(...args: unknown[]) {
      calls.push({ fn: "grantPurchase", args });
      return { title: "Guide visa" };
    },
    linkProSubscription: rec("linkProSubscription"),
    async recordProPayment(input: { organizationId: string; status: string; plan: string | null }) {
      calls.push({ fn: "recordProPayment", args: [input] });
      const subs = host.partenaires.subscriptions;
      let s = subs.find((x) => x.organizationId === input.organizationId);
      const was = s?.status;
      if (input.status === "paid") {
        if (!s) subs.push((s = { organizationId: input.organizationId, plan: input.plan ?? "essentiel", status: "active" }));
        else s.status = "active";
      }
      return { activated: input.status === "paid" && was !== "active", plan: input.plan ?? "essentiel", planLabel: "Visibilité" };
    },
    async syncProSubscription(input: { subscriptionRef: string; status?: string }) {
      calls.push({ fn: "syncProSubscription", args: [input] });
      const s = host.partenaires.subscriptions[0];
      if (!s) return null;
      if (input.status) s.status = input.status;
      return { organizationId: s.organizationId };
    },
    async findProBySubscription(ref: string) {
      const c = await repo.payFindCheckout({ subscriptionRef: ref });
      return c?.organizationId ? { organizationId: c.organizationId, plan: c.plan ?? "essentiel" } : null;
    },
    contact: (id: string) => repo.payContact(id),
    orgContacts: (id: string) => repo.payOrgContacts(id),
    notify: rec("notify"),
    email: rec("email"),
    subscriptionActivated: rec("subscriptionActivated"),
  };
  const limits: Array<[string, number]> = [];
  const deps = {
    repo, effects, graceDays: 15, today: () => clock.today, now: () => `${clock.today}T10:00:00.000Z`,
    limitSubscription: async (ref: string, n: number) => {
      limits.push([ref, n]);
    },
  };
  const count = (fn: string) => calls.filter((c) => c.fn === fn).length;
  const emails = (template: string) => calls.filter((c) => c.fn === "email" && (c.args[0] as { template: string }).template === template).length;
  return { state, host, repo, deps, calls, count, emails, limits, clock, breakNext: () => (breakOnce = true) };
}
const ingest = (t: ReturnType<typeof setup>, signed: { payload: string; header: string }, opts?: { replay?: boolean }) => {
  const v = stripeProv.verifyStripeWebhook(stripe, signed.payload, signed.header, SECRET);
  return proc.ingestEvent(t.deps, { provider: "stripe", ...v }, opts);
};

// --- adhésion Membre en 3 fois ---
{
  const t = setup("2026-11-02");
  const checkout = await t.repo.payCreateCheckout({ provider: "stripe", kind: "membership", profileId: "p-ines", organizationId: null, targetId: "pay-1", plan: "member", installments: 3, amount: 670, currency: "USD" });
  const pl = await t.repo.payCreatePlan({ profileId: "p-ines", paymentId: "pay-1", plan: "member", action: "renew", count: 3, totalAmount: 670, currency: "USD", provider: "stripe", checkoutId: checkout.id }, sched.buildSchedule(670, 3, "2026-11-02"));
  await t.repo.payUpdateCheckout(checkout.id, { planId: pl.id });
  const inv = (id: string, amount: number, start: string) =>
    sign("invoice.paid", { id, object: "invoice", amount_paid: amount, customer: "cus_ines", parent: { subscription_details: { subscription: "sub_ines", metadata: { nc_checkout: checkout.id } } }, lines: { data: [{ period: { start: unix(start), end: unix(sched.addMonths(start, 1)) } }] } });

  // la facture arrive AVANT la fin de session (ordre non garanti chez Stripe)
  const first = inv("in_ines_1", 22334, "2026-11-02");
  ok((await ingest(t, first)) === "processed", "1re facture (avant la fin de session) traitée grâce à nc_checkout");
  let p = (await t.repo.payGetPlan(pl.id))!;
  ok(p.installments[0].status === "paid" && p.installments[0].invoiceRef === "in_ines_1" && p.status === "active", "échéance 1/3 payée, échéancier actif");
  ok(t.count("activateMembership") === 1 && t.count("subscriptionActivated") === 1, "adhésion ouverte et souscription signalée (contrats) une fois");
  ok(t.emails("payment_receipt") === 1, "reçu envoyé par e-mail (modèle payment_receipt)");
  { const d = (t.calls.find((c) => c.fn === "email")!.args[0] as { data: Record<string, string> }).data; ok(d.amount === "223,34 $" && /^NC-\d{4}-\d{6}$/.test(d.reference) && d.installment === "1/3" && d.paidAt === "2 novembre 2026" && d.firstName === "Inès", "…données mises en forme (montant, n° de reçu, échéance 1/3, date)"); }
  ok((t.calls.find((c) => c.fn === "subscriptionActivated")!.args[0] as { installments: number; kind: string }).installments === 3, "…avec le nombre d'échéances");
  ok(t.state.transactions.length === 1 && t.state.transactions[0].amount === 223.34 && t.state.transactions[0].kind === "installment", "une écriture au grand livre (223,34)");

  ok((await ingest(t, first)) === "duplicate", "même événement renvoyé par Stripe → doublon ignoré");
  const sameInvoiceOtherEvent = inv("in_ines_1", 22334, "2026-11-02");
  await ingest(t, sameInvoiceOtherEvent);
  p = (await t.repo.payGetPlan(pl.id))!;
  ok(t.state.transactions.length === 1 && p.installments.filter((i: { status: string }) => i.status === "paid").length === 1, "même facture sous un autre événement → toujours une seule échéance payée");
  ok(t.count("subscriptionActivated") === 1 && t.emails("payment_receipt") === 1, "…ni second reçu ni seconde activation");
  ok(t.state.events.find((e: { eventId: string }) => e.eventId === "evt_test_" + (evtSeq - 1)) !== undefined && t.state.events.some((e: { attempts: number }) => e.attempts === 2), "événements stockés, réceptions comptées");

  const done = sign("checkout.session.completed", { id: "cs_ines", object: "checkout.session", mode: "subscription", payment_status: "paid", subscription: "sub_ines", customer: "cus_ines", metadata: { nc_checkout: checkout.id } });
  await ingest(t, done);
  ok(eq(t.limits, [["sub_ines", 3]]), "fin de session : abonnement limité à 3 prélèvements chez Stripe");
  ok((await t.repo.payGetCustomer("stripe", { profileId: "p-ines" })) === "cus_ines", "client Stripe mémorisé (portail : changer de carte)");
  ok((await t.repo.payFindPlan({ subscriptionRef: "sub_ines" }))?.id === pl.id, "échéancier relié à l'abonnement");

  // 2e échéance refusée
  t.clock.today = "2026-12-02";
  const failed = sign("invoice.payment_failed", { id: "in_ines_2", object: "invoice", amount_due: 22333, attempt_count: 1, hosted_invoice_url: "https://invoice.stripe.com/i/2", parent: { subscription_details: { subscription: "sub_ines", metadata: { nc_checkout: checkout.id } } } });
  await ingest(t, failed);
  p = (await t.repo.payGetPlan(pl.id))!;
  ok(p.installments[1].status === "failed" && p.installments[1].attempts === 1 && p.status === "late", "carte refusée : échéance 2/3 en échec, échéancier en retard");
  ok(p.installments[1].invoiceUrl === "https://invoice.stripe.com/i/2", "…lien pour régler la facture conservé");
  ok(t.emails("payment_failed") === 1 && t.calls.some((c) => c.fn === "notify" && (c.args[0] as Array<{ type: string }>)[0].type === "payment_failed"), "notification + e-mail payment_failed");

  // au-delà du délai de grâce : suspension (règle appliquée par la tâche quotidienne)
  t.clock.today = "2026-12-18";
  ok(sched.planStatus(p, t.clock.today, 15) === "suspended", "16 jours plus tard : à suspendre");
  await t.repo.payUpdatePlan(pl.id, { status: "suspended", suspendedAt: "2026-12-18T08:00:00Z" });
  await t.repo.paySetMemberAccess("p-ines", false);
  ok(!(t.host.profiles[0] as { roles: string[] }).roles.includes("member"), "accès membre retiré");

  // Stripe réessaie, la carte passe : accès rétabli
  await ingest(t, inv("in_ines_2", 22333, "2026-12-02"));
  p = (await t.repo.payGetPlan(pl.id))!;
  ok(p.installments[1].status === "paid" && p.status === "active" && p.suspendedAt === null, "échéance régularisée : échéancier de nouveau actif");
  ok((t.host.profiles[0] as { roles: string[] }).roles.includes("member"), "accès membre rétabli automatiquement");
  ok(t.calls.some((c) => c.fn === "notify" && (c.args[0] as Array<{ title: string }>)[0].title === "Ton accès est rétabli"), "notification « accès rétabli » (relayée par e-mail par le chantier e-mails)");
  ok(t.count("subscriptionActivated") === 1, "pas de nouvelle « souscription » pour une échéance suivante");

  await ingest(t, inv("in_ines_3", 22333, "2027-01-02"));
  p = (await t.repo.payGetPlan(pl.id))!;
  ok(p.status === "completed" && t.state.transactions.length === 3, "3e échéance : échéancier soldé, 3 écritures");
  ok(Math.round(t.state.transactions.reduce((a: number, x: { amount: number }) => a + x.amount, 0) * 100) === 67000, "total encaissé = 670 exactement");
  const extra = await ingest(t, inv("in_ines_4", 22333, "2027-02-02"));
  ok(extra === "ignored" && t.state.transactions.length === 3, "facture en trop après la dernière échéance → ignorée (et journalisée)");
}

// --- échec de traitement puis rejeu ---
{
  const t = setup();
  const c = await t.repo.payCreateCheckout({ provider: "stripe", kind: "membership", profileId: "p-ines", organizationId: null, targetId: "pay-2", plan: "premium", installments: 1, amount: 1250, currency: "USD" });
  const pl = await t.repo.payCreatePlan({ profileId: "p-ines", paymentId: "pay-2", plan: "premium", action: "join", count: 1, totalAmount: 1250, currency: "USD", provider: "stripe", checkoutId: c.id }, sched.buildSchedule(1250, 1, "2026-11-02"));
  await t.repo.payUpdateCheckout(c.id, { planId: pl.id });
  const ev = sign("checkout.session.completed", { id: "cs_prem", object: "checkout.session", mode: "payment", payment_status: "paid", amount_total: 125000, payment_intent: "pi_prem", metadata: { nc_checkout: c.id } });
  t.breakNext();
  let err = false;
  try {
    await ingest(t, ev);
  } catch {
    err = true;
  }
  const stored = t.state.events.find((e: { type: string }) => e.type === "checkout.session.completed")!;
  ok(err && stored.status === "failed" && stored.error === "base indisponible", "erreur : événement marqué « failed » avec l'erreur (Stripe réessaiera, réponse 500)");
  ok((await t.repo.payGetPlan(pl.id))!.installments[0].status === "scheduled" && t.state.transactions.length === 0, "…rien n'est à moitié enregistré");
  ok((await ingest(t, ev)) === "processed", "nouvel envoi de Stripe : traité");
  ok((await t.repo.payGetPlan(pl.id))!.installments[0].status === "paid" && t.count("activateMembership") === 1 && t.state.transactions.length === 1, "adhésion comptant ouverte, une écriture");
  const v = stripeProv.verifyStripeWebhook(stripe, ev.payload, ev.header, SECRET);
  ok((await proc.ingestEvent(t.deps, { provider: "stripe", ...v }, { replay: true })) === "processed" && t.state.transactions.length === 1 && t.count("subscriptionActivated") === 1, "rejeu par une admin : sans double effet");
}

// --- billet, boutique, expiration ---
{
  const t = setup();
  const b = await t.repo.payCreateCheckout({ provider: "stripe", kind: "booking", profileId: "p-ines", organizationId: null, targetId: "bk-1", plan: null, installments: 1, amount: 35, currency: "USD", metadata: { label: "Billet · Lunch au Fer7" } });
  const ev = sign("checkout.session.completed", { id: "cs_bk", object: "checkout.session", mode: "payment", payment_status: "paid", amount_total: 3500, payment_intent: "pi_bk", metadata: { nc_checkout: b.id } });
  await ingest(t, ev);
  await ingest(t, ev);
  ok(t.count("markBookingPaid") === 1 && eq(t.calls.find((c) => c.fn === "markBookingPaid")!.args, ["cs_bk", "bk-1"]), "billet : réservation confirmée une fois");
  ok(t.state.transactions.length === 1 && t.state.transactions[0].description === "Billet · Lunch au Fer7", "…et inscrite au grand livre");
  const unpaid = sign("checkout.session.completed", { id: "cs_async", object: "checkout.session", mode: "payment", payment_status: "unpaid", metadata: { nc_checkout: b.id } });
  ok((await ingest(t, unpaid)) === "ignored", "paiement différé non encore reçu → rien d'accordé");

  const s = await t.repo.payCreateCheckout({ provider: "stripe", kind: "shop", profileId: "p-ines", organizationId: null, targetId: "prod-visa", plan: null, installments: 1, amount: 19, currency: "USD" });
  await ingest(t, sign("checkout.session.completed", { id: "cs_shop", object: "checkout.session", mode: "payment", payment_status: "paid", amount_total: 1900, payment_intent: "pi_shop", metadata: { nc_checkout: s.id } }));
  ok(t.count("grantPurchase") === 1 && t.state.transactions.some((x: { kind: string; description: string }) => x.kind === "shop" && x.description === "Boutique · Guide visa"), "boutique : accès accordé seulement à la confirmation");

  const e = await t.repo.payCreateCheckout({ provider: "stripe", kind: "booking", profileId: null, organizationId: null, targetId: "bk-2", plan: null, installments: 1, amount: 45, currency: "USD" });
  await t.repo.payUpdateCheckout(e.id, { providerRef: "cs_exp" });
  await ingest(t, sign("checkout.session.expired", { id: "cs_exp", object: "checkout.session", metadata: { nc_checkout: e.id } }));
  ok(t.count("releaseBooking") === 1 && (await t.repo.payGetCheckout(e.id))!.status === "expired", "session expirée : place retenue libérée");

  // remboursement fait dans le tableau de bord Stripe
  const refund = sign("charge.refunded", { id: "ch_shop", object: "charge", payment_intent: "pi_shop", amount_refunded: 900, refunds: { data: [{ id: "re_1" }] } });
  await ingest(t, refund);
  const tx = t.state.transactions.find((x: { kind: string }) => x.kind === "shop")!;
  ok(tx.amountRefunded === 9 && tx.status === "partially_refunded" && t.state.refunds.length === 1, "remboursement partiel reçu de Stripe : grand livre à jour");
  await ingest(t, sign("charge.refunded", { id: "ch_shop", object: "charge", payment_intent: "pi_shop", amount_refunded: 900, refunds: { data: [{ id: "re_1" }] } }));
  ok(t.state.refunds.length === 1 && tx.amountRefunded === 9, "…même remboursement renvoyé : rien en double");
  ok(t.calls.filter((c) => c.fn === "notify" && (c.args[0] as Array<{ type: string }>)[0].type === "refund_issued").length === 1, "notification de remboursement (une seule)");
}

// --- abonnement pro mensuel ---
{
  const t = setup();
  const c = await t.repo.payCreateCheckout({ provider: "stripe", kind: "pro_subscription", profileId: "p-loubna", organizationId: "org-1", targetId: "org-1", plan: "visibilite", installments: 1, amount: 49, currency: "USD" });
  await ingest(t, sign("checkout.session.completed", { id: "cs_pro", object: "checkout.session", mode: "subscription", payment_status: "paid", subscription: "sub_pro", customer: "cus_org", metadata: { nc_checkout: c.id } }));
  ok(t.count("linkProSubscription") === 1 && (await t.repo.payGetCustomer("stripe", { organizationId: "org-1" })) === "cus_org", "pro : abonnement relié, client Stripe de l'établissement mémorisé");
  const proInv = (id: string, start: string) => sign("invoice.paid", { id, object: "invoice", amount_paid: 4900, subscription: "sub_pro", lines: { data: [{ period: { start: unix(start), end: unix(sched.addMonths(start, 1)) } }] } });
  await ingest(t, proInv("in_pro_1", "2026-11-02"));
  await ingest(t, proInv("in_pro_1", "2026-11-02"));
  ok(t.count("recordProPayment") === 1 && t.host.partenaires.subscriptions[0]?.status === "active", "1er mois payé : fiche en ligne (une seule fois)");
  const act = t.calls.find((c) => c.fn === "subscriptionActivated")!.args[0] as { kind: string; organizationId: string; profileId: string };
  ok(act.kind === "pro_listing" && act.organizationId === "org-1" && act.profileId === "p-loubna", "souscription pro signalée (contrat pro)");
  await ingest(t, proInv("in_pro_2", "2026-12-02"));
  ok(t.count("recordProPayment") === 2 && t.count("subscriptionActivated") === 1, "mois suivant : encaissé, pas de nouvelle souscription");
  await ingest(t, sign("invoice.payment_failed", { id: "in_pro_3", object: "invoice", amount_due: 4900, subscription: "sub_pro" }));
  ok(t.emails("payment_failed") === 1, "pro : carte refusée → e-mail payment_failed à l'équipe");
  await ingest(t, sign("customer.subscription.updated", { id: "sub_pro", object: "subscription", status: "past_due", cancel_at_period_end: false, items: { data: [{ current_period_end: unix("2027-01-02") }] } }));
  ok(t.host.partenaires.subscriptions[0].status === "past_due", "statut « en retard » synchronisé par le webhook");
  await ingest(t, sign("customer.subscription.updated", { id: "sub_pro", object: "subscription", status: "unpaid", cancel_at_period_end: false, items: { data: [] } }));
  ok(t.host.partenaires.subscriptions[0].status === "suspended" && t.calls.some((c) => c.fn === "notify" && (c.args[0] as Array<{ title: string }>)[0].title === "Ta fiche est suspendue"), "Stripe abandonne les relances → fiche suspendue, équipe prévenue");
  await ingest(t, sign("customer.subscription.deleted", { id: "sub_pro", object: "subscription" }));
  ok(t.host.partenaires.subscriptions[0].status === "cancelled", "résiliation (portail) → abonnement arrêté");
}

console.log(`\n${pass} vérification${pass > 1 ? "s" : ""} réussie${pass > 1 ? "s" : ""}, ${fail} échec${fail > 1 ? "s" : ""}.`);
process.exit(fail ? 1 : 0);
