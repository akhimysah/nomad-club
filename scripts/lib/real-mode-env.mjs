// Environnement « mode réel » pour les tests d'intégration : base PGlite migrée + seed, faux Supabase
// (scripts/lib/postgrest-pglite.mjs) branché sur fetch, et session de la personne simulée par cookie,
// exactement comme @supabase/ssr la lit dans l'appli.
import { ANON_KEY, SERVICE_KEY, createPostgrest, fakeJwt } from "./postgrest-pglite.mjs";
import { createTestDb } from "./pglite-db.mjs";

export const SUPABASE_URL = "http://pglite.localhost";

export async function setupRealMode(opts = {}) {
  const db = await createTestDb({ seed: opts.seed !== false, quiet: opts.quiet });
  const unsupported = [];
  const pg = await createPostgrest(db, { onUnsupported: (m) => unsupported.push(m) });
  const realFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (href.startsWith(SUPABASE_URL)) return pg.fetch(input, init);
    if (opts.allowNetwork) return realFetch(input, init);
    return Promise.reject(new Error(`réseau coupé pendant les tests : ${href}`));
  };
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: opts.serviceKey === false ? "" : SERVICE_KEY,
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    ADMIN_MFA_REQUIRED: "false",
    RATE_LIMIT_STORE: "memory",
  });
  globalThis.__ncTest = { cookies: new Map(), headers: new Headers({ "x-forwarded-for": "203.0.113.7", host: "localhost:3000", "user-agent": "test" }) };

  const cookieName = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
  /** Ouvre une session pour `userId` (ou se déconnecte avec null). `aal` : "aal1" | "aal2". */
  async function signIn(userId, aal = "aal2") {
    const jar = globalThis.__ncTest.cookies;
    for (const k of [...jar.keys()]) if (k.startsWith(cookieName)) jar.delete(k);
    if (!userId) return;
    const email = (await db.query("select email from auth.users where id = $1", [userId])).rows[0]?.email ?? null;
    const exp = Math.floor(Date.now() / 1000) + 86400;
    const access = fakeJwt({ sub: userId, role: "authenticated", aud: "authenticated", aal, email, exp, session_id: "00000000-0000-4000-a000-000000000000" });
    const session = { access_token: access, refresh_token: "r", token_type: "bearer", expires_in: 86400, expires_at: exp, user: { id: userId, aud: "authenticated", role: "authenticated", email } };
    jar.set(cookieName, "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"));
  }
  return { db, pg, signIn, unsupported };
}
