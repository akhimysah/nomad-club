/**
 * E-mails transactionnels (vague 2) : types partagés du module.
 * Module pur (aucun import d'exécution) : importable par les tests Node (`npm run test:emails`).
 */

/** Identifiants des modèles d'e-mail (repris par `sendEmail({ template })`). */
export const TEMPLATE_IDS = [
  "welcome",
  "booking_confirmed",
  "waitlist_released",
  "event_reminder",
  "event_published",
  "payment_receipt",
  "payment_failed",
  "renewal_reminder",
  "contract_accepted",
  "contract_ready",
  "contract_reminder",
  "team_invite",
  "group_joined",
  "moderation_warning",
  "data_export_ready",
  "account_deletion_scheduled",
  "account_deleted",
  "news_published",
  "notification",
] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];

export function isTemplateId(v: unknown): v is TemplateId {
  return typeof v === "string" && (TEMPLATE_IDS as readonly string[]).includes(v);
}

/** Pièce jointe prête à l'envoi (contenu en base64). `contentId` : image intégrée (`<img src="cid:…">`). */
export type OutgoingAttachment = { filename: string; contentBase64: string; contentType: string; contentId?: string };

/** E-mail entièrement rendu, transmis au fournisseur. */
export type OutgoingEmail = {
  from: string;
  to: string;
  replyTo?: string | null;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  attachments?: OutgoingAttachment[];
  /** Étiquettes (Resend : `tags`) pour retrouver un envoi chez le fournisseur. */
  tags?: Record<string, string>;
  /** Évite un double envoi si la requête est rejouée (Resend : en-tête Idempotency-Key). */
  idempotencyKey?: string;
};

export type SendResult = { ok: true; id: string | null } | { ok: false; error: string };

export type MailerName = "resend" | "console" | "smtp";

/** Fournisseur d'envoi. Une implémentation ne lève jamais d'erreur : elle renvoie `{ ok: false, error }`. */
export interface Mailer {
  readonly name: MailerName;
  send(email: OutgoingEmail): Promise<SendResult>;
  /** Envoi groupé (sans pièces jointes), un résultat par e-mail dans le même ordre. Facultatif. */
  sendBatch?(emails: OutgoingEmail[]): Promise<SendResult[]>;
}

export type EmailStatus = "sent" | "failed";

/** Ligne du journal des envois (table `email_log` en mode réel, mémoire en démo). */
export type EmailLogEntry = {
  id: string;
  profileId: string | null;
  toEmail: string;
  template: TemplateId | string;
  subject: string;
  status: EmailStatus;
  provider: MailerName | string;
  providerId: string | null;
  error: string | null;
  /** Données du modèle (pour « Renvoyer »). Vide pour les e-mails dont on ne garde pas le contenu. */
  data: Record<string, unknown>;
  /** Noms des pièces jointes envoyées. */
  attachments: string[];
  resentFrom: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type EmailLogInput = Omit<EmailLogEntry, "id" | "createdAt">;

export type EmailLogFilters = { template?: string; status?: EmailStatus; q?: string; limit?: number };

export type EmailsAuditAction = "email.resend";
