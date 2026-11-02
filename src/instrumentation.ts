/**
 * Démarrage du serveur Next.js : branche les abonnés des points d'extension (vague 2).
 * --- Vague 2 · Contrats --- génération du contrat quand une souscription devient active.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/modules/contrats/register");
  }
}
