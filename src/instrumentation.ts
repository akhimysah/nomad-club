/**
 * Démarrage du serveur Next.js (exécuté une fois) : branche les abonnés des points d'extension (vague 2).
 * --- E-mails --- enregistre l'expéditeur (Resend, ou console sans clé) sur `src/lib/mail-hook.ts`.
 * --- Vague 2 · Contrats --- génération du contrat quand une souscription devient active.
 * --- Lancement --- les erreurs serveur partent vers Sentry si SENTRY_DSN est défini (onRequestError).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { registerEmails } = await import("./lib/modules/emails/register");
  registerEmails();
  await import("./lib/modules/contrats/register");
}

export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string; renderSource?: string },
) {
  if (!process.env.SENTRY_DSN) return;
  const { reportError } = await import("./lib/modules/lancement/monitoring");
  const digest = typeof error === "object" && error && "digest" in error ? String((error as { digest?: unknown }).digest ?? "") : undefined;
  await reportError(error, { path: context.routePath || request.path, method: request.method, digest, source: process.env.NEXT_RUNTIME === "edge" ? "edge" : "server", routeType: context.routeType });
}
