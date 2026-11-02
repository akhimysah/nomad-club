/**
 * Vague 2 — Surveillance des erreurs, optionnelle : Sentry via son API HTTP « envelope » (sans SDK, donc
 * sans JavaScript ajouté aux pages). Désactivée tant que SENTRY_DSN n'est pas défini.
 * Aucune donnée personnelle n'est envoyée : ni cookies, ni en-têtes, ni corps de requête, ni adresse IP.
 */

type Dsn = { endpoint: string; key: string; dsn: string };

export function parseDsn(dsn: string | undefined | null): Dsn | null {
  if (!dsn) return null;
  const m = dsn.trim().match(/^(https):\/\/([^@\s]+)@([^/\s]+)\/(\d+)$/);
  if (!m) return null;
  return { endpoint: `${m[1]}://${m[3]}/api/${m[4]}/envelope/`, key: m[2], dsn: dsn.trim() };
}

export function monitoringEnabled(): boolean {
  return parseDsn(process.env.SENTRY_DSN) !== null;
}

/** Retire ce qui ressemble à une adresse e-mail, un jeton ou un numéro de téléphone. */
export function scrub(s: string): string {
  return s
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[e-mail]")
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jeton]")
    .replace(/\b[0-9a-f]{40,}\b/gi, "[jeton]")
    .replace(/\+?\d[\d .-]{7,}\d/g, "[numéro]");
}

function frames(stack: string | undefined) {
  if (!stack) return undefined;
  const out = stack
    .split("\n")
    .slice(1, 30)
    .map((l) => l.trim().match(/^at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ function: m[1] ?? "?", filename: m[2], lineno: Number(m[3]), colno: Number(m[4]), in_app: !m[2].includes("node_modules") }))
    .reverse();
  return out.length ? { frames: out } : undefined;
}

export type ErrorContext = { path?: string; method?: string; digest?: string; source: "server" | "client" | "edge"; routeType?: string };

/** Envoie une erreur à Sentry si configuré. Ne lève jamais d'exception. */
export async function reportError(error: unknown, ctx: ErrorContext): Promise<boolean> {
  const d = parseDsn(process.env.SENTRY_DSN);
  if (!d) return false;
  try {
    const e = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Erreur inconnue");
    const eventId = crypto.randomUUID().replace(/-/g, "");
    const now = new Date().toISOString();
    const event = {
      event_id: eventId,
      timestamp: now,
      platform: "javascript",
      level: "error",
      logger: `nomad-club.${ctx.source}`,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
      release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12),
      tags: { source: ctx.source, route_type: ctx.routeType ?? "inconnu", digest: ctx.digest ?? "" },
      transaction: ctx.path ? scrub(ctx.path.split("?")[0]) : undefined,
      request: ctx.path ? { url: scrub(ctx.path.split("?")[0]), method: ctx.method } : undefined,
      exception: { values: [{ type: e.name || "Error", value: scrub(e.message).slice(0, 1000), stacktrace: frames(e.stack) }] },
    };
    const body = `${JSON.stringify({ event_id: eventId, sent_at: now, dsn: d.dsn })}\n${JSON.stringify({ type: "event" })}\n${JSON.stringify(event)}\n`;
    const res = await fetch(d.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope", "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${d.key}, sentry_client=nomad-club/1.0` },
      body,
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
