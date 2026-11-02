/**
 * Point d'extension pour l'envoi d'e-mails (vague 2).
 * Le chantier e-mails enregistre son expéditeur avec `registerMailer` ; tant qu'il ne l'a pas fait,
 * `sendEmail` ne fait rien et renvoie `false`. Les autres modules appellent `sendEmail` librement.
 */
export type EmailAttachment = { filename: string; content: Uint8Array | string; contentType?: string };

export type EmailMessage = {
  /** Identifiant du modèle (ex. "booking_confirmed", "contract_accepted"). */
  template: string;
  to: string;
  /** Données injectées dans le modèle. */
  data: Record<string, unknown>;
  attachments?: EmailAttachment[];
};

type Mailer = (message: EmailMessage) => Promise<boolean>;

let mailer: Mailer | null = null;

export function registerMailer(fn: Mailer): void {
  mailer = fn;
}

export async function sendEmail(message: EmailMessage): Promise<boolean> {
  if (!mailer) return false;
  try {
    return await mailer(message);
  } catch (err) {
    console.error("[mail] envoi impossible", message.template, err);
    return false;
  }
}
