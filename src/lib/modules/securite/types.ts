/** Lot 6 — types du module sécurité et conformité. */

/** Opérations ajoutées au journal par le Lot 6. */
export type SecuriteAuditAction =
  | "data.export"
  | "consent.update"
  | "account.delete_request"
  | "account.delete_cancel"
  | "account.anonymize"
  | "account.delete_reject"
  | "auth.login"
  | "auth.admin_login"
  | "auth.mfa_enroll"
  | "auth.mfa_verify"
  | "auth.signout_all"
  | "audit.export"
  | "security.settings"
  | "push.subscribe";

export const CONSENT_KINDS = ["geolocation", "communications", "directory", "image"] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];

/** Un choix horodaté (historique jamais modifié). */
export type ConsentRecord = {
  id: string;
  profileId: string;
  kind: ConsentKind;
  granted: boolean;
  source: string;
  createdAt: string;
};

/** État courant d'un consentement (dernier choix, ou valeur par défaut). */
export type ConsentState = { kind: ConsentKind; granted: boolean; at: string | null; isDefault: boolean };

export type DeletionStatus = "pending" | "cancelled" | "done" | "rejected";

export type DeletionRequest = {
  id: string;
  profileId: string;
  reason: string | null;
  status: DeletionStatus;
  requestedAt: string;
  scheduledFor: string;
  processedAt: string | null;
  processedBy: string | null;
  adminNote: string | null;
};

export type PushSubscriptionInput = { endpoint: string; p256dh: string; auth: string; userAgent: string | null };
export type StoredPushSubscription = PushSubscriptionInput & { id: string; profileId: string; createdAt: string };

/** Session (appareil connecté) de la personne, lue dans auth.sessions en mode réel. */
export type AccountSession = { id: string; createdAt: string; updatedAt: string | null; userAgent: string | null; ip: string | null; aal: string | null };

/** Filtres du journal des opérations. */
export type AuditFilters = {
  actorId?: string;
  /** Préfixe ou action exacte (« role » ou « role.grant »). */
  action?: string;
  fromYmd?: string;
  toYmd?: string;
  q?: string;
  limit?: number;
};

export type SecuritySettings = { adminMfaEnforced: boolean };
