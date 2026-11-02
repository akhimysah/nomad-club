// Faux Supabase LOCAL pour essayer l'appli en MODE RÉEL sans compte Supabase (développement uniquement) :
// PGlite (migrations + seed d'exemple) derrière la couche PostgREST/GoTrue de scripts/lib/postgrest-pglite.mjs.
//
//   node scripts/faux-supabase.mjs            → http://localhost:54329 (données d'exemple)
//   node scripts/faux-supabase.mjs --vide     → base vide (comme une vraie mise en production)
//
// Puis, dans un autre terminal :
//   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54329 NEXT_PUBLIC_SUPABASE_ANON_KEY=<affichée> \
//   SUPABASE_SERVICE_ROLE_KEY=<affichée> ADMIN_MFA_REQUIRED=false npx next dev -p 3204
//
// Session d'une personne (pour curl) : GET /__session?email=julia@exemple.com → en-tête Cookie à renvoyer à l'appli.
// Les liens magiques ne partent pas : GET /__otp liste les demandes reçues.
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { ANON_KEY, SERVICE_KEY, createPostgrest, fakeJwt } from "./lib/postgrest-pglite.mjs";
import { createTestDb } from "./lib/pglite-db.mjs";

const PORT = Number(process.env.PORT ?? 54329);
const db = await createTestDb({ seed: !process.argv.includes("--vide"), quiet: true });
const pg = await createPostgrest(db, { onUnsupported: (m) => console.error(`[non géré] ${m}`) });
const base = `http://localhost:${PORT}`;
const seedUuid = (id) => {
  const h = createHash("md5").update("nomad-club:" + id).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", base);
  if (url.pathname === "/__session") {
    // ?email=… ou ?profil=p-hana (identifiant des données d'exemple, pour les comptes sans e-mail)
    const email = (url.searchParams.get("email") ?? "").toLowerCase() || null;
    const profil = url.searchParams.get("profil");
    const u = profil
      ? { id: seedUuid(profil) }
      : (await db.query("select id from auth.users where lower(email) = $1", [email])).rows[0];
    if (!u) return res.writeHead(404).end("compte inconnu");
    const exp = Math.floor(Date.now() / 1000) + 86400;
    const aal = url.searchParams.get("aal") ?? "aal2";
    const access = fakeJwt({ sub: u.id, role: "authenticated", aud: "authenticated", aal, email, exp, session_id: "00000000-0000-4000-a000-000000000000" });
    const session = { access_token: access, refresh_token: "r", token_type: "bearer", expires_in: 86400, expires_at: exp, user: { id: u.id, aud: "authenticated", role: "authenticated", email } };
    const name = `sb-${new URL(base).hostname.split(".")[0]}-auth-token`;
    return res.writeHead(200, { "content-type": "text/plain" }).end(`${name}=base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`);
  }
  if (url.pathname === "/__otp") return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(pg.log.otp, null, 2));
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const r = await pg.fetch(url.href, { method: req.method, headers: req.headers, body: chunks.length ? Buffer.concat(chunks).toString("utf8") : undefined });
  const headers = Object.fromEntries(r.headers.entries());
  res.writeHead(r.status, headers);
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(PORT, () => {
  console.log(`Faux Supabase prêt sur ${base}`);
  console.log(`NEXT_PUBLIC_SUPABASE_URL=${base}`);
  console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}`);
  console.log(`SUPABASE_SERVICE_ROLE_KEY=${SERVICE_KEY}`);
});
