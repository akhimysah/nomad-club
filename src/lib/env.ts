import type { PaymentMode } from "./types";
import { resolveProviderId } from "./modules/paiements/config.ts"; // --- Vague 2 · paiements ---

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

/**
 * Prestataire de paiement actif, vu par les écrans : « stripe », « transfer » (virement déclaré) ou
 * « demo » (paiement simulé). --- Vague 2 · paiements --- : choisi par PAYMENT_PROVIDER (défaut : Stripe si
 * une clé est présente, sinon virement en réel et simulé en démo ; le simulé est refusé en mode réel).
 */
export function paymentMode(): PaymentMode {
  const id = resolveProviderId();
  return id === "simulated" ? "demo" : id;
}

/** Coordonnées bancaires affichées pour un virement (mode réel sans Stripe). */
export function transferDetails(): { holder: string; iban: string } {
  return {
    holder: process.env.NEXT_PUBLIC_TRANSFER_HOLDER || "Nomad Club",
    iban: process.env.NEXT_PUBLIC_TRANSFER_IBAN || "communiqué par Julia et Nora sur WhatsApp",
  };
}
