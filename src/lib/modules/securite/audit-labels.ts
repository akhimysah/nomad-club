/**
 * Rassemble les libellés du journal déclarés par chaque lot.
 * À importer (effet de bord) partout où le journal est affiché ou exporté.
 */
import { registerAuditLabels } from "./audit-view";
import { PARTENAIRES_AUDIT_LABEL } from "../partenaires/domain"; // --- Lot 3 ---
import { ENGAGEMENT_AUDIT_LABEL } from "../engagement/labels"; // --- Lot 4 ---
import { CRM_AUDIT_LABEL } from "../crm/types"; // --- Lot 5 ---
import { CONTRATS_AUDIT_LABEL } from "../contrats/labels"; // --- Vague 2 · Contrats ---

// --- Lot 1 ---
const COMMUNAUTE_AUDIT_LABEL: Record<string, string> = {
  "news.create": "Publication créée",
  "news.update": "Publication modifiée",
  "news.publish": "Publication publiée",
  "news.delete": "Publication supprimée",
  "group.create": "Groupe créé",
  "group.update": "Groupe modifié",
  "group.decide": "Demande de groupe",
  "moderation.hide": "Message masqué",
  "moderation.restore": "Message rétabli",
  "moderation.warn": "Avertissement",
  "moderation.dismiss": "Signalement classé",
  "keyword.add": "Mot-clé ajouté",
  "keyword.remove": "Mot-clé retiré",
  "event.remind": "Rappels J-1",
};

registerAuditLabels({ ...COMMUNAUTE_AUDIT_LABEL, ...PARTENAIRES_AUDIT_LABEL, ...ENGAGEMENT_AUDIT_LABEL, ...CRM_AUDIT_LABEL, ...CONTRATS_AUDIT_LABEL });
