/**
 * Implémentation en mémoire de PaiementsRepo : mode démo (branchée sur les données d'exemple) et tests
 * (scripts/test-paiements.mts). Mêmes règles d'unicité que la base (0009_paiements.sql).
 */
import { randomUUID } from "node:crypto";
import type { AuditInput } from "../../data/repo";
import type { Profile, Reminder } from "../../types";
import type { PaiementsRepo } from "./repo";
import type { Checkout, Installment, InstallmentPlan, Owner, ProviderId, Refund, StoredEvent, Transaction } from "./types";

type Customer = { provider: ProviderId; customerRef: string; profileId: string | null; organizationId: string | null };

export type PaiementsState = {
  checkouts: Checkout[];
  events: StoredEvent[];
  customers: Customer[];
  plans: Omit<InstallmentPlan, "installments">[];
  installments: Installment[];
  transactions: Transaction[];
  refunds: Refund[];
  receiptSeq: number;
};

/** Données partagées avec le reste de la démo : profils (rôles), relances, équipes et abonnements des pros. */
export type MemoryHost = {
  profiles: Profile[];
  reminders: Reminder[];
  organizationMembers?: { organizationId: string; profileId: string; role: string }[];
  partenaires?: { subscriptions: { organizationId: string; plan: string; status: string; subscriptionRef?: string | null; customerRef?: string | null }[] };
};

export function emptyPaiementsState(): PaiementsState {
  return { checkouts: [], events: [], customers: [], plans: [], installments: [], transactions: [], refunds: [], receiptSeq: 0 };
}

const clone = <T>(v: T): T => structuredClone(v);

