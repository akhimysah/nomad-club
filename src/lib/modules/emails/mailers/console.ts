/**
 * Fournisseur « console » : mode démo ou absence de RESEND_API_KEY. N'envoie rien : journalise une ligne
 * et garde les derniers e-mails en mémoire (consultables dans /fondatrices/emails).
 */
import type { Mailer, OutgoingEmail, SendResult } from "../types.ts";

export type ConsoleOutboxItem = { id: string; at: string; email: OutgoingEmail };

const KEY = Symbol.for("nomad-club.emails.console-outbox");
const MAX = 50;

function outbox(): ConsoleOutboxItem[] {
  const g = globalThis as unknown as Record<symbol, ConsoleOutboxItem[] | undefined>;
  return (g[KEY] ??= []);
}

/** Derniers e-mails « envoyés » par le fournisseur console (le plus récent d'abord). */
export function consoleOutbox(): ConsoleOutboxItem[] {
  return [...outbox()].reverse();
}

export function clearConsoleOutbox(): void {
  outbox().length = 0;
}

export function createConsoleMailer(opts: { quiet?: boolean } = {}): Mailer {
  let seq = 0;
  return {
    name: "console",
    async send(email: OutgoingEmail): Promise<SendResult> {
      const id = `console-${Date.now().toString(36)}-${(++seq).toString(36)}`;
      const box = outbox();
      box.push({ id, at: new Date().toISOString(), email });
      if (box.length > MAX) box.splice(0, box.length - MAX);
      if (!opts.quiet) {
        const files = email.attachments?.length ? ` · ${email.attachments.length} pièce(s) jointe(s)` : "";
        console.info(`[e-mail console] à ${email.to} · « ${email.subject} »${files}`);
      }
      return { ok: true, id };
    },
  };
}
