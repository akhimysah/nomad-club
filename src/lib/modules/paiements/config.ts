/**
 * Configuration des paiements, lue dans les variables d'environnement (voir .env.example).
 * Module pur (aucun import d'exécution) : utilisable par env.ts, content.ts, le navigateur (variables
 * NEXT_PUBLIC_*) et les tests Node.
 */
import type { ProviderId } from "./types";

const env = (k: string): string => (process.env[k] ?? "").trim();

function intEnv(k: string, def: number, min: number, max: number): number {
  const n = Number(env(k));
  return Number.isFinite(n) && env(k) !== "" ? Math.min(max, Math.max(min, Math.round(n))) : def;
}

function priceEnv(k: string, def: number): number {
  const n = Number(env(k).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : def;
}

function realMode(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Prestataire actif. PAYMENT_PROVIDER=stripe|transfer|simulated ; par défaut Stripe si une clé est
 * présente, sinon virement (mode réel) ou simulé (démo). Le paiement simulé est INTERDIT en mode réel :
 * il est alors remplacé par le virement (et signalé dans les journaux du serveur).
 */
export function resolveProviderId(): Exclude<ProviderId, "cmi"> {
  const wanted = env("PAYMENT_PROVIDER").toLowerCase();
  const hasStripe = Boolean(env("STRIPE_SECRET_KEY"));
  const real = realMode();
  const fallback = real ? "transfer" : "simulated";
  if (wanted === "stripe") return hasStripe ? "stripe" : fallback;
  if (wanted === "transfer") return "transfer";
  if (wanted === "simulated") {
    if (real) {
      console.warn("[paiements] PAYMENT_PROVIDER=simulated refusé en mode réel : virement utilisé à la place.");
      return "transfer";
    }
    return "simulated";
  }
  return hasStripe ? "stripe" : fallback;
}

/** « test » (sk_test_…), « live » (sk_live_… / rk_live_…) ou null sans clé. */
export function stripeKeyMode(): "test" | "live" | null {
  const k = env("STRIPE_SECRET_KEY");
  if (!k) return null;
  return /_live_/.test(k) ? "live" : "test";
}

/** Tarifs annuels (NEXT_PUBLIC_PRICE_* : lisibles aussi par le navigateur). */
export function membershipPrices(): { member: number; premium: number; upgrade: number } {
  const member = priceEnv("NEXT_PUBLIC_PRICE_MEMBER", 670);
  const premium = priceEnv("NEXT_PUBLIC_PRICE_PREMIUM", 1250);
  return { member, premium, upgrade: priceEnv("NEXT_PUBLIC_PRICE_UPGRADE", Math.max(0, premium - member)) };
}

/** Nombres d'échéances proposés pour l'adhésion annuelle (MEMBERSHIP_INSTALLMENTS, défaut « 1,3,12 »). */
export function installmentOptions(): number[] {
  const raw = env("MEMBERSHIP_INSTALLMENTS") || "1,3,12";
  const list = [...new Set(raw.split(/[,; ]+/).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 12))].sort((a, b) => a - b);
  return list.includes(1) ? list : [1, ...list];
}

/** Jours d'impayé tolérés avant de suspendre l'accès d'une adhérente (MEMBERSHIP_GRACE_DAYS, défaut 15). */
export function membershipGraceDays(): number {
  return intEnv("MEMBERSHIP_GRACE_DAYS", 15, 0, 90);
}

/** Intervalle entre deux relances d'une échéance impayée (PAYMENT_REMINDER_EVERY_DAYS, défaut 3). */
export function reminderEveryDays(): number {
  return intEnv("PAYMENT_REMINDER_EVERY_DAYS", 3, 1, 30);
}

/** Relances avant la fin de l'adhésion, en jours (RENEWAL_REMINDER_DAYS, défaut « 30,7,1 »). */
export function renewalReminderDays(): number[] {
  const raw = env("RENEWAL_REMINDER_DAYS") || "30,7,1";
  return [...new Set(raw.split(/[,; ]+/).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 120))].sort((a, b) => b - a);
}

/** Identifiant de prix Stripe facultatif pour une formule pro (STRIPE_PRICE_PRO_ESSENTIEL…). Sinon prix créé à la volée. */
export function stripeProPriceId(plan: string): string | null {
  return env(`STRIPE_PRICE_PRO_${plan.toUpperCase()}`) || null;
}
