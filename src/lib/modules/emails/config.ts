/**
 * Configuration des e-mails, lue dans les variables d'environnement (module pur).
 *
 * - RESEND_API_KEY : active l'envoi réel par Resend. Sans clé : fournisseur « console » (journal + mémoire).
 * - EMAIL_PROVIDER : force « resend », « console » ou « smtp » (voir docs/emails.md).
 * - EMAIL_FROM : expéditeur, ex. « Nomad Club <bonjour@nomadclub.ma> » (domaine vérifié chez Resend).
 * - EMAIL_REPLY_TO : adresse de réponse (ex. la boîte de Julia et Nora).
 * - EMAIL_UNSUBSCRIBE_SECRET : signe les liens de désinscription (repli : CRON_SECRET, puis clé service).
 */
import type { MailerName } from "./types.ts";

type Env = Record<string, string | undefined>;

export const DEFAULT_FROM = "Nomad Club <bonjour@nomadclub.example>";

export function emailProvider(env: Env = process.env): MailerName {
  const forced = (env.EMAIL_PROVIDER ?? "").trim().toLowerCase();
  if (forced === "resend" || forced === "console" || forced === "smtp") return forced;
  return env.RESEND_API_KEY ? "resend" : "console";
}

export function emailFrom(env: Env = process.env): string {
  return (env.EMAIL_FROM ?? "").trim() || DEFAULT_FROM;
}

export function emailReplyTo(env: Env = process.env): string | null {
  return (env.EMAIL_REPLY_TO ?? "").trim() || null;
}

/** Secret de signature des liens de désinscription (null : liens désactivés, seule la page des préférences reste). */
export function unsubscribeSecret(env: Env = process.env): string | null {
  return env.EMAIL_UNSUBSCRIBE_SECRET || env.CRON_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || (env.NODE_ENV !== "production" ? "nomad-club-demo-unsubscribe" : null);
}

/** Adresse publique du site pour les liens des e-mails (sans requête HTTP : cron, webhook). */
export function emailBaseUrl(env: Env = process.env): string {
  const u = (env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  if (u) return u.replace(/\/$/, "");
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** Adresse e-mail plausible (contrôle léger avant l'envoi). */
export function isEmailAddress(v: unknown): v is string {
  return typeof v === "string" && v.length <= 254 && /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/.test(v);
}

/** Masque une adresse pour le journal (« c•••@gmail.com »). */
export function maskEmail(v: string): string {
  const [user, domain] = v.split("@");
  if (!domain) return "•••";
  return `${user.slice(0, 1)}•••@${domain}`;
}
