/**
 * Lot 6 — accès aux données du module sécurité (consentements, suppression de compte, push, journal filtré).
 * Branché dans l'interface Repo (src/lib/data/repo.ts : `extends SecuriteRepo`), implémenté par
 * ./demo-repo.ts (mémoire) et ./supabase-repo.ts (Postgres, RLS de 0008_securite.sql).
 */
import type { AuditEntry } from "../../types";
import type {
  AccountSession,
  AuditFilters,
  ConsentKind,
  ConsentRecord,
  DeletionRequest,
  PushSubscriptionInput,
  SecuritySettings,
  StoredPushSubscription,
} from "./types";

/** Données complémentaires de l'export RGPD (le reste vient des méthodes existantes du Repo). */
export type PersonalDataExtras = {
  memberships: Array<Record<string, unknown>>;
  authoredMessages: Array<{ id: string; channel: string; body: string; createdAt: string }>;
  auditAboutMe: AuditEntry[];
  pushSubscriptions: number;
};

export interface SecuriteRepo {
  /* consentements */
  listConsents(profileId: string): Promise<ConsentRecord[]>;
  recordConsent(profileId: string, kind: ConsentKind, granted: boolean, source: string): Promise<ConsentRecord>;

  /* suppression de compte */
  getOpenDeletionRequest(profileId: string): Promise<DeletionRequest | null>;
  listMyDeletionRequests(profileId: string): Promise<DeletionRequest[]>;
  requestAccountDeletion(profileId: string, reason: string | null): Promise<DeletionRequest>;
  cancelAccountDeletion(profileId: string): Promise<boolean>;
  /** File des administratrices (toutes les demandes, les plus récentes d'abord). */
  listDeletionRequests(): Promise<DeletionRequest[]>;
  /** Anonymise le compte (administratrice) et clôt la demande. */
  anonymizeAccount(profileId: string, requestId: string | null, actorId: string): Promise<void>;
  rejectDeletionRequest(requestId: string, actorId: string, note: string): Promise<DeletionRequest | null>;

  /* export RGPD */
  personalDataExtras(profileId: string): Promise<PersonalDataExtras>;

  /* notifications push */
  savePushSubscription(profileId: string, sub: PushSubscriptionInput): Promise<void>;
  deletePushSubscription(profileId: string, endpoint: string): Promise<void>;
  countPushSubscriptions(profileId: string): Promise<number>;
  /** Abonnements des destinataires (envoi : clé service en mode réel). */
  listPushSubscriptionsFor(profileIds: string[]): Promise<StoredPushSubscription[]>;
  removePushSubscriptionById(id: string): Promise<void>;

  /* journal filtré */
  searchAudit(filters: AuditFilters): Promise<AuditEntry[]>;
  getAuditEntry(id: string): Promise<AuditEntry | null>;

  /* comptes */
  listMySessions(profileId: string): Promise<AccountSession[]>;
  getSecuritySettings(): Promise<SecuritySettings>;
  setSecuritySettings(s: SecuritySettings, actorId: string): Promise<void>;
}
