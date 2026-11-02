/**
 * Liens de désinscription en un clic (RFC 8058) : jeton signé HMAC-SHA256 « profil + type de notification ».
 * Pas d'expiration (un lien de désinscription doit fonctionner longtemps) ; aucun accès au compte n'est donné :
 * le jeton permet seulement de couper la préférence « e-mail » d'un type.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const enc = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const dec = (s: string) => Buffer.from(s, "base64url").toString("utf8");

const sig = (payload: string, secret: string) => createHmac("sha256", secret).update(`unsubscribe:${payload}`).digest("base64url").slice(0, 32);

export function signUnsubscribe(profileId: string, type: string, secret: string): string {
  const payload = `${profileId}:${type}`;
  return `${enc(payload)}.${sig(payload, secret)}`;
}

export function verifyUnsubscribe(token: string | null | undefined, secret: string | null): { profileId: string; type: string } | null {
  if (!token || !secret || token.length > 400) return null;
  const [p, s] = token.split(".");
  if (!p || !s) return null;
  let payload: string;
  try {
    payload = dec(p);
  } catch {
    return null;
  }
  const want = Buffer.from(sig(payload, secret));
  const got = Buffer.from(s);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const m = /^([0-9a-zA-Z-]{1,64}):([a-z_]{1,40})$/.exec(payload);
  return m ? { profileId: m[1], type: m[2] } : null;
}
