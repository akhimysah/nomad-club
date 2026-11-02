/**
 * Rassemble les libellés du journal déclarés par chaque lot.
 * À importer (effet de bord) partout où le journal est affiché ou exporté.
 */
import { registerAuditLabels } from "./audit-view";
import { PARTENAIRES_AUDIT_LABEL } from "../partenaires/domain"; // --- Lot 3 ---
import { ENGAGEMENT_AUDIT_LABEL } from "../engagement/labels"; // --- Lot 4 ---
import { CRM_AUDIT_LABEL } from "../crm/types"; // --- Lot 5 ---

registerAuditLabels({ ...PARTENAIRES_AUDIT_LABEL, ...ENGAGEMENT_AUDIT_LABEL, ...CRM_AUDIT_LABEL });
