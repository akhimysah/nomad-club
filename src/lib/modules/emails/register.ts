/**
 * Branche le module e-mails sur le point d'extension `src/lib/mail-hook.ts`.
 * Appelé par `src/instrumentation.ts` au démarrage du serveur (Node) et, à défaut, au premier `sendEmail`.
 */
import { registerMailer } from "../../mail-hook";
import { sendTemplate } from "./service";

let done = false;

export function registerEmails(): void {
  if (done) return;
  done = true;
  registerMailer(async (message) => (await sendTemplate(message)).ok);
}
