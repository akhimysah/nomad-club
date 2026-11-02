/** Libellés du module paiements fusionnés dans les tables partagées (notifications, journal, statuts). Module pur. */
import type { IconName } from "@/components/IconSprite";
import type { InstallmentStatus, PaiementsAuditAction, PaiementsNotificationType, PlanStatus, TransactionKind } from "./types";

export const PAIEMENTS_NOTIFICATION_LABEL: Record<PaiementsNotificationType, { label: string; hint: string }> = {
  payment_receipt: { label: "Reçus de paiement", hint: "Chaque paiement reçu (adhésion, échéance, billet, boutique, abonnement)." },
  payment_failed: { label: "Paiements refusés", hint: "Un prélèvement n’est pas passé : mets ta carte à jour." },
  payment_reminder: { label: "Échéances en retard", hint: "Relance tant qu’une échéance reste impayée." },
  membership_suspended: { label: "Accès suspendu", hint: "Ton accès est suspendu après le délai de grâce." },
  membership_renewal: { label: "Renouvellement", hint: "Rappel un mois, une semaine et la veille de la fin de ton adhésion." },
  refund_issued: { label: "Remboursements", hint: "Un remboursement est effectué sur ta carte." },
};

export const PAIEMENTS_NOTIFICATION_ICON: Record<PaiementsNotificationType, IconName> = {
  payment_receipt: "wallet",
  payment_failed: "card",
  payment_reminder: "bell",
  membership_suspended: "lock",
  membership_renewal: "refresh",
  refund_issued: "swap",
};

export const PAIEMENTS_AUDIT_LABEL: Record<PaiementsAuditAction, string> = {
  "payment.refund": "Remboursement",
  "payment.event_replay": "Événement de paiement rejoué",
  "membership.suspend": "Accès membre suspendu (impayé)",
  "membership.reinstate": "Accès membre rétabli",
  "payment.portal": "Portail de paiement ouvert",
};

export const PLAN_STATUS_LABEL: Record<PlanStatus, { label: string; cls: string }> = {
  pending: { label: "En attente du 1er paiement", cls: "chip" },
  active: { label: "À jour", cls: "chip solid" },
  late: { label: "En retard", cls: "chip rose" },
  suspended: { label: "Suspendu", cls: "chip rose" },
  completed: { label: "Soldé", cls: "chip gold" },
  cancelled: { label: "Annulé", cls: "chip" },
};

export const INSTALLMENT_STATUS_LABEL: Record<InstallmentStatus | "overdue", string> = {
  scheduled: "À venir",
  paid: "Payée",
  failed: "Refusée",
  late: "En retard",
  overdue: "En retard",
  cancelled: "Annulée",
  refunded: "Remboursée",
};

export const TRANSACTION_KIND_LABEL: Record<TransactionKind, string> = {
  membership: "Adhésions",
  installment: "Échéances d’adhésion",
  booking: "Billets",
  pro_subscription: "Carnet pro",
  shop: "Boutique",
};
