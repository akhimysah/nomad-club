/**
 * Mode démo : PaiementsRepo en mémoire, branché sur les données d'exemple (profils, relances),
 * avec deux échéanciers d'exemple :
 * - Inès, adhésion Membre en 12 fois depuis le 18 novembre 2025 (11 échéances payées, la dernière le 18 octobre) ;
 * - Nawal, adhésion Membre en 12 fois depuis le 2 février 2026, échéance du 2 octobre refusée (en retard).
 */
import { randomUUID } from "node:crypto";
import { nowIso } from "../../clock";
import type { AuditInput } from "../../data/repo";
import type { SeedData } from "../../seed";
import { createMemoryPaiementsRepo, emptyPaiementsState, type PaiementsState } from "./memory-repo";
import { currency } from "./money";
import { installmentLabel } from "./processor";
import { buildSchedule } from "./schedule";
import type { InstallmentPlan, PlanStatus } from "./types";
import type { PaiementsRepo } from "./repo";

type G = typeof globalThis & { __nomadPaiements?: PaiementsState };

function seedPlan(s: PaiementsState, input: { profileId: string; start: string; count: number; paid: number; failedSeq?: number; status: PlanStatus }) {
  const id = randomUUID();
  const at = `${input.start}T10:00:00.000Z`;
  const plan: Omit<InstallmentPlan, "installments"> = {
    id, profileId: input.profileId, paymentId: null, plan: "member", action: "join", count: input.count, totalAmount: 670, currency: currency(),
    provider: "simulated", checkoutId: null, subscriptionRef: `sim_sub_demo_${input.profileId}`, status: input.status, suspendedAt: null, createdAt: at, updatedAt: at,
  };
  s.plans.push(plan);
  buildSchedule(670, input.count, input.start).forEach((i) => {
    const paid = i.seq <= input.paid;
    const failed = i.seq === input.failedSeq;
    const ref = paid ? `sim_in_demo_${input.profileId}_${i.seq}` : null;
    s.installments.push({
      id: randomUUID(), planId: id, profileId: input.profileId, seq: i.seq, amount: i.amount, dueDate: i.dueDate, status: paid ? "paid" : failed ? "failed" : "scheduled",
      paidAt: paid ? `${i.dueDate}T09:00:00.000Z` : null, attempts: failed ? 2 : 0, lastError: failed ? "Carte expirée (exemple)." : null, invoiceRef: ref,
      invoiceUrl: null, invoicePdf: null, lastReminderAt: null,
    });
    if (paid) {
      s.receiptSeq++;
      s.transactions.push({
        id: randomUUID(), provider: "simulated", kind: "installment", profileId: input.profileId, organizationId: null, amount: i.amount, amountRefunded: 0,
        currency: currency(), status: "succeeded", description: installmentLabel(plan, i.seq), providerRef: ref, chargeRef: null, invoiceUrl: null, invoicePdf: null,
        receiptNumber: `NC-${i.dueDate.slice(0, 4)}-${String(s.receiptSeq).padStart(6, "0")}`, relatedType: "installment_plan", relatedId: id, createdAt: `${i.dueDate}T09:00:00.000Z`,
      });
    }
  });
}

function createState(): PaiementsState {
  const s = emptyPaiementsState();
  seedPlan(s, { profileId: "p-ines", start: "2025-11-18", count: 12, paid: 11, status: "active" });
  seedPlan(s, { profileId: "p-nawal", start: "2026-02-02", count: 12, paid: 8, failedSeq: 9, status: "late" });
  return s;
}

function state(): PaiementsState {
  const g = globalThis as G;
  if (!g.__nomadPaiements) g.__nomadPaiements = createState();
  return g.__nomadPaiements;
}

export function paiementsDemoRepo(db: () => SeedData, logAudit: (e: AuditInput) => Promise<void>): PaiementsRepo {
  return createMemoryPaiementsRepo({ state, host: db, now: nowIso, logAudit });
}
