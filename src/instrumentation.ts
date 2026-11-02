/**
 * Démarrage du serveur Next.js (exécuté une fois) : branche les abonnés des points d'extension (vague 2).
 * --- E-mails --- enregistre l'expéditeur (Resend, ou console sans clé) sur `src/lib/mail-hook.ts`.
 * --- Vague 2 · Contrats --- génération du contrat quand une souscription devient active.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { registerEmails } = await import("./lib/modules/emails/register");
  registerEmails();
  await import("./lib/modules/contrats/register");
}
