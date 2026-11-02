/**
 * Tâche quotidienne des paiements (/api/cron/paiements, vercel.json) :
 * 1. démo : prélève les échéances simulées arrivées à date ;
 * 2. échéanciers : retard → relances (notification + e-mail tous les N jours) → suspension de l'accès
 *    après le délai de grâce (MEMBERSHIP_GRACE_DAYS) ; rétablissement si la situation est régularisée ;
 * 3. renouvellement : programme et envoie les rappels J-30, J-7, J-1 (table reminders) ;
 * 4. carnet pro : statuts échus (retard puis suspension) pour les abonnements hors Stripe.
 */
import { addDays } from "../../clock";
import { nowIso, today as todayFn } from "../../clock";
import { getRepo } from "../../data";
import { PLAN_LABEL } from "../../format";
import { membershipGraceDays, membershipPrices, reminderEveryDays, renewalReminderDays } from "./config";
import { longDate, PAYMENT_EMAILS } from "./emails";
import { appEffects } from "./effects";
import { formatMoney } from "./money";
import { installmentLabel } from "./processor";
import { activeProviderId } from "./providers";
import { simulateNextInstallment } from "./service";
import { graceEndsOn, isOverdue, planStatus, reminderDue, renewalReminderDay } from "./schedule";

export type DailySummary = {
  day: string;
  simulatedCharges: number;
  late: number;
  suspended: number;
  reinstated: number;
  overdueReminders: number;
  renewalReminders: number;
  proStatusChanges: number;
};

const dots = (ymd: string) => ymd.split("-").reverse().join(".");

