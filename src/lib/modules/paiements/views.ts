/**
 * Données prêtes à afficher pour les pages « Mes paiements » (membre), « Abonnement » (pro) et
 * « Paiements » (fondatrices). Lecture par le Repo (RLS en mode réel).
 */
import { today } from "../../clock";
import { getRepo } from "../../data";
import { fullName, PLAN_LABEL } from "../../format";
import type { Payment } from "../../types";
import { installmentOptions, membershipGraceDays, stripeKeyMode } from "./config";
import { INSTALLMENT_STATUS_LABEL, PLAN_STATUS_LABEL, TRANSACTION_KIND_LABEL } from "./labels";
import { getProvider } from "./providers";
import { graceEndsOn, isOverdue, planStatus, remainingAmount } from "./schedule";
import type { InstallmentPlan, PlanStatus, StoredEvent, Transaction, TransactionKind } from "./types";

/** Échéances proposées dans le tunnel d'adhésion selon le prestataire actif. */
export function paymentInstallmentChoices(): number[] {
  try {
    return getProvider().supports.installments ? installmentOptions() : [1];
  } catch {
    return [1];
  }
}

export type HistoryRow = {
  id: string;
  date: string;
  label: string;
  amount: number;
  refunded: number;
  status: string;
  method: string;
  receiptHref: string | null;
  invoiceUrl: string | null;
  receiptNumber: string | null;
};

export type InstallmentRow = { id: string; seq: number; count: number; dueDate: string; amount: number; status: string; overdue: boolean; paid: boolean; payUrl: string | null };

export type PlanView = {
  id: string;
  title: string;
  status: PlanStatus;
  statusLabel: { label: string; cls: string };
  count: number;
  total: number;
  remaining: number;
  graceEndsOn: string | null;
  provider: string;
  installments: InstallmentRow[];
};

const METHOD: Record<string, string> = { stripe: "Carte", simulated: "Carte (démo)", transfer: "Virement", cmi: "Carte (CMI)", card: "Carte", free: "Offert" };
const TX_STATUS: Record<Transaction["status"], string> = { succeeded: "Payé", refunded: "Remboursé", partially_refunded: "Remboursé en partie" };

export function planView(p: InstallmentPlan, day: string = today(), grace: number = membershipGraceDays()): PlanView {
  const status = planStatus(p, day, grace);
  const head = p.action === "upgrade" ? "Passage à Premium" : `${p.action === "renew" ? "Renouvellement" : "Adhésion"} ${PLAN_LABEL[p.plan]}`;
  return {
    id: p.id,
    title: `${head} · ${p.count > 1 ? `${p.count} fois` : "comptant"}`,
    status,
    statusLabel: PLAN_STATUS_LABEL[status],
    count: p.count,
    total: p.totalAmount,
    remaining: remainingAmount(p.installments),
    graceEndsOn: status === "late" ? graceEndsOn(p.installments, day, grace) : null,
    provider: p.provider,
    installments: p.installments.map((i) => {
      const overdue = isOverdue(i, day);
      return { id: i.id, seq: i.seq, count: p.count, dueDate: i.dueDate, amount: i.amount, status: overdue ? INSTALLMENT_STATUS_LABEL.overdue : INSTALLMENT_STATUS_LABEL[i.status], overdue, paid: i.status === "paid", payUrl: !overdue && i.status !== "failed" ? null : i.invoiceUrl };
    }),
  };
}

function txRow(t: Transaction, base: string): HistoryRow {
  return {
    id: t.id, date: t.createdAt.slice(0, 10), label: t.description, amount: t.amount, refunded: t.amountRefunded, status: TX_STATUS[t.status],
    method: METHOD[t.provider] ?? t.provider, receiptHref: `${base}/${t.id}`, invoiceUrl: t.invoiceUrl, receiptNumber: t.receiptNumber,
  };
}

/** Paiements « historiques » (avant le grand livre, virements…) qui ne figurent pas déjà au grand livre. */
function legacyRows(payments: Payment[], txs: Transaction[], plans: InstallmentPlan[], base: string): HistoryRow[] {
  const refs = new Set(txs.map((t) => t.providerRef).filter(Boolean));
  const planned = new Set(plans.map((p) => p.paymentId).filter(Boolean));
  return payments
    .filter((p) => !planned.has(p.id) && !(p.stripeSessionId && refs.has(p.stripeSessionId)) && !refs.has(`transfer:${p.id}`))
    .map((p) => ({
      id: p.id,
      date: (p.validatedAt ?? p.declaredAt).slice(0, 10),
      label: p.kind === "booking" ? "Billet" : p.membershipAction === "upgrade" ? "Passage à Premium" : `${p.membershipAction === "renew" ? "Renouvellement" : "Adhésion"} ${p.plan ? PLAN_LABEL[p.plan] : ""}`.trim(),
      amount: p.amount,
      refunded: p.status === "refunded" ? p.amount : 0,
      status: p.status === "validated" ? "Payé" : p.status === "refunded" ? "Remboursé" : p.method === "transfer" ? "Virement à valider" : "En attente",
      method: METHOD[p.method] ?? p.method,
      receiptHref: p.status === "validated" ? `${base}/p-${p.id}` : null,
      invoiceUrl: null,
      receiptNumber: null,
    }));
}

