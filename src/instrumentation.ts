/**
 * Vague 2 — Lancement : crochets d'instrumentation Next.js.
 * Les erreurs serveur (pages, actions, routes) partent vers Sentry si SENTRY_DSN est défini ;
 * sinon rien n'est envoyé (elles restent dans les journaux de l'hébergeur).
 */
export function register() {
  /* rien à initialiser : la surveillance n'utilise pas de SDK */
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
