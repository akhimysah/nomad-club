/**
 * Implémentation « réelle » de PaiementsRepo (tables de 0009_paiements.sql).
 * - Écritures et lectures « système » (webhook, tâche planifiée) : clé service (SUPABASE_SERVICE_ROLE_KEY).
 * - Lectures des pages (« Mes paiements », espace pro, fondatrices) : session de la personne, sous RLS.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin, supabaseServer } from "../../supabase/server";
import type { Profile, Reminder } from "../../types";
import type { PaiementsRepo } from "./repo";
import type { Checkout, Installment, InstallmentPlan, Owner, Refund, StoredEvent, Transaction } from "./types";

type Row = Record<string, unknown>;
const str = (v: unknown): string => (v == null ? "" : String(v));
const strN = (v: unknown): string | null => (v == null ? null : String(v));
const num = (v: unknown): number => (v == null ? 0 : Number(v));

function check<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}
const isUnique = (e: { code?: string } | null) => e?.code === "23505";

const admin = (): SupabaseClient => supabaseAdmin();
const session = async (): Promise<SupabaseClient> => supabaseServer();

function toCheckout(r: Row): Checkout {
  return {
    id: str(r.id), provider: r.provider as Checkout["provider"], kind: r.kind as Checkout["kind"], profileId: strN(r.profile_id), organizationId: strN(r.organization_id),
    targetId: strN(r.target_id), plan: strN(r.plan), installments: num(r.installments) || 1, amount: num(r.amount), currency: str(r.currency) || "USD",
    status: r.status as Checkout["status"], providerRef: strN(r.provider_ref), subscriptionRef: strN(r.subscription_ref), customerRef: strN(r.customer_ref),
    planId: strN(r.plan_id), metadata: (r.metadata as Record<string, string>) ?? {}, createdAt: str(r.created_at), completedAt: strN(r.completed_at),
  };
}

function toEvent(r: Row): StoredEvent {
  return {
    provider: r.provider as StoredEvent["provider"], eventId: str(r.event_id), type: str(r.type), payload: r.payload, status: r.status as StoredEvent["status"],
    attempts: num(r.attempts), error: strN(r.error), receivedAt: str(r.received_at), processedAt: strN(r.processed_at),
  };
}

function toInstallment(r: Row): Installment {
  return {
    id: str(r.id), planId: str(r.plan_id), profileId: str(r.profile_id), seq: num(r.seq), amount: num(r.amount), dueDate: str(r.due_date).slice(0, 10),
    status: r.status as Installment["status"], paidAt: strN(r.paid_at), attempts: num(r.attempts), lastError: strN(r.last_error), invoiceRef: strN(r.invoice_ref),
    invoiceUrl: strN(r.invoice_url), invoicePdf: strN(r.invoice_pdf), lastReminderAt: strN(r.last_reminder_at),
  };
}

function toPlan(r: Row): InstallmentPlan {
  return {
    id: str(r.id), profileId: str(r.profile_id), paymentId: strN(r.payment_id), plan: r.plan as InstallmentPlan["plan"], action: r.membership_action as InstallmentPlan["action"],
    count: num(r.installments_count), totalAmount: num(r.total_amount), currency: str(r.currency) || "USD", provider: r.provider as InstallmentPlan["provider"],
    checkoutId: strN(r.checkout_id), subscriptionRef: strN(r.subscription_ref), status: r.status as InstallmentPlan["status"], suspendedAt: strN(r.suspended_at),
    createdAt: str(r.created_at), updatedAt: str(r.updated_at),
    installments: ((r.installments as Row[] | null) ?? []).map(toInstallment).sort((a, b) => a.seq - b.seq),
  };
}

function toTransaction(r: Row): Transaction {
  return {
    id: str(r.id), provider: r.provider as Transaction["provider"], kind: r.kind as Transaction["kind"], profileId: strN(r.profile_id), organizationId: strN(r.organization_id),
    amount: num(r.amount), amountRefunded: num(r.amount_refunded), currency: str(r.currency) || "USD", status: r.status as Transaction["status"], description: str(r.description),
    providerRef: strN(r.provider_ref), chargeRef: strN(r.charge_ref), invoiceUrl: strN(r.invoice_url), invoicePdf: strN(r.invoice_pdf), receiptNumber: str(r.receipt_number),
    relatedType: strN(r.related_type), relatedId: strN(r.related_id), createdAt: str(r.created_at),
  };
}

function toRefund(r: Row): Refund {
  return { id: str(r.id), transactionId: str(r.transaction_id), amount: num(r.amount), reason: strN(r.reason), providerRef: strN(r.provider_ref), createdBy: strN(r.created_by), createdAt: str(r.created_at) };
}

const PLAN_SELECT = "*, installments(*)";
/** user_roles a deux clés vers profiles (profile_id, granted_by) : on précise la jointure. */
const PROFILE = "*, user_roles:user_roles!user_roles_profile_id_fkey(role)";