/** « Mes paiements » d'une membre. */
export async function loadMemberPayments(profileId: string, base = "/mes-paiements/recu") {
  const repo = getRepo();
  const [plans, txs, legacy, customer] = await Promise.all([
    repo.payListPlans({ profileId }),
    repo.payListTransactions({ profileId }),
    repo.listPaymentsForProfile(profileId),
    (async () => {
      const p = getProvider();
      return p.supports.portal ? repo.payGetCustomer(p.id, { profileId }) : null;
    })().catch(() => null),
  ]);
  const views = plans.filter((p) => p.status !== "cancelled").map((p) => planView(p));
  const rows = [...txs.filter((t) => t.profileId === profileId && !t.organizationId).map((t) => txRow(t, base)), ...legacyRows(legacy, txs, plans, base)].sort((a, b) => (a.date < b.date ? 1 : -1));
  const upcoming = views
    .filter((v) => v.status !== "completed")
    .flatMap((v) => v.installments.filter((i) => !i.paid && i.status !== INSTALLMENT_STATUS_LABEL.cancelled).map((i) => ({ ...i, title: v.title })))
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  const worst = views.find((v) => v.status === "suspended") ?? views.find((v) => v.status === "late") ?? null;
  return { plans: views, rows, upcoming, worst, canManageCard: !!customer, testMode: stripeKeyMode() === "test" };
}

/** Historique et état de paiement d'un établissement (espace pro). */
export async function loadProPayments(organizationId: string) {
  const repo = getRepo();
  const txs = await repo.payListTransactions({ organizationId });
  const p = getProvider();
  const customer = p.supports.portal ? await repo.payGetCustomer(p.id, { organizationId }).catch(() => null) : null;
  return {
    rows: txs.filter((t) => t.organizationId === organizationId).map((t) => txRow(t, "/pro/abonnement/recu")),
    canManageCard: !!customer,
    provider: (p.id === "cmi" ? "stripe" : p.id) as "stripe" | "transfer" | "simulated",
    supportsSubscriptions: p.supports.subscriptions,
    testMode: stripeKeyMode() === "test",
  };
}

export type FounderPayments = Awaited<ReturnType<typeof loadFounderPayments>>;

/** Pilotage des fondatrices : encaissements par type, échéances, impayés, remboursements, événements. */
export async function loadFounderPayments() {
  const repo = getRepo();
  const day = today();
  const [txs, plans, events, refunds, profiles] = await Promise.all([
    repo.payListTransactions({ limit: 2000 }),
    repo.payListPlans({}),
    repo.payListEvents({ limit: 60 }),
    repo.payListRefunds({ limit: 50 }),
    repo.listProfiles(),
  ]);
  const name = new Map(profiles.map((p) => [p.id, fullName(p)]));
  const ym = day.slice(0, 7);
  const kinds = Object.keys(TRANSACTION_KIND_LABEL) as TransactionKind[];
  const net = (t: Transaction) => t.amount - t.amountRefunded;
  const yearAgo = `${Number(day.slice(0, 4)) - 1}${day.slice(4, 7)}`;
  const byKind = kinds.map((k) => {
    const list = txs.filter((t) => t.kind === k);
    return {
      kind: k,
      label: TRANSACTION_KIND_LABEL[k],
      month: list.filter((t) => t.createdAt.slice(0, 7) === ym).reduce((a, t) => a + net(t), 0),
      year: list.filter((t) => t.createdAt.slice(0, 7) > yearAgo).reduce((a, t) => a + net(t), 0),
      count: list.length,
    };
  });
  const views = plans.map((p) => ({ plan: p, view: planView(p, day) }));
  const late = views
    .filter((x) => x.view.status === "late" || x.view.status === "suspended")
    .map((x) => ({ ...x.view, profileId: x.plan.profileId, name: name.get(x.plan.profileId) ?? "Membre", overdue: x.view.installments.filter((i) => i.overdue).reduce((a, i) => a + i.amount, 0) }));
  const in30 = `${day}`;
  const upcoming = views
    .flatMap((x) => x.view.installments.filter((i) => !i.paid && !i.overdue && i.dueDate >= in30).map((i) => ({ ...i, name: name.get(x.plan.profileId) ?? "Membre", planId: x.plan.id })))
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))
    .slice(0, 30);
  const outstanding = views.reduce((a, x) => a + (x.view.status === "cancelled" ? 0 : x.view.remaining), 0);
  const recent = txs.slice(0, 40).map((t) => ({
    ...txRow(t, "/fondatrices/paiements/recu"),
    who: t.profileId ? (name.get(t.profileId) ?? "Membre") : t.organizationId ? "Établissement" : "Invitée",
    refundable: t.amount - t.amountRefunded > 0 && t.provider !== "transfer",
    left: Math.round((t.amount - t.amountRefunded) * 100) / 100,
  }));
  const failedEvents: StoredEvent[] = events.filter((e) => e.status === "failed");
  return {
    day,
    byKind,
    monthTotal: byKind.reduce((a, k) => a + k.month, 0),
    yearTotal: byKind.reduce((a, k) => a + k.year, 0),
    outstanding,
    late,
    upcoming,
    recent,
    refunds: refunds.map((r) => ({ ...r, label: txs.find((t) => t.id === r.transactionId)?.description ?? "Encaissement" })),
    events: events.slice(0, 20),
    failedEvents,
    provider: getProvider().id,
    testMode: stripeKeyMode() === "test",
    graceDays: membershipGraceDays(),
  };
}