export async function runDailyPayments(): Promise<DailySummary> {
  const repo = getRepo();
  const fx = appEffects();
  const day = todayFn();
  const grace = membershipGraceDays();
  const every = reminderEveryDays();
  const sum: DailySummary = { day, simulatedCharges: 0, late: 0, suspended: 0, reinstated: 0, overdueReminders: 0, renewalReminders: 0, proStatusChanges: 0 };

  const tell = async (profileId: string, n: { type: "payment_reminder" | "membership_suspended" | "membership_renewal" | "payment_receipt"; title: string; body: string; link: string }, template: string | null, data: Record<string, unknown>) => {
    await fx.notify([{ recipientId: profileId, ...n }]);
    const c = await repo.payContact(profileId);
    if (template && c?.email) await fx.email({ template, to: c.email, data: { firstName: c.firstName, ...data } });
  };

  /* 1. démo : échéances simulées arrivées à date */
  if (activeProviderId() === "simulated") {
    for (const plan of await repo.payListPlans({ statuses: ["active", "late"], system: true })) {
      if (plan.provider !== "simulated") continue;
      const due = plan.installments.find((i) => i.status === "scheduled" && i.dueDate <= day);
      if (due && (await simulateNextInstallment(plan.id)).ok) sum.simulatedCharges++;
    }
  }

  /* 2. échéanciers : retard, relances, suspension */
  for (const plan of await repo.payListPlans({ statuses: ["active", "late", "suspended"], system: true })) {
    for (const i of plan.installments) if (i.status === "scheduled" && isOverdue(i, day)) await repo.payUpdateInstallment(i.id, { status: "late" }, ["scheduled"]);
    const st = planStatus(plan, day, grace);
    if (st !== plan.status) {
      await repo.payUpdatePlan(plan.id, { status: st, suspendedAt: st === "suspended" ? nowIso() : null });
      if (st === "suspended") {
        await repo.paySetMemberAccess(plan.profileId, false);
        sum.suspended++;
        await repo.payAudit({ actorId: null, action: "membership.suspend", targetType: "profile", targetId: plan.profileId, summary: `Accès membre suspendu : échéance impayée depuis plus de ${grace} jours`, details: { plan: plan.id } });
        await tell(plan.profileId, { type: "membership_suspended", title: "Ton accès est suspendu", body: `Une échéance de ton adhésion reste impayée depuis plus de ${grace} jours. Règle-la pour retrouver ton espace membre.`, link: "/mes-paiements" }, null /* e-mail : notification relayée par le chantier e-mails */, {});
      } else if (plan.status === "suspended") {
        await repo.paySetMemberAccess(plan.profileId, true);
        sum.reinstated++;
        await repo.payAudit({ actorId: null, action: "membership.reinstate", targetType: "profile", targetId: plan.profileId, summary: "Accès membre rétabli (échéancier régularisé)", details: { plan: plan.id } });
      } else if (st === "late") sum.late++;
    }
    if (st !== "late" && st !== "suspended") continue;
    for (const i of plan.installments) {
      if (!reminderDue(i, day, every)) continue;
      const label = installmentLabel(plan, i.seq);
      const until = graceEndsOn(plan.installments, day, grace);
      await tell(
        plan.profileId,
        { type: "payment_reminder", title: `Échéance en retard · ${formatMoney(i.amount)}`, body: `${label}, prévue le ${dots(i.dueDate)}.${st === "late" && until ? ` Ton accès est maintenu jusqu’au ${dots(until)}.` : ""}`, link: "/mes-paiements" },
        PAYMENT_EMAILS.failed,
        { label, amount: formatMoney(i.amount), dueDate: longDate(i.dueDate), reason: st === "suspended" ? "Échéance impayée : accès suspendu jusqu’au règlement." : `Échéance non réglée${until ? ` : accès maintenu jusqu’au ${longDate(until)}` : ""}.`, payUrl: i.invoiceUrl ?? "/mes-paiements" },
      );
      await repo.payUpdateInstallment(i.id, { lastReminderAt: nowIso() });
      sum.overdueReminders++;
      break; // une relance par échéancier et par jour
    }
  }

  /* 3. renouvellement : rappels J-30, J-7, J-1 */
  const days = renewalReminderDays();
  // PAYMENT_RENEWAL_REMINDERS=false : rappels laissés à /api/cron/emails (chantier e-mails), pour ne pas les envoyer deux fois
  if (days.length && process.env.PAYMENT_RENEWAL_REMINDERS !== "false") {
    const candidates = await repo.payRenewalCandidates(day, addDays(day, Math.max(...days)));
    for (const p of candidates) {
      if (renewalReminderDay(p.planEndsAt, day, days) !== null) await repo.payScheduleReminder({ profileId: p.id, dueAt: p.planEndsAt!, scheduledFor: day });
    }
    const byId = new Map(candidates.map((p) => [p.id, p]));
    const prices = membershipPrices();
    for (const r of await repo.payDueReminders(day)) {
      if (!r.profileId || !r.dueAt) continue;
      const p = byId.get(r.profileId);
      if (!p || p.planEndsAt !== r.dueAt) continue; // déjà renouvelée (ou plus adhérente) : plus de rappel
      const left = Math.max(0, Math.round((Date.parse(r.dueAt) - Date.parse(day)) / 86400000));
      const plan = p.plan === "premium" ? "premium" : "member";
      await tell(
        p.id,
        { type: "membership_renewal", title: left <= 1 ? "Ton adhésion se termine demain" : `Ton adhésion se termine dans ${left} jours`, body: `Formule ${PLAN_LABEL[plan]}, jusqu’au ${dots(r.dueAt)}. Renouvelle-la depuis « Moi », en une ou plusieurs fois.`, link: "/espace/moi" },
        PAYMENT_EMAILS.renewal,
        { planLabel: PLAN_LABEL[plan], endsOn: longDate(r.dueAt), daysLeft: left, amount: formatMoney(prices[plan]), renewUrl: "/espace/moi" },
      );
      await repo.payMarkReminderSent(r.id);
      sum.renewalReminders++;
    }
  }

  /* 4. carnet pro (hors Stripe : Stripe synchronise les statuts par webhook) */
  sum.proStatusChanges = await repo.refreshSubscriptions(day).catch(() => 0);
  return sum;
}
