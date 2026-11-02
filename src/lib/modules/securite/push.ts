/**
 * Lot 6 — notifications push Web (sans dépendance externe).
 *
 * - Clés VAPID dans les variables d'environnement : NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 *   (générer une paire : `node scripts/vapid-keys.mjs`). Sans clés, rien n'est envoyé (et le bouton d'abonnement est masqué).
 * - Chiffrement du contenu : RFC 8291 (aes128gcm) ; authentification du serveur : RFC 8292 (JWT ES256).
 * - Appelé par src/lib/notify.ts (deliverExternally) : respecte la préférence « push » de chaque type.
 * - Les abonnements expirés (404 / 410) sont supprimés.
 */
import { createCipheriv, createECDH, createPrivateKey, hkdfSync, randomBytes, sign } from "node:crypto";
import type { NotificationInput } from "../../data/repo";

const b64url = (buf: Buffer) => buf.toString("base64url");
const fromB64url = (s: string) => Buffer.from(s, "base64url");

export function pushConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

/** Clé publique à donner au navigateur (null si le push n'est pas configuré). */
export function vapidPublicKey(): string | null {
  return pushConfigured() ? (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null) : null;
}

/** JWT VAPID (ES256) pour l'origine du service de push. */
function vapidAuthorization(endpoint: string): string {
  const pub = fromB64url(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!);
  const d = process.env.VAPID_PRIVATE_KEY!;
  const key = createPrivateKey({
    key: { kty: "EC", crv: "P-256", d, x: b64url(pub.subarray(1, 33)), y: b64url(pub.subarray(33, 65)) },
    format: "jwk",
  });
  const header = b64url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(
    Buffer.from(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: process.env.VAPID_SUBJECT || "mailto:bonjour@nomadclub.example",
      }),
    ),
  );
  const signature = sign("sha256", Buffer.from(`${header}.${claims}`), { key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${header}.${claims}.${b64url(signature)}, k=${b64url(pub)}`;
}

/** Chiffre le contenu pour un abonnement (RFC 8291, un seul enregistrement). */
export function encryptPayload(payload: Buffer, p256dh: string, authSecret: string): Buffer {
  const uaPublic = fromB64url(p256dh);
  const auth = fromB64url(authSecret);
  const ecdh = createECDH("prime256v1");
  const asPublic = ecdh.generateKeys();
  const shared = ecdh.computeSecret(uaPublic);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", shared, auth, keyInfo, 32));
  const salt = randomBytes(16);
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([payload, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

export type PushMessage = { title: string; body: string; link: string | null; tag?: string };

/** Envoie un message à un abonnement. Renvoie le statut HTTP (0 en cas d'erreur réseau). */
export async function sendPush(sub: { endpoint: string; p256dh: string; auth: string }, msg: PushMessage): Promise<number> {
  const payload = Buffer.from(JSON.stringify(msg).slice(0, 3000));
  try {
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        Authorization: vapidAuthorization(sub.endpoint),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(24 * 3600),
        Urgency: "normal",
      },
      body: new Uint8Array(encryptPayload(payload, sub.p256dh, sub.auth)),
      signal: AbortSignal.timeout(8000),
    });
    return res.status;
  } catch {
    return 0;
  }
}

/**
 * Relais push des notifications in-app (appelé par notify.ts). Ne lève jamais d'erreur.
 * Désactivé sans clés VAPID, en démo, ou sans clé service en mode réel (lecture des abonnements des autres).
 */
export async function deliverPush(rows: NotificationInput[]): Promise<number> {
  if (!rows.length || !pushConfigured()) return 0;
  try {
    const { getRepo } = await import("../../data");
    const { isRealMode } = await import("../../env");
    if (!isRealMode()) return 0;
    const repo = getRepo();
    const ids = [...new Set(rows.map((r) => r.recipientId))];
    const subs = await repo.listPushSubscriptionsFor(ids);
    if (!subs.length) return 0;
    // préférences « push » coupées (lues avec la clé service : ce sont celles des destinataires)
    const { supabaseAdmin } = await import("../../supabase/server");
    const { data: muted } = await supabaseAdmin().from("notification_prefs").select("profile_id, type").in("profile_id", ids).eq("push", false);
    const isMuted = (r: NotificationInput) => (muted ?? []).some((m) => m.profile_id === r.recipientId && m.type === r.type);
    let sent = 0;
    for (const row of rows) {
      const mine = subs.filter((s) => s.profileId === row.recipientId);
      if (!mine.length || isMuted(row)) continue;
      for (const s of mine) {
        const status = await sendPush(s, { title: row.title, body: row.body, link: row.link, tag: row.type });
        if (status === 404 || status === 410) await repo.removePushSubscriptionById(s.id);
        else if (status >= 200 && status < 300) sent++;
      }
    }
    return sent;
  } catch (e) {
    console.error("[push]", e instanceof Error ? e.message : e);
    return 0;
  }
}
