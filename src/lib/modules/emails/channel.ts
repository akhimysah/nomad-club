/**
 * Règles du canal e-mail des notifications (module pur, testé sans serveur).
 *
 * - Chaque type de notification est relayé par un modèle dédié, sinon par le modèle générique « notification ».
 * - Essentiels (billet, reçu, sécurité des accès) : partent toujours, quelle que soit la préférence.
 * - Les autres respectent la préférence « e-mail » du type (absente = active, comme dans l'écran des préférences).
 */
import type { TemplateId } from "./types.ts";

export const NOTIFICATION_TEMPLATE: Record<string, TemplateId> = {
  booking_confirmed: "booking_confirmed",
  waitlist_spot: "waitlist_released",
  event_published: "event_published",
  payment_validated: "payment_receipt",
  event_reminder: "event_reminder",
  news_published: "news_published",
  group_joined: "group_joined",
  moderation_warning: "moderation_warning",
};

/** Types de notifications dont l'e-mail part toujours (billet, reçu, sécurité). */
export const ESSENTIAL_NOTIFICATION_TYPES: readonly string[] = ["booking_confirmed", "payment_validated", "role_changed"];

/**
 * Types dont le module d'origine envoie déjà son propre e-mail détaillé (avec pièces jointes ou données riches) :
 * on ne les relaie pas, sinon la personne recevrait deux e-mails.
 */
export const SENT_BY_MODULE_NOTIFICATION_TYPES: readonly string[] = [
  // --- Vague 2 · paiements ---
  "payment_receipt",
  "payment_failed",
  "payment_reminder",
  "membership_renewal",
  // --- Vague 2 · Contrats ---
  "contract_ready",
  "contract_accepted",
];

export type ChannelRow = { recipientId: string; type: string; title: string; body: string; link: string | null };
export type ChannelPref = { profileId: string; type: string; email: boolean };
export type ChannelRecipient = { email: string | null; firstName: string };

export type PlannedEmail = {
  template: TemplateId;
  to: string;
  profileId: string;
  notificationType: string;
  essential: boolean;
  data: Record<string, unknown>;
};

export function templateForNotification(type: string): TemplateId {
  return NOTIFICATION_TEMPLATE[type] ?? "notification";
}

export function isEssentialNotification(type: string): boolean {
  return ESSENTIAL_NOTIFICATION_TYPES.includes(type);
}

/** La préférence « e-mail » de ce type est-elle active pour cette personne ? (absente = oui) */
export function emailPrefEnabled(prefs: readonly ChannelPref[], profileId: string, type: string): boolean {
  const p = prefs.find((x) => x.profileId === profileId && x.type === type);
  return p ? p.email : true;
}

/**
 * Liste des e-mails à envoyer pour ces notifications.
 * `extras[i]` : données riches facultatives de la ligne i (billet, date mise en forme…), fusionnées dans les données du modèle.
 */
export function planNotificationEmails(
  rows: readonly ChannelRow[],
  ctx: { prefs: readonly ChannelPref[]; recipients: ReadonlyMap<string, ChannelRecipient>; extras?: ReadonlyArray<Record<string, unknown> | undefined> },
): PlannedEmail[] {
  const out: PlannedEmail[] = [];
  rows.forEach((row, i) => {
    if (SENT_BY_MODULE_NOTIFICATION_TYPES.includes(row.type)) return;
    const who = ctx.recipients.get(row.recipientId);
    if (!who?.email) return;
    const essential = isEssentialNotification(row.type);
    if (!essential && !emailPrefEnabled(ctx.prefs, row.recipientId, row.type)) return;
    const template = templateForNotification(row.type);
    out.push({
      template,
      to: who.email,
      profileId: row.recipientId,
      notificationType: row.type,
      essential,
      data: { firstName: who.firstName, title: row.title, body: row.body, link: row.link ?? "", notificationType: row.type, ...(ctx.extras?.[i] ?? {}) },
    });
  });
  return out;
}
