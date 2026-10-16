import type { PaymentMode } from "./types";

/**
 * Le mode est choisi par les variables d'environnement :
 * - mode réel si NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont définies ;
 * - sinon mode démo (données en mémoire, sélecteur d'espace).
 */
export function isRealMode(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function appMode(): "demo" | "real" {
  return isRealMode() ? "real" : "demo";
}

/** Stripe si une clé secrète est présente, sinon paiement simulé (démo) ou virement déclaré (réel). */
export function paymentMode(): PaymentMode {
  if (process.env.STRIPE_SECRET_KEY) return "stripe";
  return isRealMode() ? "transfer" : "demo";
}

/** Coordonnées bancaires affichées pour un virement (mode réel sans Stripe). */
export function transferDetails(): { holder: string; iban: string } {
  return {
    holder: process.env.NEXT_PUBLIC_TRANSFER_HOLDER || "Nomad Club",
    iban: process.env.NEXT_PUBLIC_TRANSFER_IBAN || "communiqué par Julia et Nora sur WhatsApp",
  };
}
