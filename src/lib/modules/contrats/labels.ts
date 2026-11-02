/**
 * Vague 2 · Contrats — libellés (types, statuts, journal, notifications) fusionnés dans les tables partagées.
 */
import type { ContractKind, ContractStatus, ContratsAuditAction, ContratsNotificationType } from "./types";

export const KIND_LABEL: Record<ContractKind, string> = { membership: "Adhésion", partner: "Partenaire", pro: "Carnet pro" };
export const KIND_LONG: Record<ContractKind, string> = {
  membership: "Contrat d’adhésion (Membre / Premium)",
  partner: "Contrat de partenariat (offres aux membres)",
  pro: "Contrat de référencement (carnet, abonnement mensuel)",
};

export const STATUS_LABEL: Record<ContractStatus, { label: string; cls: string }> = {
  pending: { label: "À accepter", cls: "chip gold" },
  accepted: { label: "Accepté", cls: "chip solid" },
  cancelled: { label: "Annulé", cls: "chip rose" },
};

export const CONTRATS_AUDIT_LABEL: Record<ContratsAuditAction, string> = {
  "contract.generate": "Contrat généré",
  "contract.accept": "Contrat accepté",
  "contract.remind": "Relance de contrat",
  "contract.cancel": "Contrat annulé",
  "contract.link": "Contrat relié à une souscription",
  "contract_template.create": "Nouvelle version de modèle",
  "contract_template.activate": "Modèle de contrat activé",
};

export const CONTRATS_NOTIFICATION_LABEL: Record<ContratsNotificationType, { label: string; hint: string }> = {
  contract_ready: { label: "Contrats à accepter", hint: "Un contrat t’attend : à lire et accepter en ligne." },
  contract_accepted: { label: "Contrats acceptés", hint: "Confirmation et copie PDF de ton contrat." },
};

export const CONTRATS_NOTIFICATION_ICON = { contract_ready: "edit", contract_accepted: "check" } as const satisfies Record<ContratsNotificationType, string>;

/** Où la personne retrouve ses contrats, selon le type. */
export const CONTRACTS_HOME: Record<ContractKind, string> = { membership: "/espace/moi/contrats", partner: "/partenaire/contrats", pro: "/pro/contrats" };
