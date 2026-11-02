/**
 * Vague 2 · chantier 2b — Contrats : types du module (modèles versionnés, contrats, preuves d'acceptation).
 * Ce fichier n'importe rien : il est aussi lu par les scripts Node (tests, seed SQL).
 */

/** membership : adhésion Membre / Premium ; partner : partenaire (offres) ; pro : carnet d'adresses (abonnement mensuel). */
export type ContractKind = "membership" | "partner" | "pro";

export const CONTRACT_KINDS: readonly ContractKind[] = ["membership", "partner", "pro"];

/** pending : généré, en attente d'acceptation ; accepted : accepté (preuve enregistrée) ; cancelled : annulé / résilié. */
export type ContractStatus = "pending" | "accepted" | "cancelled";

export const CONTRACT_STATUSES: readonly ContractStatus[] = ["pending", "accepted", "cancelled"];

/** D'où vient le contrat : étape « Contrat » d'un parcours, souscription activée (paiements), back-office, données d'exemple. */
export type ContractSource = "checkout" | "subscription" | "admin" | "seed";

export type ContractTemplate = {
  id: string;
  kind: ContractKind;
  version: number;
  title: string;
  /** Texte en Markdown simplifié, avec variables {{…}} et notes internes (lignes « >> »). */
  bodyMd: string;
  /** Date de mise en vigueur (AAAA-MM-JJ). */
  effectiveFrom: string;
  active: boolean;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  activatedAt: string | null;
};

/** Une échéance de l'échéancier. */
export type ScheduleItem = { n: number; dueOn: string; amount: number; label?: string };

export type Contract = {
  id: string;
  /** NC-ADH-2026-7K2Q9M (ADH adhésion, PAR partenaire, PRO carnet). */
  number: string;
  kind: ContractKind;
  templateId: string;
  templateVersion: number;
  /** Signataire (null si le compte a été supprimé : l'identité reste dans `variables`). */
  profileId: string | null;
  organizationId: string | null;
  plan: string;
  amount: number;
  currency: string;
  installments: number;
  schedule: ScheduleItem[];
  startsOn: string;
  endsOn: string | null;
  /** Valeurs des variables au moment de la génération (identité, formule, montants, dates). */
  variables: Record<string, string>;
  /** Texte rendu (variables remplies, notes internes retirées) : c'est lui qui est dans le PDF. */
  bodyMd: string;
  pdfSha256: string;
  /** Chemin dans le bucket privé « contrats » (mode réel), null en démo (PDF régénéré à la volée). */
  pdfPath: string | null;
  status: ContractStatus;
  /** Référence de la souscription (paiement, abonnement) reliée au contrat. */
  subscriptionRef: string | null;
  source: ContractSource;
  createdBy: string | null;
  createdAt: string;
  acceptedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  remindedAt: string | null;
  reminderCount: number;
};

/** Preuve d'acceptation : jamais modifiée ni supprimée après coup. */
export type ContractAcceptance = {
  id: string;
  contractId: string;
  profileId: string | null;
  signerName: string;
  signerEmail: string | null;
  acceptedAt: string;
  ip: string | null;
  userAgent: string | null;
  templateVersion: number;
  pdfSha256: string;
  /** « simple » (case à cocher) aujourd'hui ; « yousign », « docusign »… plus tard. */
  provider: string;
  providerRef: string | null;
  method: string;
  /** Phrase cochée par la signataire. */
  statement: string;
};

export type ContractView = Contract & {
  acceptance: ContractAcceptance | null;
  signerName: string;
  organizationName: string | null;
  templateTitle: string;
};

export type ContractFilters = {
  kind?: ContractKind;
  status?: ContractStatus;
  /** Période de génération (AAAA-MM-JJ inclus). */
  from?: string;
  to?: string;
  profileId?: string;
  organizationId?: string;
};

export type NewContractRow = Omit<Contract, "id" | "createdAt" | "acceptedAt" | "cancelledAt" | "cancelReason" | "remindedAt" | "reminderCount" | "status"> & {
  id?: string;
  createdAt?: string;
};

export type NewTemplateInput = {
  kind: ContractKind;
  title: string;
  bodyMd: string;
  effectiveFrom: string;
  notes: string | null;
};

export type AcceptInput = {
  contractId: string;
  profileId: string;
  pdfSha256: string;
  ip: string | null;
  userAgent: string | null;
  statement: string;
  provider: string;
  providerRef: string | null;
};

/** Actions du journal propres au module. */
export type ContratsAuditAction =
  | "contract.generate"
  | "contract.accept"
  | "contract.remind"
  | "contract.cancel"
  | "contract.link"
  | "contract_template.create"
  | "contract_template.activate";

export type ContratsAuditTarget = "contract" | "contract_template";

export type ContratsNotificationType = "contract_ready" | "contract_accepted";
