/**
 * Vague 2 · Contrats — accès aux données du module (modèles versionnés, contrats, preuves d'acceptation).
 * Branché dans l'interface Repo (src/lib/data/repo.ts : `extends ContratsRepo`), implémenté par
 * ./demo-repo.ts (mémoire) et ./supabase-repo.ts (Postgres, RLS de 0010_contrats.sql).
 */
import type { AuditInput } from "../../data/repo";
import type {
  AcceptInput,
  Contract,
  ContractAcceptance,
  ContractFilters,
  ContractKind,
  ContractTemplate,
  ContractView,
  NewContractRow,
  NewTemplateInput,
} from "./types";

export type ContractPdfDelivery = { kind: "url"; url: string } | { kind: "regenerate" };

export interface ContratsRepo {
  /* modèles */
  listContractTemplates(kind?: ContractKind): Promise<ContractTemplate[]>;
  getContractTemplate(id: string): Promise<ContractTemplate | null>;
  getActiveContractTemplate(kind: ContractKind): Promise<ContractTemplate | null>;
  /** Nouvelle version (inactive) : numéro = dernière version du type + 1. */
  createContractTemplate(input: NewTemplateInput, actorId: string): Promise<ContractTemplate>;
  /** Active une version (et désactive les autres du même type). */
  activateContractTemplate(id: string, actorId: string): Promise<ContractTemplate | null>;

  /* contrats */
  /** Back-office (administratrices). */
  listContracts(filters?: ContractFilters): Promise<ContractView[]>;
  /** Contrats de la personne : ceux qu'elle signe et ceux des établissements dont elle est propriétaire. */
  listMyContracts(profileId: string): Promise<ContractView[]>;
  getContract(id: string): Promise<ContractView | null>;
  /** Contrat récent non annulé pour cette souscription (évite d'en générer deux). */
  findOpenContract(q: { profileId: string; kind: ContractKind; plan: string; organizationId: string | null; sinceIso: string }): Promise<Contract | null>;
  /** Enregistre un contrat généré (clé service en mode réel : la personne ne peut pas écrire elle-même un contrat). */
  insertContract(row: NewContractRow): Promise<Contract>;
  /** Enregistre la preuve d'acceptation (une seule fois, jamais modifiée) et passe le contrat en « accepté ». */
  acceptContract(input: AcceptInput): Promise<ContractAcceptance>;
  linkContractSubscription(contractId: string, reference: string): Promise<void>;
  cancelContract(contractId: string, reason: string): Promise<void>;
  markContractReminded(contractId: string): Promise<void>;
  /** Mode réel : dépose le PDF dans le bucket privé « contrats » (renvoie le chemin, ou null s'il est indisponible). */
  storeContractPdf(contract: Contract, pdf: Uint8Array): Promise<string | null>;
  /** URL signée de courte durée (mode réel) ou régénération à la volée (démo, ou fichier absent). */
  contractPdfDelivery(contract: Contract): Promise<ContractPdfDelivery>;
  /** Journal du module (clé service en mode réel : aussi depuis un webhook de paiement, sans session). */
  logContractAudit(entry: AuditInput): Promise<void>;
}
