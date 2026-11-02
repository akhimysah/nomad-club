/**
 * Modèles d'e-mails utilisés par le module paiements via `sendEmail()` (src/lib/mail-hook.ts).
 * Identifiants et données alignés sur le chantier e-mails (docs/emails.md, templates.ts) : les montants et
 * les dates sont passés DÉJÀ MIS EN FORME (chaînes).
 *
 * - payment_receipt : { firstName, amount, label, method, paidAt, reference, installment, link }
 * - payment_failed  : { firstName, amount, label, dueDate, reason, payUrl }  (carte refusée, relance d'échéance, pro)
 * - renewal_reminder : { firstName, planLabel, endsOn, daysLeft, amount, renewUrl }  (J-30, J-7, J-1)
 *
 * Les autres événements (accès suspendu / rétabli, remboursement, fiche pro suspendue) passent par une
 * notification (`notify()`), que le chantier e-mails relaie par e-mail (modèle générique « notification »).
 */
export const PAYMENT_EMAILS = {
  receipt: "payment_receipt",
  failed: "payment_failed",
  renewal: "renewal_reminder",
} as const;

export type PaymentEmailTemplate = (typeof PAYMENT_EMAILS)[keyof typeof PAYMENT_EMAILS];

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** AAAA-MM-JJ (ou ISO) → « 2 novembre 2026 ». */
export function longDate(ymd: string): string {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  return `${d === 1 ? "1er" : d} ${MONTHS[m - 1]} ${y}`;
}

export const METHOD_LABEL: Record<string, string> = { stripe: "Carte bancaire", simulated: "Carte (paiement simulé)", transfer: "Virement", cmi: "Carte bancaire" };
