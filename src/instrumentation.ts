/**
 * Instrumentation Next.js : exécutée une fois au démarrage du serveur.
 * --- E-mails --- enregistre l'expéditeur (Resend, ou console sans clé) sur `src/lib/mail-hook.ts`.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { registerEmails } = await import("./lib/modules/emails/register");
  registerEmails();
}
