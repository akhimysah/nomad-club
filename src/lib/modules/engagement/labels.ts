/** Libellés du Lot 4 fusionnés dans les tables partagées (notifications, journal). Module pur. */
import type { IconName } from "@/components/IconSprite";
import type { EngagementAuditAction, EngagementNotificationType } from "./types";

export const ENGAGEMENT_NOTIFICATION_LABEL: Record<EngagementNotificationType, { label: string; hint: string }> = {
  purchase_completed: { label: "Achats", hint: "Ta ressource est disponible dans « Mes ressources »." },
  referral_signup: { label: "Parrainage", hint: "Une amie s’inscrit avec ton code." },
  referral_rewarded: { label: "Récompenses", hint: "Ta filleule devient membre : ta récompense est attribuée." },
  deal_declared: { label: "Deals à confirmer", hint: "Une membre déclare un deal avec toi." },
  deal_answered: { label: "Deals confirmés", hint: "Ton deal est confirmé (ou refusé) par l’autre membre." },
};

export const ENGAGEMENT_NOTIFICATION_ICON: Record<EngagementNotificationType, IconName> = {
  purchase_completed: "book",
  referral_signup: "users",
  referral_rewarded: "gift",
  deal_declared: "swap",
  deal_answered: "star",
};

export const ENGAGEMENT_AUDIT_LABEL: Record<EngagementAuditAction, string> = {
  "product.create": "Ressource créée",
  "product.update": "Ressource modifiée",
  "product.publish": "Ressource publiée",
  "referral.reward_config": "Récompense de parrainage",
  "referral.reward_deliver": "Récompense remise",
  "deal.settings": "Barème Business",
  "deal.admin_update": "Deal corrigé",
};
