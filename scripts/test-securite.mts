// Lot 6 — tests des modules purs de sécurité (sans serveur ni base) : redirections, 2FA, en-têtes,
// journal (CSV, filtres) et chiffrement des notifications push (RFC 8291 / VAPID RFC 8292).
// Utilisation : npm run test:securite (Node 22 : --experimental-strip-types)
import { createDecipheriv, createECDH, createPublicKey, hkdfSync, randomBytes, verify } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const req = await import(`${root}/src/lib/modules/securite/request.ts`);
const core = await import(`${root}/src/lib/modules/securite/mfa-core.ts`);
const hdr = await import(`${root}/src/lib/modules/securite/headers.ts`);
const av = await import(`${root}/src/lib/modules/securite/audit-view.ts`);
let fail = 0;
const ok = (c: boolean, m: string) => {
  if (!c) fail++;
  console.log(`${c ? "✓" : "✗"} ${m}`);
};

const safe: (n: string | null, f?: string) => string = req.safeRedirectPath;
for (const [input, want] of [
  ["/espace/agenda", "/espace/agenda"],
  ["//evil.com", "/espace"],
  ["/\\evil.com", "/espace"],
  ["https://evil.com", "/espace"],
  ["/x\u0000y", "/espace"],
  [null, "/espace"],
] as const)
  ok(safe(input) === want, `safeRedirectPath(${JSON.stringify(input)}) = ${want}`);

ok(JSON.stringify(core.rolesForAal(["admin"], "aal1", true)) === '["guest"]', "admin en AAL1 → guest");
ok(JSON.stringify(core.rolesForAal(["admin", "member"], "aal1", true)) === '["member"]', "admin+membre en AAL1 → membre");
ok(JSON.stringify(core.rolesForAal(["admin"], "aal2", true)) === '["admin"]', "admin en AAL2 → admin");
ok(core.adminMfaRequired({}) === false, "2FA non exigée en démo");
ok(core.adminMfaRequired({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" }) === true, "2FA exigée en mode réel par défaut");
ok(core.adminMfaRequired({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k", ADMIN_MFA_REQUIRED: "false" }) === false, "ADMIN_MFA_REQUIRED=false la coupe");

const prod = hdr.securityHeaders({ NODE_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co", VERCEL: "1" });
const csp = prod.find((h: { key: string }) => h.key === "Content-Security-Policy").value as string;
ok(csp.includes("https://abc.supabase.co") && csp.includes("wss://abc.supabase.co"), "CSP : Supabase HTTPS + temps réel");
ok(!csp.includes("unsafe-eval") && csp.includes("upgrade-insecure-requests"), "CSP production : sans unsafe-eval, upgrade-insecure-requests");
ok(prod.some((h: { key: string }) => h.key === "Strict-Transport-Security"), "HSTS en production");

const csv = av.auditCsv(
  [{ id: "1", actorId: null, action: "data.export", targetType: "profile", targetId: null, summary: '=HYPERLINK("x")', details: {}, createdAt: "2026-11-02T10:00:00Z" }],
  new Map(),
);
ok(csv.includes(`"'=HYPERLINK(""x"")"`), "CSV : formule neutralisée et guillemets échappés");
ok(JSON.stringify(av.parseAuditFilters({ type: "role; drop", du: "2026-13-99x", qui: "p-julia" })) === '{"actorId":"p-julia"}', "filtres du journal : valeurs non conformes ignorées");

// notifications push : chiffrement déchiffrable par le navigateur et signature VAPID valide
{
  const server = createECDH("prime256v1");
  server.generateKeys();
  const d = server.getPrivateKey();
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = server.getPublicKey().toString("base64url");
  process.env.VAPID_PRIVATE_KEY = Buffer.concat([Buffer.alloc(32 - d.length), d]).toString("base64url");
  const push = await import(`${root}/src/lib/modules/securite/push.ts`);
  const ua = createECDH("prime256v1");
  ua.generateKeys();
  const auth = randomBytes(16);
  const msg = JSON.stringify({ title: "Essai", body: "Bonjour", link: "/espace" });
  const enc: Buffer = push.encryptPayload(Buffer.from(msg), ua.getPublicKey().toString("base64url"), auth.toString("base64url"));
  const salt = enc.subarray(0, 16);
  const asPublic = enc.subarray(21, 21 + enc[20]);
  const body = enc.subarray(21 + enc[20]);
  const ikm = Buffer.from(hkdfSync("sha256", ua.computeSecret(asPublic), auth, Buffer.concat([Buffer.from("WebPush: info\0"), ua.getPublicKey(), asPublic]), 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const dec = createDecipheriv("aes-128-gcm", cek, nonce);
  dec.setAuthTag(body.subarray(body.length - 16));
  const plain = Buffer.concat([dec.update(body.subarray(0, body.length - 16)), dec.final()]);
  ok(plain.subarray(0, -1).toString() === msg && plain[plain.length - 1] === 2, "push : contenu déchiffré à l'identique (aes128gcm)");
  let authz = "";
  globalThis.fetch = (async (_u: string, init: { headers: Record<string, string> }) => {
    authz = init.headers.Authorization;
    return new Response(null, { status: 201 });
  }) as unknown as typeof fetch;
  const status = await push.sendPush(
    { endpoint: "https://fcm.googleapis.com/fcm/send/x", p256dh: ua.getPublicKey().toString("base64url"), auth: auth.toString("base64url") },
    { title: "x", body: "y", link: null },
  );
  const [, t, k] = authz.match(/^vapid t=([^,]+), k=(.+)$/) ?? [];
  const [h, c, s] = (t ?? "..").split(".");
  const pub = Buffer.from(k ?? "", "base64url");
  const key = createPublicKey({ key: { kty: "EC", crv: "P-256", x: pub.subarray(1, 33).toString("base64url"), y: pub.subarray(33).toString("base64url") }, format: "jwk" });
  const valid = verify("sha256", Buffer.from(`${h}.${c}`), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"));
  ok(status === 201 && valid && JSON.parse(Buffer.from(c, "base64url").toString()).aud === "https://fcm.googleapis.com", "push : jeton VAPID signé (ES256) pour l'origine du service");
}

console.log(fail ? `\n${fail} échec(s)` : "\nTests de sécurité OK");

process.exit(fail ? 1 : 0);
