/**
 * Règles pures de l'échéancier d'adhésion (1, 3 ou 12 fois) : découpage du montant, dates, statut.
 * Utilisées à l'identique par le mode démo, le mode réel et les tests (scripts/test-paiements.mts).
 */
import type { Installment, InstallmentPlan, NewInstallment, PlanStatus } from "./types";

/** Jours laissés au prestataire pour prélever une échéance à sa date avant de la compter en retard. */
export const LATE_TOLERANCE_DAYS = 2;

const DAY = 86400000;

function parse(ymd: string): number {
  return Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)));
}
function fmt(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDaysYmd(ymd: string, n: number): string {
  return fmt(parse(ymd) + n * DAY);
}

export function daysFrom(a: string, b: string): number {
  return Math.round((parse(b) - parse(a)) / DAY);
}

/** Ajoute des mois en gardant le jour, ramené au dernier jour du mois si besoin (31 janv. + 1 → 28/29 févr.), comme Stripe. */
export function addMonths(ymd: string, n: number): string {
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(5, 7)) - 1 + n;
  const d = Number(ymd.slice(8, 10));
  const ty = y + Math.floor(m / 12);
  const tm = ((m % 12) + 12) % 12;
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return fmt(Date.UTC(ty, tm, Math.min(d, last)));
}

/**
 * Découpe un total en `n` échéances au centime près ; le reste éventuel va sur la première
 * (670 en 3 fois → 223,34 + 223,33 + 223,33).
 */
export function splitAmount(total: number, n: number): number[] {
  if (!Number.isInteger(n) || n < 1) throw new Error("Nombre d'échéances invalide.");
  const cents = Math.round(total * 100);
  if (cents < 0) throw new Error("Montant invalide.");
  const base = Math.floor(cents / n);
  const rest = cents - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i === 0 ? rest : 0)) / 100);
}

/** Échéances mensuelles à partir d'aujourd'hui (la première est due tout de suite). */
export function buildSchedule(total: number, n: number, startYmd: string): NewInstallment[] {
  return splitAmount(total, n).map((amount, i) => ({ seq: i + 1, amount, dueDate: addMonths(startYmd, i) }));
}

const UNPAID = new Set(["scheduled", "failed", "late"]);

/** Échéance non réglée dont la date est passée (au-delà de la tolérance) ou dont le prélèvement a échoué. */
export function isOverdue(i: Pick<Installment, "status" | "dueDate">, today: string): boolean {
  if (!UNPAID.has(i.status)) return false;
  if (i.status === "failed" || i.status === "late") return i.dueDate <= today;
  return i.dueDate < addDaysYmd(today, -LATE_TOLERANCE_DAYS);
}

/** Première échéance à régler (rang le plus bas, ni payée ni annulée). */
export function nextUnpaid<T extends Pick<Installment, "seq" | "status">>(list: T[]): T | null {
  return [...list].sort((a, b) => a.seq - b.seq).find((i) => UNPAID.has(i.status)) ?? null;
}

/** Date de la plus ancienne échéance en retard, ou null. */
export function oldestOverdue(list: Pick<Installment, "status" | "dueDate">[], today: string): string | null {
  const due = list.filter((i) => isOverdue(i, today)).map((i) => i.dueDate).sort();
  return due[0] ?? null;
}

/**
 * Statut d'un échéancier :
 * - pending : rien n'est encore payé (l'adhésion n'est pas ouverte) ;
 * - completed : tout est payé ;
 * - active : à jour ;
 * - late : au moins une échéance en retard, dans le délai de grâce (accès maintenu) ;
 * - suspended : retard au-delà du délai de grâce (accès membre retiré jusqu'à régularisation) ;
 * - cancelled reste cancelled.
 */
export function planStatus(plan: Pick<InstallmentPlan, "status"> & { installments: Pick<Installment, "status" | "dueDate">[] }, today: string, graceDays: number): PlanStatus {
  if (plan.status === "cancelled") return "cancelled";
  const live = plan.installments.filter((i) => i.status !== "cancelled");
  const paid = live.filter((i) => i.status === "paid" || i.status === "refunded").length;
  if (paid === 0) return "pending";
  if (paid === live.length) return "completed";
  const oldest = oldestOverdue(live, today);
  if (!oldest) return "active";
  return daysFrom(oldest, today) > graceDays ? "suspended" : "late";
}

/** Date de fin du délai de grâce (dernier jour d'accès) pour un échéancier en retard. */
export function graceEndsOn(list: Pick<Installment, "status" | "dueDate">[], today: string, graceDays: number): string | null {
  const oldest = oldestOverdue(list, today);
  return oldest ? addDaysYmd(oldest, graceDays) : null;
}

/** Montant restant à payer. */
export function remainingAmount(list: Pick<Installment, "status" | "amount">[]): number {
  return Math.round(list.filter((i) => UNPAID.has(i.status)).reduce((a, i) => a + i.amount * 100, 0)) / 100;
}

/** Faut-il relancer une échéance en retard aujourd'hui ? (au plus une fois tous les `everyDays` jours) */
export function reminderDue(i: Pick<Installment, "status" | "dueDate" | "lastReminderAt">, today: string, everyDays: number): boolean {
  if (!isOverdue(i, today)) return false;
  if (!i.lastReminderAt) return true;
  return daysFrom(i.lastReminderAt.slice(0, 10), today) >= everyDays;
}

/** Relance de renouvellement prévue aujourd'hui (J-30, J-7, J-1 par défaut) : renvoie le nombre de jours, sinon null. */
export function renewalReminderDay(planEndsAt: string | null, today: string, days: number[]): number | null {
  if (!planEndsAt) return null;
  const d = daysFrom(today, planEndsAt);
  return days.includes(d) ? d : null;
}