export function createMemoryPaiementsRepo(opts: {
  state: () => PaiementsState;
  host: () => MemoryHost;
  now?: () => string;
  logAudit?: (e: AuditInput) => Promise<void>;
}): PaiementsRepo {
  const S = opts.state;
  const now = opts.now ?? (() => new Date().toISOString());
  const withInstallments = (p: Omit<InstallmentPlan, "installments">): InstallmentPlan =>
    clone({ ...p, installments: S().installments.filter((i) => i.planId === p.id).sort((a, b) => a.seq - b.seq) });
  const ownerMatch = (c: Customer, o: Owner) => (o.profileId ? c.profileId === o.profileId : c.organizationId === o.organizationId);

  return {
    async payCreateCheckout(input) {
      const c: Checkout = {
        id: randomUUID(), provider: input.provider, kind: input.kind, profileId: input.profileId, organizationId: input.organizationId,
        targetId: input.targetId, plan: input.plan, installments: input.installments, amount: input.amount, currency: input.currency,
        status: "open", providerRef: null, subscriptionRef: null, customerRef: null, planId: input.planId ?? null,
        metadata: input.metadata ?? {}, createdAt: now(), completedAt: null,
      };
      S().checkouts.push(c);
      return clone(c);
    },
    async payGetCheckout(id) {
      const c = S().checkouts.find((x) => x.id === id);
      return c ? clone(c) : null;
    },
    async payFindCheckout(by) {
      const c = S().checkouts.find((x) => (by.providerRef && x.providerRef === by.providerRef) || (by.subscriptionRef && x.subscriptionRef === by.subscriptionRef));
      return c ? clone(c) : null;
    },
    async payUpdateCheckout(id, patch) {
      const c = S().checkouts.find((x) => x.id === id);
      if (!c) return;
      if (patch.providerRef && S().checkouts.some((x) => x.id !== id && x.providerRef === patch.providerRef)) throw new Error("Référence de session déjà utilisée.");
      Object.assign(c, patch);
    },

    async payRecordEvent(input) {
      const ex = S().events.find((e) => e.provider === input.provider && e.eventId === input.eventId);
      if (ex) {
        ex.attempts++;
        return { fresh: false, event: clone(ex) };
      }
      const e: StoredEvent = { provider: input.provider, eventId: input.eventId, type: input.type, payload: clone(input.payload), status: "received", attempts: 1, error: null, receivedAt: now(), processedAt: null };
      S().events.push(e);
      return { fresh: true, event: clone(e) };
    },
    async payFinishEvent(provider, eventId, status, error) {
      const e = S().events.find((x) => x.provider === provider && x.eventId === eventId);
      if (!e) return;
      e.status = status;
      e.error = error ?? null;
      e.processedAt = now();
    },
    async payGetEvent(provider, eventId) {
      const e = S().events.find((x) => x.provider === provider && x.eventId === eventId);
      return e ? clone(e) : null;
    },
    async payListEvents(o = {}) {
      return clone(
        S()
          .events.filter((e) => !o.status || e.status === o.status)
          .sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1))
          .slice(0, o.limit ?? 100),
      );
    },

    async payGetCustomer(provider, owner) {
      return S().customers.find((c) => c.provider === provider && ownerMatch(c, owner))?.customerRef ?? null;
    },
    async paySetCustomer(provider, owner, customerRef) {
      const list = S().customers;
      if (list.some((c) => c.provider === provider && c.customerRef === customerRef)) return;
      const ex = list.find((c) => c.provider === provider && ownerMatch(c, owner));
      if (ex) ex.customerRef = customerRef;
      else list.push({ provider, customerRef, profileId: owner.profileId ?? null, organizationId: owner.organizationId ?? null });
    },

    async payCreatePlan(input, installments) {
      const t = now();
      const p: Omit<InstallmentPlan, "installments"> = {
        id: randomUUID(), profileId: input.profileId, paymentId: input.paymentId, plan: input.plan, action: input.action, count: input.count,
        totalAmount: input.totalAmount, currency: input.currency, provider: input.provider, checkoutId: input.checkoutId ?? null,
        subscriptionRef: null, status: "pending", suspendedAt: null, createdAt: t, updatedAt: t,
      };
      S().plans.push(p);
      for (const i of installments) {
        S().installments.push({
          id: randomUUID(), planId: p.id, profileId: p.profileId, seq: i.seq, amount: i.amount, dueDate: i.dueDate, status: "scheduled",
          paidAt: null, attempts: 0, lastError: null, invoiceRef: null, invoiceUrl: null, invoicePdf: null, lastReminderAt: null,
        });
      }
      return withInstallments(p);
    },
    async payGetPlan(id) {
      const p = S().plans.find((x) => x.id === id);
      return p ? withInstallments(p) : null;
    },
    async payFindPlan(by) {
      const p = S().plans.find((x) => (by.subscriptionRef && x.subscriptionRef === by.subscriptionRef) || (by.paymentId && x.paymentId === by.paymentId));
      return p ? withInstallments(p) : null;
    },
    async payUpdatePlan(id, patch) {
      const p = S().plans.find((x) => x.id === id);
      if (!p) return;
      Object.assign(p, patch, { updatedAt: now() });
    },
    async payUpdateInstallment(id, patch, onlyIfStatus) {
      const i = S().installments.find((x) => x.id === id);
      if (!i || (onlyIfStatus && !onlyIfStatus.includes(i.status))) return false;
      if (patch.invoiceRef && S().installments.some((x) => x.id !== id && x.invoiceRef === patch.invoiceRef)) return false;
      Object.assign(i, patch);
      return true;
    },
    async payListPlans(o = {}) {
      return S()
        .plans.filter((p) => (!o.profileId || p.profileId === o.profileId) && (!o.statuses || o.statuses.includes(p.status)))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .map(withInstallments);
    },

    async payRecordTransaction(input) {
      if (input.providerRef) {
        const ex = S().transactions.find((t) => t.provider === input.provider && t.providerRef === input.providerRef);
        if (ex) return { transaction: clone(ex), fresh: false };
      }
      const st = S();
      st.receiptSeq++;
      const t: Transaction = {
        id: randomUUID(), provider: input.provider, kind: input.kind, profileId: input.profileId, organizationId: input.organizationId,
        amount: input.amount, amountRefunded: 0, currency: input.currency, status: "succeeded", description: input.description,
        providerRef: input.providerRef ?? null, chargeRef: input.chargeRef ?? null, invoiceUrl: input.invoiceUrl ?? null, invoicePdf: input.invoicePdf ?? null,
        receiptNumber: `NC-${now().slice(0, 4)}-${String(st.receiptSeq).padStart(6, "0")}`,
        relatedType: input.relatedType ?? null, relatedId: input.relatedId ?? null, createdAt: now(),
      };
      st.transactions.push(t);
      return { transaction: clone(t), fresh: true };
    },
    async payFindTransaction(by) {
      const t = S().transactions.find((x) => (by.id && x.id === by.id) || (by.providerRef && x.providerRef === by.providerRef) || (by.chargeRef && x.chargeRef === by.chargeRef));
      return t ? clone(t) : null;
    },
    async payUpdateTransaction(id, patch) {
      const t = S().transactions.find((x) => x.id === id);
      if (!t) return;
      if (patch.amountRefunded > t.amount + 1e-9) throw new Error("Remboursement supérieur au montant encaissé.");
      t.amountRefunded = patch.amountRefunded;
      t.status = patch.status;
    },
    async payListTransactions(o = {}) {
      return clone(
        S()
          .transactions.filter((t) => (!o.profileId || t.profileId === o.profileId) && (!o.organizationId || t.organizationId === o.organizationId))
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
          .slice(0, o.limit ?? 500),
      );
    },
    async payRecordRefund(input) {
      if (input.providerRef) {
        const ex = S().refunds.find((r) => r.providerRef === input.providerRef);
        if (ex) return { refund: clone(ex), fresh: false };
      }
      const r: Refund = { id: randomUUID(), ...input, createdAt: now() };
      S().refunds.push(r);
      return { refund: clone(r), fresh: true };
    },
    async payListRefunds(o = {}) {
      return clone([...S().refunds].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, o.limit ?? 200));
    },

    async paySetMemberAccess(profileId, active) {
      const p = opts.host().profiles.find((x) => x.id === profileId);
      if (!p || p.roles.includes("admin")) return false;
      if (active && !p.roles.includes("member")) p.roles = [...p.roles, "member"];
      if (!active) p.roles = p.roles.filter((r) => r !== "member");
      return true;
    },

    async payRenewalCandidates(fromYmd, toYmd) {
      return clone(opts.host().profiles.filter((p) => p.roles.includes("member") && p.plan !== "free" && !!p.planEndsAt && p.planEndsAt >= fromYmd && p.planEndsAt <= toYmd));
    },
    async payDueReminders(todayYmd) {
      return clone(opts.host().reminders.filter((r) => r.reason === "renewal" && !r.sentAt && !!r.scheduledFor && r.scheduledFor <= todayYmd));
    },
    async payScheduleReminder(input) {
      const list = opts.host().reminders;
      if (list.some((r) => r.reason === "renewal" && r.profileId === input.profileId && r.dueAt === input.dueAt && r.scheduledFor === input.scheduledFor)) return false;
      list.push({ id: randomUUID(), profileId: input.profileId, eventId: null, reason: "renewal", dueAt: input.dueAt, sentAt: null, answered: false, scheduledFor: input.scheduledFor });
      return true;
    },
    async payMarkReminderSent(id) {
      const r = opts.host().reminders.find((x) => x.id === id);
      if (r && !r.sentAt) r.sentAt = now();
    },

    async payContact(profileId) {
      const p = opts.host().profiles.find((x) => x.id === profileId);
      return p ? { profileId: p.id, email: p.email, firstName: p.firstName, planEndsAt: p.planEndsAt } : null;
    },
    async payOrgContacts(organizationId) {
      const h = opts.host();
      return (h.organizationMembers ?? [])
        .filter((m) => m.organizationId === organizationId)
        .sort((a, b) => (a.role === "owner" ? 0 : 1) - (b.role === "owner" ? 0 : 1))
        .map((m) => h.profiles.find((p) => p.id === m.profileId))
        .filter((p): p is Profile => !!p)
        .map((p) => ({ profileId: p.id, email: p.email, firstName: p.firstName, planEndsAt: p.planEndsAt }));
    },
    async payProSubscription(organizationId) {
      const s = opts.host().partenaires?.subscriptions.find((x) => x.organizationId === organizationId);
      return s ? { organizationId, plan: s.plan, status: s.status, subscriptionRef: s.subscriptionRef ?? null, customerRef: s.customerRef ?? null } : null;
    },

    async payAudit(entry) {
      if (opts.logAudit) await opts.logAudit(entry);
    },
  };
}
