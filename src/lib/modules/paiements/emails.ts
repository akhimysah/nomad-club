/**
 * Identifiants des modèles d'e-mails envoyés par le module paiements via `sendEmail()` (src/lib/mail-hook.ts).
 * Le chantier e-mails écrit les modèles correspondants ; la liste et les données de chaque modèle sont
 * documentées dans docs/ARCHITECTURE.md (section « Paiements »).
 */
export const PAYMENT_EMAILS = {
  /** Reçu d'un paiement (adhésion, échéance, billet, boutique, carnet pro). */
  receipt: "payment_receipt",
  /** Prélèvement refusé (carte en échec). */
  failed: "payment_failed",
  /** Relance d'une échéance en retard (tous les PAYMENT_REMINDER_EVERY_DAYS jours). */
  reminder: "payment_reminder",
  /** Accès membre suspendu après le délai de grâce. */
  suspended: "membership_suspended",
  /** Accès rétabli après régularisation. */
  reinstated: "membership_reinstated",
  /** Rappel de renouvellement de l'adhésion (J-30, J-7, J-1). */
  renewal: "membership_renewal_reminder",
  /** Abonnement du carnet pro : prélèvement refusé. */
  proFailed: "pro_payment_failed",
  /** Abonnement du carnet pro suspendu (fiche masquée). */
  proSuspended: "pro_subscription_suspended",
  /** Remboursement effectué. */
  refunded: "payment_refunded",
} as const;

export type PaymentEmailTemplate = (typeof PAYMENT_EMAILS)[keyof typeof PAYMENT_EMAILS];
