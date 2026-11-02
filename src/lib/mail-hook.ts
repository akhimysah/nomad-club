/**
 * Point d'extension pour l'envoi d'e-mails (vague 2).
 * Le chantier e-mails enregistre son expéditeur avec `registerMailer` (au démarrage du serveur : `src/instrumentation.ts`,
 * et à la demande au premier envoi). Les autres modules appellent `sendEmail` librement ; il renvoie `false`
 * si l'envoi échoue (jamais d'exception).
 *
 * Modèles disponibles et données attendues : `src/lib/modules/emails/templates.ts` et docs/emails.md.
 */
export type EmailAttachment = {
  filename: string;
  /** Contenu binaire, ou texte (UTF-8 par défaut, base64 si `encoding: "base64"`). */
  content: Uint8Array | string;
  contentType?: string;
  encoding?: "utf8" | "base64";
  /** Image intégrée référencée dans le HTML par `cid:<contentId>`. */
  contentId?: string;
};

export type EmailMessage = {
  /** Identifiant du modèle (ex. "booking_confirmed", "contract_accepted"). */
  template: string;
  to: string;
  /** Données injectées dans le modèle. */
  data: Record<string, unknown>;
  attachments?: EmailAttachment[];
  /** Compte destinataire (journal, lien de désinscription). */
  profileId?: string | null;
  /** Évite un double envoi si l'appel est rejoué (ex. webhook). */
  idempotencyKey?: string;
};

type Mailer = (message: EmailMessage) => Promise<boolean>;

// Rangé sur globalThis : l'instrumentation et les routes peuvent être des instances de module distinctes.
const KEY = Symbol.for("nomad-club.mail-hook");
type Slot = { mailer: Mailer | null };
const slot = (): Slot => {
  const g = globalThis as unknown as Record<symbol, Slot | undefined>;
  return (g[KEY] ??= { mailer: null });
};

export function registerMailer(fn: Mailer): void {
  slot().mailer = fn;
}

export async function sendEmail(message: EmailMessage): Promise<boolean> {
  try {
    // --- E-mails --- branchement à la demande si l'instrumentation n'a pas tourné (build, tests, autre runtime)
    if (!slot().mailer) (await import("./modules/emails/register")).registerEmails();
    const mailer = slot().mailer;
    if (!mailer) return false;
    return await mailer(message);
  } catch (err) {
    console.error("[mail] envoi impossible", message.template, err);
    return false;
  }
}