function ownerColumn(owner: Owner): ["profile_id" | "organization_id", string] {
  return owner.profileId ? ["profile_id", owner.profileId] : ["organization_id", owner.organizationId!];
}

export const paiementsSupabaseRepo: PaiementsRepo = {
  async payCreateCheckout(input) {
    const r = check(
      await admin()
        .from("payment_checkouts")
        .insert({
          provider: input.provider, kind: input.kind, profile_id: input.profileId, organization_id: input.organizationId, target_id: input.targetId,
          plan: input.plan, installments: input.installments, amount: input.amount, currency: input.currency, plan_id: input.planId ?? null, metadata: input.metadata ?? {},
        })
        .select("*")
        .single(),
    ) as Row;
    return toCheckout(r);
  },
  async payGetCheckout(id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const r = check(await admin().from("payment_checkouts").select("*").eq("id", id).maybeSingle()) as Row | null;
    return r ? toCheckout(r) : null;
  },
  async payFindCheckout(by) {
    let q = admin().from("payment_checkouts").select("*");
    if (by.providerRef) q = q.eq("provider_ref", by.providerRef);
    else if (by.subscriptionRef) q = q.eq("subscription_ref", by.subscriptionRef);
    else return null;
    const r = check(await q.order("created_at", { ascending: false }).limit(1).maybeSingle()) as Row | null;
    return r ? toCheckout(r) : null;
  },
  async payUpdateCheckout(id, patch) {
    const row: Row = {};
    if (patch.status) row.status = patch.status;
    if (patch.providerRef !== undefined) row.provider_ref = patch.providerRef;
    if (patch.subscriptionRef !== undefined) row.subscription_ref = patch.subscriptionRef;
    if (patch.customerRef !== undefined) row.customer_ref = patch.customerRef;
    if (patch.planId !== undefined) row.plan_id = patch.planId;
    if (patch.completedAt !== undefined) row.completed_at = patch.completedAt;
    if (patch.targetId !== undefined) row.target_id = patch.targetId;
    if (Object.keys(row).length) check(await admin().from("payment_checkouts").update(row).eq("id", id));
  },

  async payRecordEvent(input) {
    const w = admin();
    const ins = await w.from("payment_events").insert({ provider: input.provider, event_id: input.eventId, type: input.type, payload: input.payload ?? {}, attempts: 1 }).select("*").single();
    if (!ins.error) return { fresh: true, event: toEvent(ins.data as Row) };
    if (!isUnique(ins.error)) throw new Error(ins.error.message);
    const ex = check(await w.from("payment_events").select("*").eq("provider", input.provider).eq("event_id", input.eventId).single()) as Row;
    await w.from("payment_events").update({ attempts: num(ex.attempts) + 1 }).eq("provider", input.provider).eq("event_id", input.eventId);
    return { fresh: false, event: toEvent(ex) };
  },
  async payFinishEvent(provider, eventId, status, error) {
    check(await admin().from("payment_events").update({ status, error: error ?? null, processed_at: new Date().toISOString() }).eq("provider", provider).eq("event_id", eventId));
  },
  async payGetEvent(provider, eventId) {
    const r = check(await admin().from("payment_events").select("*").eq("provider", provider).eq("event_id", eventId).maybeSingle()) as Row | null;
    return r ? toEvent(r) : null;
  },
  async payListEvents(o = {}) {
    let q = (await session()).from("payment_events").select("*").order("received_at", { ascending: false }).limit(o.limit ?? 100);
    if (o.status) q = q.eq("status", o.status);
    return (check(await q) as Row[]).map(toEvent);
  },

  async payGetCustomer(provider, owner) {
    const [col, val] = ownerColumn(owner);
    const r = check(await admin().from("payment_customers").select("customer_ref").eq("provider", provider).eq(col, val).maybeSingle()) as Row | null;
    return r ? strN(r.customer_ref) : null;
  },
  async paySetCustomer(provider, owner, customerRef) {
    const w = admin();
    const [col, val] = ownerColumn(owner);
    const ex = check(await w.from("payment_customers").select("id, customer_ref").eq("provider", provider).eq(col, val).maybeSingle()) as Row | null;
    if (ex) {
      if (str(ex.customer_ref) !== customerRef) await w.from("payment_customers").update({ customer_ref: customerRef }).eq("id", str(ex.id));
      return;
    }
    const res = await w.from("payment_customers").insert({ provider, customer_ref: customerRef, profile_id: owner.profileId ?? null, organization_id: owner.organizationId ?? null });
    if (res.error && !isUnique(res.error)) throw new Error(res.error.message);
  },

  async payCreatePlan(input, installments) {
    const w = admin();
    const p = check(
      await w
        .from("installment_plans")
        .insert({
          profile_id: input.profileId, payment_id: input.paymentId, plan: input.plan, membership_action: input.action, installments_count: input.count,
          total_amount: input.totalAmount, currency: input.currency, provider: input.provider, checkout_id: input.checkoutId ?? null,
        })
        .select("id")
        .single(),
    ) as Row;
    check(await w.from("installments").insert(installments.map((i) => ({ plan_id: str(p.id), profile_id: input.profileId, seq: i.seq, amount: i.amount, due_date: i.dueDate }))));
    const r = check(await w.from("installment_plans").select(PLAN_SELECT).eq("id", str(p.id)).single()) as Row;
    return toPlan(r);
  },
  async payGetPlan(id) {
    const r = check(await admin().from("installment_plans").select(PLAN_SELECT).eq("id", id).maybeSingle()) as Row | null;
    return r ? toPlan(r) : null;
  },
  async payFindPlan(by) {
    let q = admin().from("installment_plans").select(PLAN_SELECT);
    if (by.subscriptionRef) q = q.eq("subscription_ref", by.subscriptionRef);
    else if (by.paymentId) q = q.eq("payment_id", by.paymentId);
    else return null;
    const r = check(await q.limit(1).maybeSingle()) as Row | null;
    return r ? toPlan(r) : null;
  },
  async payUpdatePlan(id, patch) {
    const row: Row = { updated_at: new Date().toISOString() };
    if (patch.status) row.status = patch.status;
    if (patch.subscriptionRef !== undefined) row.subscription_ref = patch.subscriptionRef;
    if (patch.checkoutId !== undefined) row.checkout_id = patch.checkoutId;
    if (patch.suspendedAt !== undefined) row.suspended_at = patch.suspendedAt;
    if (patch.paymentId !== undefined) row.payment_id = patch.paymentId;
    check(await admin().from("installment_plans").update(row).eq("id", id));
  },
  async payUpdateInstallment(id, patch, onlyIfStatus) {
    const row: Row = {};
    if (patch.status) row.status = patch.status;
    if (patch.paidAt !== undefined) row.paid_at = patch.paidAt;
    if (patch.attempts !== undefined) row.attempts = patch.attempts;
    if (patch.lastError !== undefined) row.last_error = patch.lastError;
    if (patch.invoiceRef !== undefined) row.invoice_ref = patch.invoiceRef;
    if (patch.invoiceUrl !== undefined) row.invoice_url = patch.invoiceUrl;
    if (patch.invoicePdf !== undefined) row.invoice_pdf = patch.invoicePdf;
    if (patch.lastReminderAt !== undefined) row.last_reminder_at = patch.lastReminderAt;
    let q = admin().from("installments").update(row).eq("id", id);
    if (onlyIfStatus) q = q.in("status", onlyIfStatus);
    const res = await q.select("id");
    if (res.error) {
      if (isUnique(res.error)) return false; // facture déjà rattachée à une autre échéance
      throw new Error(res.error.message);
    }
    return (res.data ?? []).length > 0;
  },
  async payListPlans(o = {}) {
    const c = o.system ? admin() : await session();
    let q = c.from("installment_plans").select(PLAN_SELECT).order("created_at", { ascending: false });
    if (o.profileId) q = q.eq("profile_id", o.profileId);
    if (o.statuses) q = q.in("status", o.statuses);
    return (check(await q) as Row[]).map(toPlan);
  },

  async payRecordTransaction(input) {
    const w = admin();
    if (input.providerRef) {
      const ex = check(await w.from("payment_transactions").select("*").eq("provider", input.provider).eq("provider_ref", input.providerRef).maybeSingle()) as Row | null;
      if (ex) return { transaction: toTransaction(ex), fresh: false };
    }
    const res = await w
      .from("payment_transactions")
      .insert({
        provider: input.provider, kind: input.kind, profile_id: input.profileId, organization_id: input.organizationId, amount: input.amount, currency: input.currency,
        description: input.description.slice(0, 300), provider_ref: input.providerRef ?? null, charge_ref: input.chargeRef ?? null, invoice_url: input.invoiceUrl ?? null,
        invoice_pdf: input.invoicePdf ?? null, related_type: input.relatedType ?? null, related_id: input.relatedId ?? null,
      })
      .select("*")
      .single();
    if (res.error) {
      if (isUnique(res.error) && input.providerRef) {
        const ex = check(await w.from("payment_transactions").select("*").eq("provider", input.provider).eq("provider_ref", input.providerRef).single()) as Row;
        return { transaction: toTransaction(ex), fresh: false };
      }
      throw new Error(res.error.message);
    }
    return { transaction: toTransaction(res.data as Row), fresh: true };
  },
  async payFindTransaction(by) {
    const c = by.system ? admin() : await session();
    let q = c.from("payment_transactions").select("*");
    if (by.id) q = q.eq("id", by.id);
    else if (by.providerRef) q = q.eq("provider_ref", by.providerRef);
    else if (by.chargeRef) q = q.eq("charge_ref", by.chargeRef);
    else return null;
    const r = check(await q.limit(1).maybeSingle()) as Row | null;
    return r ? toTransaction(r) : null;
  },
  async payUpdateTransaction(id, patch) {
    check(await admin().from("payment_transactions").update({ amount_refunded: patch.amountRefunded, status: patch.status }).eq("id", id));
  },
  async payListTransactions(o = {}) {
    let q = (await session()).from("payment_transactions").select("*").order("created_at", { ascending: false }).limit(o.limit ?? 500);
    if (o.profileId) q = q.eq("profile_id", o.profileId);
    if (o.organizationId) q = q.eq("organization_id", o.organizationId);
    return (check(await q) as Row[]).map(toTransaction);
  },
  async payRecordRefund(input) {
    const w = admin();
    if (input.providerRef) {
      const ex = check(await w.from("payment_refunds").select("*").eq("provider_ref", input.providerRef).maybeSingle()) as Row | null;
      if (ex) return { refund: toRefund(ex), fresh: false };
    }
    const res = await w
      .from("payment_refunds")
      .insert({ transaction_id: input.transactionId, amount: input.amount, reason: input.reason, provider_ref: input.providerRef, created_by: input.createdBy })
      .select("*")
      .single();
    if (res.error) {
      if (isUnique(res.error) && input.providerRef) {
        const ex = check(await w.from("payment_refunds").select("*").eq("provider_ref", input.providerRef).single()) as Row;
        return { refund: toRefund(ex), fresh: false };
      }
      throw new Error(res.error.message);
    }
    return { refund: toRefund(res.data as Row), fresh: true };
  },
  async payListRefunds(o = {}) {
    return (check(await (await session()).from("payment_refunds").select("*").order("created_at", { ascending: false }).limit(o.limit ?? 200)) as Row[]).map(toRefund);
  },

  async paySetMemberAccess(profileId, active) {
    return Boolean(check(await admin().rpc("pay_set_member_access", { p_profile: profileId, p_active: active })));
  },

  async payRenewalCandidates(fromYmd, toYmd) {
    const rows = check(await admin().from("profiles").select(PROFILE).neq("plan", "free").gte("plan_ends_at", fromYmd).lte("plan_ends_at", toYmd)) as Row[];
    return rows
      .filter((r) => ((r.user_roles as Row[] | null) ?? []).some((x) => x.role === "member"))
      .map(
        (r): Profile => ({
          id: str(r.id), firstName: str(r.first_name), lastName: str(r.last_name), whatsapp: strN(r.whatsapp), email: strN(r.email), job: strN(r.job), country: strN(r.country),
          bio: strN(r.bio), roles: ["member"], plan: (r.plan as Profile["plan"]) ?? "member", planEndsAt: strN(r.plan_ends_at), avatarUrl: strN(r.avatar_url),
          marrakechSince: strN(r.marrakech_since), cardNumber: strN(r.card_number), createdAt: str(r.created_at),
        }),
      );
  },
  async payDueReminders(todayYmd) {
    const rows = check(await admin().from("reminders").select("*").eq("reason", "renewal").is("sent_at", null).lte("scheduled_for", todayYmd)) as Row[];
    return rows.map(
      (r): Reminder => ({
        id: str(r.id), profileId: strN(r.profile_id), eventId: strN(r.event_id), reason: "renewal", dueAt: strN(r.due_at), sentAt: null, answered: Boolean(r.answered), scheduledFor: strN(r.scheduled_for),
      }),
    );
  },
  async payScheduleReminder(input) {
    const w = admin();
    const ex = check(await w.from("reminders").select("id").eq("reason", "renewal").eq("profile_id", input.profileId).eq("due_at", input.dueAt).eq("scheduled_for", input.scheduledFor).limit(1)) as Row[];
    if (ex.length) return false;
    check(await w.from("reminders").insert({ profile_id: input.profileId, reason: "renewal", due_at: input.dueAt, scheduled_for: input.scheduledFor }));
    return true;
  },
  async payMarkReminderSent(id) {
    check(await admin().from("reminders").update({ sent_at: new Date().toISOString() }).eq("id", id).is("sent_at", null));
  },

  async payContact(profileId) {
    const r = check(await admin().from("profiles").select("id, email, first_name, plan_ends_at").eq("id", profileId).maybeSingle()) as Row | null;
    return r ? { profileId: str(r.id), email: strN(r.email), firstName: str(r.first_name), planEndsAt: strN(r.plan_ends_at) } : null;
  },
  async payOrgContacts(organizationId) {
    const rows = check(
      await admin().from("organization_members").select("role, profile:profiles(id, email, first_name, plan_ends_at)").eq("organization_id", organizationId),
    ) as Row[];
    return rows
      .filter((r) => r.profile)
      .sort((a, b) => (a.role === "owner" ? 0 : 1) - (b.role === "owner" ? 0 : 1))
      .map((r) => {
        const p = r.profile as Row;
        return { profileId: str(p.id), email: strN(p.email), firstName: str(p.first_name), planEndsAt: strN(p.plan_ends_at) };
      });
  },
  async payProSubscription(organizationId) {
    const r = check(await admin().from("pro_subscriptions").select("*").eq("organization_id", organizationId).maybeSingle()) as Row | null;
    return r ? { organizationId, plan: str(r.plan), status: str(r.status), subscriptionRef: strN(r.subscription_ref), customerRef: strN(r.customer_ref) } : null;
  },

  async payAudit(entry) {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const res = await admin()
      .from("audit_log")
      .insert({
        actor_id: entry.actorId, action: entry.action, target_type: entry.targetType, target_id: entry.targetId && uuid.test(entry.targetId) ? entry.targetId : null,
        summary: entry.summary.slice(0, 300), details: entry.details ?? {},
      });
    if (res.error) console.error("[paiements] journal", res.error.message);
  },
};
